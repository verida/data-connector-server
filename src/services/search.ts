import { DataService } from "./data"
import { VeridaService } from "./veridaService"
import { SchemaRecord } from "../schemas"
import { IDatastore } from "@verida/types"

export interface MinisearchResult {
    id: string
    score: number
    terms: string[]
    queryTerms: string[]
    match: Record<string, string[]>
}

export interface SearchServiceSchemaResult {
    schemaUri: string
    rows: MinisearchResult[]
}

export interface SortedResult {
    id: string
    schemaId: number
    score: number
}

export enum SearchTypes {
    CHAT_MESSAGES = "https://common.schemas.verida.io/social/chat/message/v0.1.0/schema.json",
    EMAILS = "https://common.schemas.verida.io/social/email/v0.1.0/schema.json"
}

export class SearchService extends VeridaService {

    protected async rankAndMergeResults(schemaResults: SearchServiceSchemaResult[], limit: number, minResultsPerType: number = 10): Promise<SchemaRecord[]> {
        const unsortedResults: Record<string, SortedResult> = {}
        const guaranteedResults: Record<string, SortedResult> = {}

        const datastores: IDatastore[] = []
        for (const schemaResult of schemaResults) {
            let schemaResultCount = 0
            for (const row of schemaResult.rows) {
                // console.log(row.id, row.score)
                const result = {
                    id: row.id,
                    schemaId: datastores.length,
                    score: row.score
                }

                if (schemaResultCount++ < minResultsPerType) {
                    guaranteedResults[row.id] = result
                } else {
                    unsortedResults[row.id] = result
                }
            }

            datastores.push(await this.context.openDatastore(schemaResult.schemaUri))
        }

        const unsortedResultCount = Object.values(unsortedResults).length
        console.log(`Have ${unsortedResultCount} unsorted schema results`)
        if (unsortedResultCount == 0) {
            return []
        }

        // Sort results by score
        const sortedResults = Object.values(unsortedResults)
        sortedResults.sort((a: any, b: any) => b.score - a.score)

        const queuedResults = Object.values(guaranteedResults).concat(sortedResults)

        // Fetch actual results and limit them
        const results = []
        for (let i = 0; i < limit; i++) {
            const result = queuedResults[i]
            const datastore = datastores[result.schemaId]
            const row = await datastore.get(result.id, {})
            row._score = result.score
            results.push(row)
        }

        return results
    }

    public async emails(keywordsList: string[], limit: number = 20): Promise<any[]> {
        const query = keywordsList.join(' ')
        const schemaUri = "https://common.schemas.verida.io/social/email/v0.1.0/schema.json"
        const dataService = new DataService(this.did, this.context)
        const miniSearchIndex = await dataService.getIndex(schemaUri)

        console.log('Emails: searching for', query)
        
        const searchResults = await miniSearchIndex.search(query)
        return this.rankAndMergeResults([{
            schemaUri,
            rows: searchResults
        }], limit)
    }

    public async chatHistory(keywordsList: string[], limit: number = 20): Promise<any[]> {
        const query = keywordsList.join(' ')
        const schemaUri = "https://common.schemas.verida.io/social/chat/message/v0.1.0/schema.json"
        const dataService = new DataService(this.did, this.context)
        const miniSearchIndex = await dataService.getIndex(schemaUri)

        console.log('Chat history: searching for', query)
        
        const searchResults = await miniSearchIndex.search(query)
        return this.rankAndMergeResults([{
            schemaUri,
            rows: searchResults
        }], limit)
    }

    public async multi(searchTypes: SearchTypes[], keywordsList: string[], limit: number = 20, minResultsPerType: number = 10) {
        const query = keywordsList.join(' ')
        const dataService = new DataService(this.did, this.context)

        console.log('Multi: searching for', query)

        const searchResults = []
        for (const schemaUri of searchTypes) {
            const miniSearchIndex = await dataService.getIndex(schemaUri)
            const queryResult = await miniSearchIndex.search(query)
            searchResults.push({
                schemaUri,
                rows: queryResult
            })
        }

        return this.rankAndMergeResults(searchResults, limit, minResultsPerType)
    }

}