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