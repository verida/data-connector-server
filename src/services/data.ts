// import "@tensorflow/tfjs-node";
import { IContext, IDatastore } from '@verida/types';
import * as CryptoJS from 'crypto-js';
import { EventEmitter } from 'events'
import MiniSearch, { SearchOptions, SearchResult } from 'minisearch';
import { getDataSchemas, getDataSchemasDict } from './schemas';
import { BaseDataSchema } from './schemas/base';
// import { VectorStore } from "@langchain/core/vectorstores";

export const indexCache: Record<string, MiniSearch<any>> = {}
// export const vectorCache: Record<string, VectorStore> = {}

// const vectorStoreDataDir = "./vectorstores"

// function logMemory() {
//     const memoryUsage = process.memoryUsage();
//   console.log({
//     rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
//     heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
//     heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
//     external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`,
//   });
// }

export interface SchemaConfig {
    label: string
    storeFields: string[],
    indexFields: string[]
}

export enum HotLoadStatus {
    StartData = "Loading Data",
    StartIndex = "Building Index",
    Complete = "Load Complete"
}

export interface HotLoadProgress {
    schema: string
    status: HotLoadStatus
    recordCount: number
    totalProgress: number
}

export class DataService extends EventEmitter {

    protected did: string
    protected context: IContext
    protected totalSteps: number = 0
    protected stepCount:  number = 0

    constructor(did: string, context: IContext) {
        super()
        this.did = did
        this.context = context
    }

    protected startProgress(totalSteps: number = 3) {
        this.totalSteps = totalSteps
        this.stepCount = 0
    }

    protected emitProgress(schema: string, status: HotLoadStatus, recordCount: number) {
        this.stepCount++
        const progress: HotLoadProgress =  {
            schema,
            status,
            recordCount,
            totalProgress: ((this.stepCount) / this.totalSteps)
        }
        this.emit('progress', progress)
    }

    public async getDatastore(schemaUri: string): Promise<IDatastore> {
        return this.context.openDatastore(schemaUri)
    }

    public async searchIndex(schemaUri: string, query: string, maxResults: number = 50, cutoffPercent: number = 0.5, searchOptions?: SearchOptions, indexFields?: string[],
        storeFields?: string[]): Promise<SearchResult[]> {
        const miniSearchIndex = await this.getIndex(schemaUri, indexFields, storeFields)
        const searchResults = await miniSearchIndex.search(query, searchOptions)
        
        if (!searchResults.length) {
            return []
        }

        const results: any[] = []
        const cutoffScore = searchResults[0].score * cutoffPercent
        for (const result of searchResults) {
            if (result.score < cutoffScore || results.length >= maxResults) {
                break
            }

            results.push(result)
        }

        // console.log(schemaUri, results)

        return results
    }

    public async getNormalizedDocs(dataSchema: BaseDataSchema, indexFields?: string[], storeFields?: string[]): Promise<{
        docs: any[],
        arrayProperties: string[],
        pouchDb: any
    }> {
        try {
            const schemaUri = dataSchema.getUrl()
            indexFields = [...(indexFields || dataSchema.getIndexFields())]
            storeFields = [...(storeFields || dataSchema.getStoreFields())]
            this.emitProgress(dataSchema.getLabel(), HotLoadStatus.StartData, 10)
            const datastore = await this.context.openDatastore(schemaUri)

            const database = await datastore.getDb()
            const pouchDb = await database.getDb()
            const result = await pouchDb.allDocs({
                include_docs: true,
                attachments: false
            });

            this.emitProgress(dataSchema.getLabel(), HotLoadStatus.StartIndex, 10)
            
            // Build a list of array properties to index separately
            const schema = datastore.getSchema();
            const schemaSpec = await schema.getSpecification();

            const arrayProperties: string[] = []
            for (const propertyKey of Object.keys(schemaSpec.properties)) {
                const property = schemaSpec.properties[propertyKey]

                if (property.type == 'array') {
                    arrayProperties.push(propertyKey)
                }
            }

            // If no store fields specified, store everything
            if (storeFields.length === 0) {
                storeFields = Object.keys(schemaSpec.properties)
            }

            const docs: any = []
            for (const i in result.rows) {
                const row = this.buildRow(result.rows[i].doc, arrayProperties, storeFields)

                if (!row) {
                    continue
                }

                docs.push(row)
            }

            return {
                docs,
                arrayProperties,
                pouchDb
            }
        } catch (err) {
            console.log(err)
            return err
        }
    }

