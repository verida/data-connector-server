
export interface ItemsRange {
    startId?: string
    endId?: string
}

export enum ItemsRangeStatus {
    NEW = "new",
    BACKFILL = "backfill"
}

export enum KeywordSearchTimeframe {
    DAY = "day",
    WEEK = "week",
    MONTH = "month",
    QUARTER = "quarter",
    HALF_YEAR = "half-year",
    FULL_YEAR = "full-year",
    ALL = "all"
}