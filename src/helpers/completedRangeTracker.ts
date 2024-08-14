
// --/.....---------------/.....---------------
    // first:last,first:last,
    // 0-first,last-first,last-limit
    // ../..................../.....---------------
    // first,last

import { CompletedItemsRange } from "./interfaces"

/**
 * Track the messages in a group that have or haven't been fetched
 */
export class CompletedRangeTracker {

    private completedRanges: CompletedItemsRange[] = []

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
     * Add a completed range to the start of our list
     * 
     * @param item 
     */
    public completedRange(item: CompletedItemsRange, breakPointHit: boolean) {
        if (breakPointHit) {
            // Break point was hit indicating this range of items reached the
            // breakId of the current range.
            // In this case we need to build a merged range that incorporates the
            // recently completed range with the previously completed range
            const previousRange = this.completedRanges.splice(0, 1)
            const newRange = {
                startId: previousRange[0].startId,
                endId: item.endId
            }

            if (this.completedRanges.length && newRange.endId == this.completedRanges[0].startId) {
                // Merge ranges
                this.completedRanges[0] = {
                    startId: newRange.startId,
                    endId: this.completedRanges[0].endId
                }
            } else {
                this.completedRanges.unshift(newRange)
            }
        } else {
            if (this.completedRanges.length && item.startId == this.completedRanges[0].endId) {
                // Merge ranges
                this.completedRanges[0] = {
                    startId: this.completedRanges[0].startId,
                    endId: item.endId
                }
            } else {
                // Break point wasn't hit, so we just pre-pend this completed range
                this.completedRanges.unshift(item)
            }
        }
    }

    /**
     * Pull the range that will fetch any new items
     * 
     * @returns 
     */
    public newItemsRange(): CompletedItemsRange {
        if (!this.completedRanges || this.completedRanges.length == 0) {
            return {}
        }

        return {
            startId: undefined,
            endId: this.completedRanges[0].startId
        }
    }

    /**
     * Pull the next backfill range to process
     * 
     * @returns 
     */
    public nextBackfillRange(): CompletedItemsRange {
        if (!this.completedRanges || this.completedRanges.length == 0) {
            return {}
        }

        const firstRange = this.completedRanges[0]
        const secondRange = this.completedRanges.length > 1 ? this.completedRanges[1] : {}

        return {
            startId: firstRange.endId,
            endId: secondRange.startId
        }
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

// batch start
// addStart(0)
// = (0,undefined)
// nextRange() = (0,undefined)
// = ..empty
// process 20
// addRange(0,firstMsgId)
// addRange(lastMsgId,undefined)
// = (0,firstMsgId),(lastMsgId,undefined)
// - batch end
// nextRange() = (0,firstMsgId)
// process 20
// addRange(0,firstMsgId2)
// addRange(lastMsgId2, firstMsgId)
// = (0,firstMsgId2),(lastMsgId2,firstMsgId),(lastMsgId,undefined)
// 
// - batch end