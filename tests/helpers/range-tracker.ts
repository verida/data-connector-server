const assert = require("assert");
import { CompletedRangeTracker } from "../../src/helpers/completedRangeTracker";

const batchLimit = 6
const batchSize = 10

function buildBatch(start: number) {
    return Array(batchSize).fill(0).map((_, i) => i+start);
}

function processItems(items: number[], limit: number, breakId?: string, startId?: string): [number[], number[]] {
    const resultItems: number[] = []
    let started = false
    for (const item of items) {
        if (breakId && item == parseInt(breakId)) {
            break
        }

        if (startId && item == parseInt(startId)) {
            started = true
            continue
        }

        if (startId && !started) {
            continue
        }

        if (resultItems.length >= limit) {
            break
        }

        resultItems.push(item)
    }

    items.splice(0, resultItems.length)
    return [resultItems, items]
}

describe(`Range tracker tests`, function () {

    it(`Can handle starting empty`, () => {
        const tracker = new CompletedRangeTracker()
        const newItems = tracker.newItemsRange()
        assert.deepEqual(newItems, {}, "New items range is empty")

        const next = tracker.nextBackfillRange()
        assert.deepEqual(next, {}, "Next backfill range is empty")
    })

    it(`Can handle completing all`, () => {
        const tracker = new CompletedRangeTracker()
        const batch1 = buildBatch(40)
        let messages: number[] = []

        // message list is 40-49
        messages = messages.concat(batch1)

        // Process the first 20 items (there's only 10, so it will effectively process all)
        const range1 = tracker.newItemsRange()
        const [ processedBatch1, batch1Remainder ] = processItems(messages, 20, range1.endId, range1.startId)
        assert.deepEqual([40, 41, 42, 43, 44, 45, 46, 47, 48, 49], processedBatch1, 'First batch returned correct items')
        assert.equal(0, batch1Remainder.length, 'First batch has correct number of remaining items')

        // Update the tracker on the items that have been processed
        tracker.completedRange({
            startId: processedBatch1[0].toString(),
            endId: processedBatch1[processedBatch1.length-1].toString(),
        }, false)

        const trackerExport = tracker.export()
        assert.equal(trackerExport, "40:49", "Tracker has correct exported value after processing all")
    })

    it(`Can handle an unchanged list, in multiple batches`, () => {
        const batch1 = buildBatch(40)

        const tracker = new CompletedRangeTracker()
        let messages: number[] = []

        // message list is 40-49
        messages = messages.concat(batch1)
        
        // Process the first 6 items
        const range1 = tracker.newItemsRange()
        const [ processedBatch1, batch1Remainder ] = processItems(messages, batchLimit, range1.endId, range1.startId)
        assert.deepEqual([40, 41, 42, 43, 44, 45], processedBatch1, 'First batch returned correct items')
        assert.equal(4, batch1Remainder.length, 'First batch has correct number of remaining items')

        // Update the tracker on the items that have been processed
        tracker.completedRange({
            startId: processedBatch1[0].toString(),
            endId: processedBatch1[processedBatch1.length-1].toString(),
        }, false)

        // Reset messages
        messages = []
        messages = messages.concat(batch1)
        
        // Process any new items (there are none)
        const range2 = tracker.newItemsRange()
        const [ processedBatch2, batch2Remainder ] = processItems(messages, batchLimit, range2.endId, range2.startId)
        assert.deepEqual([], processedBatch2, 'Second batch returned correct items')

        // Process remaining items
        const range3 = tracker.nextBackfillRange()
        const [ processedBatch3, batch3Remainder ] = processItems(messages, batchLimit, range3.endId, range3.startId)
        assert.deepEqual([46, 47, 48, 49], processedBatch3, 'Third batch returned correct items')

        // Update the tracker on the items that have been processed
        tracker.completedRange({
            startId: processedBatch3[0].toString(),
            endId: processedBatch3[processedBatch3.length-1].toString(),
        }, true)
        const trackerExport = tracker.export()
        assert.equal(trackerExport, "40:49", "Tracker has correct exported value after processing two batches")
    })

    it(`Can handle a changing list, in multiple batches`, () => {
        const batch1 = buildBatch(40)
        const batch2 = buildBatch(30)

        const tracker = new CompletedRangeTracker()
        let messages: number[] = []
        let trackerExport

        // message list is 40-49
        messages = messages.concat(batch1)
        
        // Process new items (the first 6 items)
        const range1 = tracker.newItemsRange()
        const [ processedBatch1, batch1Remainder ] = processItems(messages, batchLimit, range1.endId, range1.startId)
        assert.deepEqual([40, 41, 42, 43, 44, 45], processedBatch1, 'First batch returned correct items')
        assert.equal(4, batch1Remainder.length, 'First batch has correct number of remaining items')

        // Update the tracker on the items that have been processed
        tracker.completedRange({
            startId: processedBatch1[0].toString(),
            endId: processedBatch1[processedBatch1.length-1].toString(),
        }, false)

        trackerExport = tracker.export()
        assert.equal(trackerExport, "40:45", "Tracker has correct exported value after processing one batch")

        // Reset messages, add more
        messages = []
        messages = messages.concat(batch2).concat(batch1)
        
        // Process new items (includes new items; 30-39)
        const range2 = tracker.newItemsRange()
        const [ processedBatch2, batch2Remainder ] = processItems(messages, batchLimit, range2.endId, range2.startId)
        assert.deepEqual([30, 31, 32, 33, 34, 35], processedBatch2, 'Second batch returned correct items')

        // Update the tracker on the items that have been processed
        trackerExport = tracker.export()
        tracker.completedRange({
            startId: processedBatch2[0].toString(),
            endId: processedBatch2[processedBatch2.length-1].toString(),
        }, false)

        trackerExport = tracker.export()
        assert.equal(trackerExport, "30:35,40:45", "Tracker has correct exported value after processing two batches")

        // Reset messages
        messages = []
        messages = messages.concat(batch2).concat(batch1)

        // Process next batch, no new items so should be empty
        const range3 = tracker.newItemsRange()
        const [ processedBatch3, batch3Remainder ] = processItems(messages, batchLimit, range3.endId, range3.startId)
        assert.deepEqual([], processedBatch3, 'Third batch returned correct items')

        // Process next batch
        trackerExport = tracker.export()
        const range4 = tracker.nextBackfillRange()
        const [ processedBatch4, batch4Remainder ] = processItems(messages, batchLimit, range4.endId, range4.startId)
        assert.deepEqual([36, 37, 38, 39], processedBatch4, 'Fourth batch returned correct items')

        // Update the tracker on the items that have been processed, set breakPointHit = true
        tracker.completedRange({
            startId: processedBatch4[0].toString(),
            endId: processedBatch4[processedBatch4.length-1].toString(),
        }, true)

        trackerExport = tracker.export()
        assert.equal(trackerExport, "30:39,40:45", "Tracker has correct exported value after processing four batches")

        // Process next batch because we didn't hit our batchLimit
        const range5 = tracker.nextBackfillRange()
        const [ processedBatch5, batch5Remainder ] = processItems(messages, batchLimit - processedBatch4.length, range5.endId, range5.startId)
        // Note: We have no results between items IDs 39-40, so empty results and we hit our breakpoint
        assert.deepEqual([], processedBatch5, 'Fifth batch returned correct items')

        // Update the tracker on the items that have been processed, set breakPointHit = true
        tracker.completedRange({
            startId: range5.startId,
            endId: range5.endId,
        }, true)

        const range6 = tracker.nextBackfillRange()
        const [ processedBatch6, batch6Remainder ] = processItems(messages, batchLimit - processedBatch4.length, range6.endId, range6.startId)
        assert.deepEqual([46,47], processedBatch6, 'Sixth batch returned correct items')

        // Update the tracker on the items that have been processed
        tracker.completedRange({
            startId: range6.startId,    // Use the start ID so merging works
            endId: processedBatch6[processedBatch6.length-1].toString(),
        }, false)

        trackerExport = tracker.export()
        assert.equal(trackerExport, "30:47", "Tracker has correct exported value after processing six batches")

        // Reset messages
        messages = []
        messages = messages.concat(batch2).concat(batch1)

        // Process next batch, no new items so should be empty
        const range7 = tracker.newItemsRange()
        const [ processedBatch7, batch7Remainder ] = processItems(messages, batchLimit, range7.endId, range7.startId)
        assert.deepEqual([], processedBatch7, 'Seventh batch returned correct items')

        // Process next batch
        const range8 = tracker.nextBackfillRange()
        const [ processedBatch8, batch8Remainder ] = processItems(messages, batchLimit, range8.endId, range8.startId)
        assert.deepEqual([48,49], processedBatch8, 'Eighth batch returned correct items')

        // Update the tracker on the items that have been processed, set breakPointHit = true
        trackerExport = tracker.export()
        tracker.completedRange({
            startId: range8.startId,    // Use the start ID so merging works
            endId: processedBatch8[processedBatch8.length-1].toString(),
        }, false)

        trackerExport = tracker.export()
        assert.equal(trackerExport, "30:49", "Tracker has correct exported value after processing eight batches")
    })

})