
// --/.....---------------/.....---------------
    // first:last,first:last,
    // 0-first,last-first,last-limit
    // ../..................../.....---------------
    // first,last

import { TelegramChatGroupBacklogRange } from "./interfaces"

/**
 * Track the messages in a group that have or haven't been fetched
 */
export class GroupTracker {

    private groupBacklog: TelegramChatGroupBacklogRange[] = []

    constructor(backlogIds?: string) {
        if (backlogIds) {
          const backlogItems = backlogIds.split(',')
          for (const item of backlogItems) {
            const [ startId, endId ] = item.split(':')
            this.groupBacklog.push({
              startId,
              endId
            })
          }
        }
    }

    public addRange(item: TelegramChatGroupBacklogRange) {
        this.groupBacklog.unshift(item)
    }

    public nextRange(): TelegramChatGroupBacklogRange {
        if (!this.groupBacklog || this.groupBacklog.length == 0) {
            return {
                startId: "0"
            }
        }

        const next = this.groupBacklog.splice(0, 1)
        return next[0]
    }

    public export(): string {
        const groups: string[] = []
        for (const item of this.groupBacklog) {
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