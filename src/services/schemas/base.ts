import { CouchDBQuerySchemaType } from "../interfaces"

export interface BaseDataSchema {

    getName(): string
    getUrl(): string
    getRagContent(row: any): string
    getLabel(): string
    getDescription(): string
    getStoreFields(): string[]
    getIndexFields(): string[]
    getDefaultQueryParams(): Partial<CouchDBQuerySchemaType>
    getQuerySchemaString(): string
    getTimestamp(row: any): string
    getTimestampField(): string
    getGroupId(row: any): string | undefined

}