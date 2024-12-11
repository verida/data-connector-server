import { encoding_for_model } from 'tiktoken';
import { getDataSchemasDict } from "../schemas"

export function convertRecordsToRAGContext(docs: any, maxTokens: number = 100000): string {
    const dataSchemaDict = getDataSchemasDict()

    // Check token count
    let text = ""
    let i = 0
    for (const doc of docs) {
        const dataSchema = dataSchemaDict[doc.schema]
        const ragText = dataSchema.getRagContent(doc)
        const newText = `${text}\n\n${ragText}`

        if (getTokenCount(newText) > maxTokens) {
            return text
        }

        text = newText
        i++
    }

    // console.log(`RAG context is ${text.length} characters long with ${getTokenCount(text)} tokens with ${i} docs`)
    return text
}

export function getTokenCount(text: string) {
    const enc = encoding_for_model("gpt-4")
    return enc.encode(text).length;
}