    public async getIndex(schemaUrl: string, indexFields?: string[], storeFields?: string[]): Promise<MiniSearch<any>> {
        const dataSchemasDict = getDataSchemasDict()
        const dataSchema = dataSchemasDict[schemaUrl]
        const schemaUri = dataSchema.getUrl()
        indexFields = indexFields ? indexFields : dataSchema.getIndexFields()
        storeFields = storeFields ? storeFields : dataSchema.getStoreFields()

        const cacheKey = CryptoJS.MD5(`${this.did}:${schemaUri}:${indexFields.join(',')}:${storeFields.join(',')}`).toString()

        if (!indexCache[cacheKey]) {
            const { docs, arrayProperties, pouchDb } = await this.getNormalizedDocs(dataSchema, indexFields, storeFields)

            // console.log(`Creating index for ${schemaUri}`, cacheKey)
            const miniSearch = new MiniSearch({
                fields: indexFields, // fields to index for full-text search
                storeFields,
                // Add support for nested fields (`ie: attachments_0.textContent)
                extractField: (document, fieldName) => {
                    return fieldName.split('.').reduce((doc, key) => doc && doc[key], document)
                }
            })

            // Index all documents
            await miniSearch.addAllAsync(docs)

            this.emitProgress(`${dataSchema.getLabel()} Keyword Index`, HotLoadStatus.Complete, docs.length)

            // Setup a change listener to add any new items
            const changeOptions = {
                // Don't include docs as there's a bug that sends `undefined` doc values which crashes the encryption library
                include_docs: false,
                // Live stream changes
                live: true,
                // Only include new changes from now
                since: 'now'
            }

            // Listen and handle changes
            const changeHandler = pouchDb.changes(changeOptions)
                .on('change', async (change: any) => {
                    const record = await pouchDb.get(change.id)
                    const row = this.buildRow(record, arrayProperties, storeFields)
                    if (!row) {
                        return
                    }
                    // console.log('adding record to index', record.id, record.schema, record.name)

                    try {
                        miniSearch.add(row)
                    } catch (err: any) {
                        // console.log(record.id, record.name, 'already in search index')
                        // Document may already be in the index
                    }
                })
                .on('error', (error: any) => {
                    console.log('error!')
                    console.error(error)
                })

            indexCache[cacheKey] = miniSearch
            // console.log(`Index created for ${schemaUri}`, cacheKey)
        } else {
            this.stepCount += 2
            this.emitProgress(`${dataSchema.getLabel()} Keyword Index`, HotLoadStatus.Complete, indexCache[cacheKey].documentCount)
        }

        return indexCache[cacheKey]
    }

    /**
     * Performance of loading vector store is too slow, keyword index works just as well
     */
    // public async getVectorStore(): Promise<VectorStore> {
    //     const cacheKey = CryptoJS.MD5(`${this.did}`).toString()

    //     try {
    //         const dataSchemas = getDataSchemas()
    //         if (!vectorCache[cacheKey]) {
    //             const embeddings = new TensorFlowEmbeddings();

    //             // if (fs.existsSync(`${vectorStoreDataDir}/${cacheKey}`)) {
    //             //     console.log('loading from disk!')
    //             //     vectorCache[cacheKey] = await CloseVectorNode.load(`${vectorStoreDataDir}/${cacheKey}`, embeddings)
    //             //     return vectorCache[cacheKey]
    //             // }

    //             const documents: Document[] = []
    //             for (const dataSchema of dataSchemas) {
    //                 const { docs, arrayProperties, pouchDb } = await this.getNormalizedDocs(dataSchema, dataSchema.getIndexFields(), dataSchema.getStoreFields())

    //                 for (const row of docs) {
    //                     const metadata = {
    //                         id: row._id,
    //                         type: dataSchema.getLabel(),
    //                         groupId: dataSchema.getGroupId(row),
    //                         timestamp: dataSchema.getTimestamp(row)
    //                     }

    //                     const pageContent = `[${dataSchema.getLabel()}]\n${dataSchema.getRagContent(row)}`

    //                     documents.push({
    //                         id: row._id,
    //                         metadata,
    //                         pageContent
    //                     })
    //                 }

    //                 this.emitProgress(`${dataSchema.getLabel()} VectorDb`, HotLoadStatus.Complete, docs.length)

    //                 // Setup a change listener to add any new items
    //                 const changeOptions = {
    //                     // Don't include docs as there's a bug that sends `undefined` doc values which crashes the encryption library
    //                     include_docs: false,
    //                     // Live stream changes
    //                     live: true,
    //                     // Only include new changes from now
    //                     since: 'now'
    //                 }

