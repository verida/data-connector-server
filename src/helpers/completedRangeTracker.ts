
// --/.....---------------/.....---------------
    // first:last,first:last,
    // 0-first,last-first,last-limit
    // ../..................../.....---------------
    // first,last

import { CompletedItemsRange, RangeStatus } from "./interfaces"

/**
 * Track the messages in a group that have or haven't been fetched
 */
export class CompletedRangeTracker {

    private completedRanges: CompletedItemsRange[] = []
    private status: RangeStatus = RangeStatus.NEW

    constructor(completedRangesString?: string) {
        if (completedRangesString) {
          const ranges = completedRangesString.split(',')
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
     * 
     * @param item 
     */
    public updateRange(range: CompletedItemsRange) {
        if (!this.completedRanges.length) {
            return
        }

        if (this.status == RangeStatus.NEW) {
            this.completedRanges[0].startId = range.endId 
        } else {
            if (range.startId == range.endId) {
                // All interim items have been deleted, so
                // we need to merge the two most recent ranges
                this.completedRanges[1].startId = this.completedRanges[0].startId
                this.completedRanges.splice(0,1)
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
    public completedRange(item: CompletedItemsRange, breakPointHit: boolean) {
        // console.log("completedRange()", item, breakPointHit)
        switch (this.status) {
            case RangeStatus.NEW:
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
                
                this.status = RangeStatus.BACKFILL
                break
            case RangeStatus.BACKFILL:
                const firstRange = this.completedRanges[0]
                const secondRange = this.completedRanges.length > 1 ? this.completedRanges[1] : {}

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

    public nextRange(): CompletedItemsRange {
        if (!this.completedRanges || this.completedRanges.length == 0) {
            return {}
        }

        switch (this.status) {
            case RangeStatus.NEW:
                return {
                    startId: undefined,
                    endId: this.completedRanges[0].startId
                }
            case RangeStatus.BACKFILL:
                const firstRange = this.completedRanges[0]
                const secondRange = this.completedRanges.length > 1 ? this.completedRanges[1] : {}

                return {
                    startId: firstRange.endId,
                    endId: secondRange.startId
                }
        }

        return {}
    }

    /**
     * Convert the completed ranges array into a string for saving into the database
     * 
     * @returns 
     */
    public export(): string {
        const groups: string[] = []
        for (const item of this.completedRanges) {
            groups.push([item.startId,item.endId].join(':'))
        }

        return groups.join(',')
    }

}