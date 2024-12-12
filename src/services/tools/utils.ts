import { countTokens } from '@anthropic-ai/tokenizer'
import { getDataSchemasDict } from "../schemas"

export function convertRecordsToRAGContext(docs: any, maxTokens: number = 100000): string {
    const dataSchemaDict = getDataSchemasDict()

    maxTokens = 300000

    // Check token count
    let text = ""
    let i = 0
    for (const doc of docs) {
        const dataSchema = dataSchemaDict[doc.schema || doc.schemaUrl]
        const ragText = dataSchema.getRagContent(doc)
        const newText = `${text}\n\n${ragText}`

        if (getTokenCount(newText) > maxTokens) {
            // console.log(`STOPPING: RAG context is ${text.length} characters long with ${getTokenCount(text)} tokens with ${i} docs`)
            return text
        }

        text = newText
        i++
    }

    // console.log(`RAG context is ${text.length} characters long with ${getTokenCount(text)} tokens with ${i} docs`)
    return text
}

export function getTokenCount(text: string) {
    return countTokens(text)
}