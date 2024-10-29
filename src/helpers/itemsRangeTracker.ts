
// --/.....---------------/.....---------------
    // first:last,first:last,
    // 0-first,last-first,last-limit
    // ../..................../.....---------------
    // first,last

import { ItemsRange, ItemsRangeStatus } from "./interfaces"

/**
 * Track the messages in a group that have or haven't been fetched
 */
export class ItemsRangeTracker {

    private completedRanges: ItemsRange[] = []
    private status: ItemsRangeStatus = ItemsRangeStatus.NEW

    constructor(completedRangesString?: string) {
        if (completedRangesString) {
            this.import(completedRangesString)
        }
    }

    public import(rangeString: string) {
        try {
            for (const entry of JSON.parse(rangeString)) {
                this.completedRanges.push({
                    startId: entry[0] ? entry[0] : undefined,
                    endId: entry[1] ? entry[1] : undefined,
                })
            }
        } catch (err: any) {
            // Backwards compatible loading of ranges using old format
            const ranges = rangeString.split(',')
            for (const range of ranges) {
                const [ startId, endId ] = range.split(':')
                this.completedRanges.push({
                    startId,
                    endId
                })
            }   
        }
    }

    /**
     * Convert the completed ranges array into a string for saving into the database
     * 
     * @returns 
     */
    public export(): string {
        const entries = []
        for (const range of this.completedRanges) {
            entries.push([range.startId, range.endId])
        }

        return JSON.stringify(entries)
    }

    /**
     * 
     * @param item 
     */
    public updateRange(range: ItemsRange) {
        if (!this.completedRanges.length) {
            return
        }

        if (this.status == ItemsRangeStatus.NEW) {
            this.completedRanges[0].startId = range.endId 
        } else {
            if (range.startId == range.endId) {
                // All interim items have been deleted, so
                // we need to merge the two most recent ranges
                if (this.completedRanges.length > 1) {
                    this.completedRanges[1].startId = this.completedRanges[0].startId
                    this.completedRanges.splice(0,1)
                }
            } else {
                this.completedRanges[0].endId = range.startId

                if (this.completedRanges.length > 1) {
                    this.completedRanges[1].startId = range.endId
                }
            }
        }
    }

    /**
     * Add a completed range to the start of our list
     * 
     * @param item 
     */
    public completedRange(item: ItemsRange, breakPointHit: boolean) {
        // console.log("completedRange()", item, breakPointHit)
        switch (this.status) {
            case ItemsRangeStatus.NEW:
                if (!item.startId && !item.endId) {
                    // No items processed, so do nothing
                } else if (breakPointHit) {
                    // Break point was hit, so we need to merge the completed items
                    // range with the first completed range
                    this.completedRanges[0] = {
                        startId: item.startId,
                        endId: this.completedRanges[0].endId
                    }
                } else {
                    // Break point wasn't hit, so we need to create a new completed range
                    this.completedRanges.unshift(item)
                }
                
                this.status = ItemsRangeStatus.BACKFILL
                break
            case ItemsRangeStatus.BACKFILL:
                const firstRange = this.completedRanges[0]
                const secondRange = this.completedRanges.length > 1 ? this.completedRanges[1] : {}

                if (!firstRange) {
                    break
                }

                if (breakPointHit) {
                    this.completedRanges[1] = {
                        startId: firstRange.startId,
                        endId: secondRange.endId
                    }

                    this.completedRanges.splice(0,1)
                } else {
                    // Break point wasn't hit, so we need to update the first completed range
                    this.completedRanges[0] = {
                        startId: firstRange.startId,
                        endId: item.endId
                    }
                }
                break
        }
    }

    public nextRange(): ItemsRange {
        if (!this.completedRanges || this.completedRanges.length == 0) {
            return {}
        }

        switch (this.status) {
            case ItemsRangeStatus.NEW:
                return {
                    startId: undefined,
                    endId: this.completedRanges[0].startId
                }
            case ItemsRangeStatus.BACKFILL:
                const firstRange = this.completedRanges[0]
                const secondRange = this.completedRanges.length > 1 ? this.completedRanges[1] : {}

                return {
                    startId: firstRange.endId,
                    endId: secondRange.startId
                }
        }

        return {}
    }

}