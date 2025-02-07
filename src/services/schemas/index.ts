import { BaseDataSchema } from "./base"
import calendarEvent from "./calendarEvent"
import chatGroup from "./chatGroup"
import email from "./email"
import file from "./file"
import following from "./following"
import post from "./post"
import favourite from "./favourite"
import chatMessage from "./chatMessage"

export function getDataSchemas(limitSchemas?: string[]): BaseDataSchema[] {
    const schemaDefs = [calendarEvent, chatGroup, chatMessage, email, file, following, post, favourite]
    if (limitSchemas) {
        const finalSchemas = []
        for (const schemaDef of schemaDefs) {
            if (limitSchemas.indexOf(schemaDef.getUrl()) !== -1) {
                finalSchemas.push(schemaDef)
            }
        }

        return finalSchemas
    } else {
        return schemaDefs
    }
}

export function getDataSchemasDict(limitSchemas?: string[]) {
    const schemas = getDataSchemas(limitSchemas)
    const dataSchemaDict: Record<string, BaseDataSchema> = schemas.reduce((obj, item) => {
        // @ts-ignore
        obj[item.getUrl()] = item
        return obj
    }, {})

    return dataSchemaDict
}