    //                 // Listen and handle changes
    //                 const changeHandler = pouchDb.changes(changeOptions)
    //                     .on('change', async (change: any) => {
    //                         const record = await pouchDb.get(change.id)
    //                         const row = this.buildRow(record, arrayProperties, dataSchema.getStoreFields())
    //                         if (!row) {
    //                             return
    //                         }
    //                         // console.log('adding record to index', record.id, record.schema, record.name)

    //                         try {
    //                             vectorStore.addDocuments([row])
    //                         } catch (err: any) {
    //                             console.error(err.message)
    //                             // console.log(record.id, record.name, 'already in search index')
    //                             // Document may already be in the index
    //                         }
    //                     })
    //                     .on('error', (error: any) => {
    //                         console.log('error!')
    //                         console.error(error)
    //                     })
    //                 console.log('Loaded docs for vector store', dataSchema.getLabel())
    //                 // break
    //             }

    //             console.log('creating vector store with all docs', documents.length)

    //             // const vectorStore = await CloseVectorNode.fromDocuments(
    //             //     [],
    //             //     embeddings
    //             // );
    //             let vectorDbProgress = 0
    //             this.emitProgress(`Creating VectorDb - ${vectorDbProgress}%`, HotLoadStatus.StartIndex, documents.length)

    //             const vectorStore = await MemoryVectorStore.fromDocuments(
    //                 [],
    //                 embeddings
    //             );

    //             // Add documents in batches of 500 at a time to prevent
    //             // out of memory issues (when using local embedding)
    //             // or too many requests (when using remote embedding)
    //             let processedDocs = 0
    //             while (documents.length) {
    //                 const docBatch = documents.splice(0,500)
    //                 if (docBatch.length === 0) {
    //                     break
    //                 }

    //                 console.log('a')
    //                 await vectorStore.addDocuments(docBatch)
    //                 console.log('b')

    //                 processedDocs += docBatch.length
    //                 if ((processedDocs / documents.length) >= vectorDbProgress*10) {
    //                     vectorDbProgress = Math.floor(processedDocs / documents.length * 1)
    //                     console.log('incrementing vectordb progress', vectorDbProgress)
    //                     this.emitProgress(`Creating VectorDb - ${vectorDbProgress*10}%`, HotLoadStatus.StartIndex, documents.length)
    //                 }
    //             }

    //             this.emitProgress(`Creating VectorDb - 100%`, HotLoadStatus.Complete, documents.length)

    //             // console.log('vector store created')

    //             // console.log('saving vector store to disk')
    //             // await vectorStore.save(`${vectorStoreDataDir}/${cacheKey}`) 
    //             // console.log('saved')

    //             vectorCache[cacheKey] = vectorStore
    //         } else {
    //             this.stepCount += dataSchemas.length * 2
    //             this.emitProgress(`VectorDb Loaded from Cache`, HotLoadStatus.Complete, 0)
    //         }

    //         return vectorCache[cacheKey]
    //     } catch (err) {
    //         console.log(err)
    //         throw err
    //     }
    // }

    public async hotLoadIndexes(): Promise<void> {
        const dataSchemas = getDataSchemas()
        this.startProgress(Object.keys(dataSchemas).length * 3)

        const promises: Promise<MiniSearch<any>>[] = []
        for (const dataSchema of dataSchemas) {
            // console.log('calling the index', dataSchema.getLabel(), dataSchema.getUrl())
            promises.push(this.getIndex(dataSchema.getUrl()))
        }

        await Promise.all(promises)
    }

    // public async hotLoadVectorStore(): Promise<void> {
    //     const dataSchemas = getDataSchemas()
    //     this.startProgress((Object.keys(dataSchemas).length+10) * 3)
    //     await this.getVectorStore()
    // }

    protected buildRow(row: any, arrayProperties: string[], storeFields: string[]): any | undefined {
        // Ignore PouchDB design rows
        if (row._id.match('_design')) {
            return
        }

        row.id = row._id
        delete row['_id']

        // Flatten array fields for indexing
        for (const arrayProperty of arrayProperties) {
            if (row[arrayProperty] && row[arrayProperty].length) {
                let j = 0
                for (const arrayItem of row[arrayProperty]) {
                    const arrayItemProperty = `${arrayProperty}_${j}`
                    row[arrayItemProperty] = arrayItem

                    // Make sure this field is stored
                    if (storeFields.indexOf(arrayItemProperty) === -1) {
                        storeFields.push(arrayItemProperty)
                    }

                    // @todo: Make sure the original field isn't stored (`arrayProperty`)
                    j++
                }
            }
        }

        return row
    }

}