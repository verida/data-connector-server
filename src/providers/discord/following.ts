import { SyncSchemaPosition } from "../../interfaces"
import BaseSyncHandler from "../BaseSyncHandler"
const _ = require('lodash')

const log4js = require("log4js")
const logger = log4js.getLogger()

//import { Client } from 'discord.js'

export default class Following extends BaseSyncHandler {

    protected static schemaUri: string = 'https://common.schemas.verida.io/social/following/v0.1.0/schema.json'

    public getName(): string {
        return 'following'
    }

    /**
     * @todo: Support paging through all results
     * @todo: Correctly support `this.config.limitResults`
     * 
     * @param api 
     */
    public async sync(api: any, syncPosition: SyncSchemaPosition): Promise<any> {
        const guildResponse: any = await api.get('/users/@me/guilds')
        console.log(syncPosition)

        const now = (new Date()).toISOString()
        const guilds: any = []
        for (let i in guildResponse) {
            try {
                const guildItem = guildResponse[i]
                console.log('Processing', guildItem.name)
                /*
                    Note: It's not possible to fetch followedTimestamp. It appears Discord rate limiting is
                    really extreme and only allows 5 requests per minute.

                    const guildMemberInfo = await api.get(`/users/@me/guilds/${guildItem.id}/member`)
                    const followedTimestamp = guildMemberInfo.joined_at
                */

                const guildIcon = api.cdn.icon(guildItem.id, guildItem.icon)
                const guildEntry: any = {
                    _id: `discord-${guildItem.id}`,
                    name: guildItem.name,
                    icon: guildIcon,
                    summary: `Discord guild: ${guildItem.name}`,
                    //uri: Discord doesn't support URL's for servers
                    sourceApplication: 'https://discord.com/',
                    sourceId: guildItem.id,
                    //followedTimestamp: now,
                    insertedAt: now
                }

                guilds.push(guildEntry)
            } catch (err) {
                console.log(err)
            }
        }

        return guilds
    }
}