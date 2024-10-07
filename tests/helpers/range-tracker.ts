const assert = require("assert");
import { ItemsRangeTracker } from "../../src/helpers/itemsRangeTracker"

const batchLimit = 6
const batchSize = 10

function buildBatch(start: number) {
    return Array(batchSize).fill(0).map((_, i) => i+start);
}

function processItems(items: number[], limit: number, breakId?: string, startId?: string): [number[], number[], boolean] {
    const resultItems: number[] = []
    let started = false
    let breakHit = false
    for (const item of items) {
        if (resultItems.length >= limit) {
            break
        }

        if (breakId && item == parseInt(breakId)) {
            breakHit = true
            break
        }

        if (startId && item == parseInt(startId)) {
            started = true
            continue
        }

        if (startId && !started) {
            continue
        }

        resultItems.push(item)
    }

    items.splice(0, resultItems.length)
    return [resultItems, items, breakHit]
}

describe(`Range tracker tests`, function () {

    it(`Can handle starting empty`, () => {
        const tracker = new ItemsRangeTracker()
        const newItems = tracker.nextRange()
        assert.deepEqual(newItems, {}, "New items range is empty")

        const next = tracker.nextRange()
        assert.deepEqual(next, {}, "Next backfill range is empty")
    })

    it(`Can handle completing all`, () => {
        const tracker = new ItemsRangeTracker()
        const batch1 = buildBatch(40)
        let messages: number[] = []

        // message list is 40-49
        messages = messages.concat(batch1)

        // Process the first 20 items (there's only 10, so it will effectively process all)
        const range1 = tracker.nextRange()
        const [ processedBatch1, batch1Remainder, batch1Break ] = processItems(messages, 20, range1.endId, range1.startId)
        assert.deepEqual([40, 41, 42, 43, 44, 45, 46, 47, 48, 49], processedBatch1, 'First batch returned correct items')
        assert.equal(0, batch1Remainder.length, 'First batch has correct number of remaining items')

        // Update the tracker on the items that have been processed
        tracker.completedRange({
            startId: processedBatch1[0].toString(),
            endId: processedBatch1[processedBatch1.length-1].toString(),
        }, batch1Break)

        const trackerExport = tracker.export()
        assert.equal(trackerExport, JSON.stringify([["40", "49"]]), "Tracker has correct exported value after processing all")
    })

    it(`Can handle an unchanged list, in multiple batches`, () => {
        const batch1 = buildBatch(40)

        const tracker = new ItemsRangeTracker()
        let messages: number[] = []

        // message list is 40-49
        messages = messages.concat(batch1)
        
        // Process the first 6 items
        const range1 = tracker.nextRange()
        const [ processedBatch1, batch1Remainder, batch1Break ] = processItems(messages, batchLimit, range1.endId, range1.startId)
        assert.deepEqual([40, 41, 42, 43, 44, 45], processedBatch1, 'First batch returned correct items')
        assert.equal(4, batch1Remainder.length, 'First batch has correct number of remaining items')

        // Update the tracker on the items that have been processed
        tracker.completedRange({
            startId: processedBatch1[0].toString(),
            endId: processedBatch1[processedBatch1.length-1].toString(),
        }, batch1Break)

        // Reset messages
        messages = []
        messages = messages.concat(batch1)

        // Process remaining items
        const range2 = tracker.nextRange()
        const [ processedBatch2, batch2Remainder, batch2Break ] = processItems(messages, batchLimit, range2.endId, range2.startId)
        assert.deepEqual([46, 47, 48, 49], processedBatch2, 'Second batch returned correct items')

        // Update the tracker on the items that have been processed
        tracker.completedRange({
            startId: range2.startId,
            endId: processedBatch2[processedBatch2.length-1].toString(),
        }, batch2Break)
        const trackerExport = tracker.export()
        assert.equal(trackerExport, JSON.stringify([["40", "49"]]), "Tracker has correct exported value after processing two batches")
    })

    it(`Can handle a changing list, in multiple batches`, () => {
        const batch1 = buildBatch(40)
        const batch2 = buildBatch(30)

        let tracker = new ItemsRangeTracker()
        let messages: number[] = []
        let trackerExport

        // message list is 40-49
        messages = messages.concat(batch1)
        
        // Process new items (the first 6 items)
        const range1 = tracker.nextRange()
        const [ processedBatch1, batch1Remainder, batch1Break ] = processItems(messages, batchLimit, range1.endId, range1.startId)
        assert.deepEqual([40, 41, 42, 43, 44, 45], processedBatch1, 'First batch returned correct items')
        assert.equal(4, batch1Remainder.length, 'First batch has correct number of remaining items')

        // Update the tracker on the items that have been processed
        tracker.completedRange({
            startId: processedBatch1[0].toString(),
            endId: processedBatch1[processedBatch1.length-1].toString(),
        }, batch1Break)

        trackerExport = tracker.export()
        assert.equal(trackerExport, JSON.stringify([["40","45"]]), "Tracker has correct exported value after processing one batch")

        // Reset messages, add more
        messages = []
        messages = messages.concat(batch2).concat(batch1)
        
        // Reset tracker to start processing new items
        tracker = new ItemsRangeTracker(tracker.export())
        
        // Process new items (includes new items; 30-39)
        const range2 = tracker.nextRange()
        const [ processedBatch2, batch2Remainder, batch2Break ] = processItems(messages, batchLimit, range2.endId, range2.startId)
        assert.deepEqual([30, 31, 32, 33, 34, 35], processedBatch2, 'Second batch returned correct items')

        // Update the tracker on the items that have been processed
        tracker.completedRange({
            startId: processedBatch2[0].toString(),
            endId: processedBatch2[processedBatch2.length-1].toString(),
        }, batch2Break)

        trackerExport = tracker.export()
        assert.equal(trackerExport, JSON.stringify([["30","35"],["40","45"]]), "Tracker has correct exported value after processing two batches")

        // Reset messages
        messages = []
        messages = messages.concat(batch2).concat(batch1)

        // Reset tracker to start processing new items
        tracker = new ItemsRangeTracker(tracker.export())

        // Process next batch, no new items so should be empty
        const range3 = tracker.nextRange()
        const [ processedBatch3, batch3Remainder, batch3Break ] = processItems(messages, batchLimit, range3.endId, range3.startId)
        assert.deepEqual([], processedBatch3, 'Third batch returned correct items')

        // Update the tracker on the items that have been processed
        tracker.completedRange({
            startId: undefined,
            endId: undefined,
        }, batch3Break)

        // Process next batch
        const range4 = tracker.nextRange()
        const [ processedBatch4, batch4Remainder, batch4Break ] = processItems(messages, batchLimit, range4.endId, range4.startId)
        assert.deepEqual([36, 37, 38, 39], processedBatch4, 'Fourth batch returned correct items')

        // Update the tracker on the items that have been processed
        tracker.completedRange({
            startId: processedBatch4[0].toString(),
            endId: processedBatch4[processedBatch4.length-1].toString(),
        }, batch4Break)

        trackerExport = tracker.export()
        assert.equal(trackerExport, JSON.stringify([["30", "45"]]), "Tracker has correct exported value after processing four batches")

        // range 5 was deleted

        const range6 = tracker.nextRange()
        const [ processedBatch6, batch6Remainder, batch6Break ] = processItems(messages, batchLimit - processedBatch4.length, range6.endId, range6.startId)
        assert.deepEqual([46,47], processedBatch6, 'Sixth batch returned correct items')

        // Update the tracker on the items that have been processed
        tracker.completedRange({
            startId: processedBatch6[0].toString(),
            endId: processedBatch6[processedBatch6.length-1].toString(),
        }, batch6Break)

        trackerExport = tracker.export()
        assert.equal(trackerExport, JSON.stringify([["30","47"]]), "Tracker has correct exported value after processing six batches")

        // Reset messages
        messages = []
        messages = messages.concat(batch2).concat(batch1)

        // Reset tracker to start processing new items
        tracker = new ItemsRangeTracker(tracker.export())

        // Process next batch, no new items so should be empty
        const range7 = tracker.nextRange()
        const [ processedBatch7, batch7Remainder, batch7Break ] = processItems(messages, batchLimit, range7.endId, range7.startId)
        assert.deepEqual([], processedBatch7, 'Seventh batch returned correct items')

        // Update the tracker on the items that have been processed
        tracker.completedRange({
            startId: undefined,
            endId: undefined,
        }, batch7Break)

        // Process next batch
        const range8 = tracker.nextRange()
        const [ processedBatch8, batch8Remainder, batch8Break ] = processItems(messages, batchLimit, range8.endId, range8.startId)
        assert.deepEqual([48,49], processedBatch8, 'Eighth batch returned correct items')

        // Update the tracker on the items that have been processed, set breakPointHit = true
        trackerExport = tracker.export()
        tracker.completedRange({
            startId: processedBatch8[0].toString(),
            endId: processedBatch8[processedBatch8.length-1].toString(),
        }, batch8Break)

        trackerExport = tracker.export()
        assert.equal(trackerExport, JSON.stringify([["30","49"]]), "Tracker has correct exported value after processing eight batches")

        // Insert a single item at the start and several at the end, they are processed correctly

        // Reset messages
        messages = []
        messages = messages.concat([29]).concat(batch2).concat(batch1).concat([50,51,52,53,54,55,56,57,58,59])
        
        // Reset tracker to start processing new items
        tracker = new ItemsRangeTracker(tracker.export())

        // Process next batch of new items (1)
        const range9 = tracker.nextRange()
        const [ processedBatch9, batch9Remainder, batch9Break ] = processItems(messages, batchLimit, range9.endId, range9.startId)
        assert.deepEqual([29], processedBatch9, 'Ninth batch returned correct items')

        // Update the tracker on the items that have been processed
        tracker.completedRange({
            startId: processedBatch9[0].toString(),
            endId: processedBatch9[processedBatch9.length-1].toString(),
        }, batch9Break)

        // Process next batch
        const range10 = tracker.nextRange()
        const [ processedBatch10, batch10Remainder, batch10Break ] = processItems(messages, batchLimit, range10.endId, range10.startId)
        assert.deepEqual([50,51,52,53,54,55], processedBatch10, 'Tenth batch returned correct items')

        // Update the tracker on the items that have been processed
        trackerExport = tracker.export()
        tracker.completedRange({
            startId: processedBatch10[0].toString(),
            endId: processedBatch10[processedBatch10.length-1].toString(),
        }, batch10Break)

        trackerExport = tracker.export()
        assert.equal(trackerExport, JSON.stringify([["29","55"]]), "Tracker has correct exported value after processing ten batches")

    })

})