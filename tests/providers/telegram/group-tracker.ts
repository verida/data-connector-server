const assert = require("assert");
import { GroupTracker } from "../../../src/providers/telegram/groupTracker";

const batchLimit = 6
const batchSize = 10

function buildBatch(start: number) {
    return Array(batchSize).fill(0).map((_, i) => i+start);
}

function processItems(items: number[], limit: number, breakId?: number): [number[], number[]] {
    const resultItems: number[] = []
    for (const item of items) {
        if (breakId && item == breakId) {
            break
        }

        if (resultItems.length >= limit) {
            break
        }

        resultItems.push(item)
    }

    items.splice(0, resultItems.length)
    return [resultItems, items]
}

describe(`Group tracker tests`, function () {

    it(`Can handle starting empty`, () => {
        const tracker = new GroupTracker()
        const next = tracker.nextRange()

        assert.deepEqual({
            startId: "0",
        }, next, "Next range is the start with no end")
    })

    it(`Can handle starting empty`, () => {
        const batch1 = buildBatch(40)
        const batch2 = buildBatch(30)
        const batch3 = buildBatch(20)

        const tracker = new GroupTracker()
        const next = tracker.nextRange()
        let messages: number[] = []
        messages = messages.concat(batch1)
        
        const [ processedBatch1, batch1Remainder ] = processItems(messages, batchLimit, next.endId ? parseInt(next.endId) : undefined)
        console.log(processedBatch1, batch1Remainder)

        assert.deepEqual([40, 41, 42, 43, 44, 45], processedBatch1, 'First batch returned correct items')

        // add the next batch
        messages = batch2.concat(batch1Remainder)
        console.log(messages)

        // tracker.addRange({
        //     startId: "0",
        //     endId: processedBatch1[0].toString()
        // })
    })

})