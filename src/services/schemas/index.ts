import { BaseDataSchema } from "./base"
import calendarEvent from "./calendarEvent"
import chatGroup from "./chatGroup"
import email from "./email"
import file from "./file"
import following from "./following"
import post from "./post"

export function getDataSchemas(): BaseDataSchema[] {
    return [calendarEvent, chatGroup, email, file, following, post]
}