
export interface CompletedItemsRange {
    startId?: string
    endId?: string
}

export enum RangeStatus {
    NEW = "new",
    BACKFILL = "backfill"
}