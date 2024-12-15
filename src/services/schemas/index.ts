import { BaseDataSchema } from "./base"
import calendarEvent from "./calendarEvent"
import chatGroup from "./chatGroup"
import email from "./email"
import file from "./file"
import following from "./following"
import post from "./post"
import favourite from "./favourite"
import chatMessage from "./chatMessage"

export function getDataSchemas(): BaseDataSchema[] {
    return [calendarEvent, chatGroup, chatMessage, email, file, following, post, favourite]
}

export function getDataSchemasDict() {
    const schemas = getDataSchemas()
    const dataSchemaDict: Record<string, BaseDataSchema> = schemas.reduce((obj, item) => {
        // @ts-ignore
        obj[item.getUrl()] = item
        return obj
    }, {})

    return dataSchemaDict
}