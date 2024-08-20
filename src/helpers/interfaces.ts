
export interface ItemsRange {
    startId?: string
    endId?: string
}

export enum ItemsRangeStatus {
    NEW = "new",
    BACKFILL = "backfill"
}