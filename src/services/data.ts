import { IContext, IDatastore } from '@verida/types';
import * as CryptoJS from 'crypto-js';
import { EventEmitter } from 'events'
import MiniSearch, { SearchOptions, SearchResult } from 'minisearch';

export const indexCache: Record<string, MiniSearch<any>> = {}

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

const schemas: Record<string, SchemaConfig> = {
    "https://common.schemas.verida.io/social/following/v0.1.0/schema.json": {
        label: "Social Following",
        storeFields: ['_id', 'name','uri','description','insertedAt','followedTimestamp'],
        indexFields: ['name','description','sourceApplication']
    },
    "https://common.schemas.verida.io/social/post/v0.1.0/schema.json": {
        label: "Social Posts",
        storeFields: ['_id', 'name','content','type','uri','insertedAt'],
        indexFields: ['name', 'content', 'indexableText','sourceApplication']
    },
    "https://common.schemas.verida.io/social/email/v0.1.0/schema.json": {
        label: "Email",
        storeFields: ['_id', 'sentAt'],
        indexFields: ['name','fromName','fromEmail','messageText','attachments_0.textContent','attachments_1.textContent','attachments_2.textContent', 'indexableText', 'sentAt','sourceApplication']
    },
    "https://common.schemas.verida.io/social/chat/message/v0.1.0/schema.json": {
        label: "Chat Message",
        storeFields: ['_id', 'groupId', 'sentAt'],
        indexFields: ['messageText', 'fromHandle', 'fromName', 'groupName', 'indexableText', 'sentAt','sourceApplication']
    },
    "https://common.schemas.verida.io/favourite/v0.1.0/schema.json": {
        label: "Favorite",
        storeFields: ['_id', 'insertedAt'],
        indexFields: ['name', 'favouriteType', 'contentType', 'summary','sourceApplication']
    },
    "https://common.schemas.verida.io/file/v0.1.0/schema.json": {
        label: "File",
        storeFields: ['_id', 'insertedAt'],
        indexFields: ['name', 'contentText', 'indexableText', 'sourceApplication', "modifiedAt", "insertedAt"]
    },
    "https://common.schemas.verida.io/social/event/v0.1.0/schema.json": {
        label: "Calendar Event",
        storeFields: ['_id', 'insertedAt'],
        // @todo: Support indexing attachments, creator, organizer and attendees
        indexFields: ['name', 'description', 'location', 'status', "modifiedAt", "insertedAt"]
    }
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

    public async getIndex(schemaUri: string, indexFields?: string[], storeFields?: string[]): Promise<MiniSearch<any>> {
        const schemaConfig = schemas[schemaUri]
        indexFields = [...(indexFields || schemaConfig.indexFields)]
        storeFields = [...(storeFields || schemaConfig.storeFields)]

        const cacheKey = CryptoJS.MD5(`${this.did}:${schemaUri}:${indexFields.join(',')}:${storeFields.join(',')}`).toString()

        if (!indexCache[cacheKey]) {
            this.emitProgress(schemaConfig.label, HotLoadStatus.StartData, 10)
            const datastore = await this.context.openDatastore(schemaUri)

            const database = await datastore.getDb()
            const pouchDb = await database.getDb()
            const result = await pouchDb.allDocs({
                include_docs: true,
                attachments: false
            });

            this.emitProgress(schemaConfig.label, HotLoadStatus.StartIndex, 10)
            
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

            this.emitProgress(schemaConfig.label, HotLoadStatus.Complete, 10)

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
            this.emitProgress(schemaConfig.label, HotLoadStatus.Complete, 10)
        }

        return indexCache[cacheKey]
    }

    public async hotLoad(): Promise<void> {
        this.startProgress(Object.keys(schemas).length * 3)

        const promises: Promise<MiniSearch<any>>[] = []
        for (const schemaUri of Object.keys(schemas)) {
            promises.push(this.getIndex(schemaUri))
        }

        await Promise.all(promises)
    }

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
                    if (!arrayItem.filename.match('pdf')) {
                        continue
                    }

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