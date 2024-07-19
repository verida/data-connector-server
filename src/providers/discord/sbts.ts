import BaseSyncHandler from "../BaseSyncHandler"
import { SyncSchemaPosition } from "../../interfaces"
import { REST } from 'discord.js'
import DiscordProvider from "."
const _ = require('lodash')

// import dayjs from 'dayjs'
//const log4js = require("log4js")
//const logger = log4js.getLogger()

export default class SBTs extends BaseSyncHandler {
    protected static schemaUri: string = 'https://common.schemas.verida.io/credential/base/v0.2.0/schema.json'

    /**
     * @todo: Support paging through all results
     * @todo: Correctly support `this.config.limitResults`
     * 
     * @param api 
     */
    public async sync(api: REST, syncPosition: SyncSchemaPosition): Promise<any> {
        console.log('fetching sbt credentials to sync')

        const guildResponse: any = await api.get('/users/@me/guilds')

        //const genericApi = new REST({ version: '10', authPrefix: 'Bearer' }).setToken(provider.getConfig());
        
        const guilds = {}
        return guilds
        for (let i in guildResponse) {
            try {
                const guildItem = guildResponse[i]
                console.log('fetching member guild info for ', guildItem.name)
                const guildMemberInfo = await api.get(`/users/@me/guilds/${guildItem.id}/member`)
                console.log('fetching guild info for ', guildItem.name)
                const guildInfo = await api.get(`/guilds/${guildItem.id}`)
                console.log(guildItem, guildMemberInfo, guildInfo)
            } catch (err) {
                console.log(err)
            }
        }

        return guilds
        /*console.log('following.sync()')
        console.log(syncConfig)
        const me = await api.v2.me()
        const limit = syncConfig.limit ? syncConfig.limit : this.config.followingLimit
        const sinceId = syncConfig.sinceId ? syncConfig.sinceId.substring(8) : undefined
        console.log('limit', limit)
        console.log('sinceId', sinceId)

        const followingResult = await api.v2.following(me.data.id, {
            'user.fields': ['profile_image_url', 'description'],
            asPaginator: true
        })

        const results = []
        const now = (new Date()).toISOString()
        for await (const user of followingResult) {
            if (sinceId && user.id == sinceId) {
                console.log('latest user id found, exiting')
                break
            }

            // Iterate until rate limit is hit
            // or API calls returns no more results

            //console.log(user)

            results.push({
                _id: `twitter-${user.id}`,
                name: user.name,
                icon: user.profile_image_url,
                summary: user.description.substring(0,256),
                uri: `https://twitter.com/${user.username}`,
                sourceApplication: 'https://twitter.com/',
                sourceId: user.id,
                // twitter doesn't support a timestamp on when the user
                // was followed, so set to current timestamp
                followedTimestamp: now,
                insertedAt: now
            })

            if (results.length >= limit) {
                break
            }
        }

        console.log('returning following results:', results.length)
        return results*/
    }

}