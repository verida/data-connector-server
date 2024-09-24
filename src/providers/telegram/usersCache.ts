import { TelegramApi } from "./api"

export interface TelegramUserProfile {
    fullName: string
    firstName: string
    lastName: string
    username?: string
}

/**
 * Helper utility to fetch a user object
 */
export class UsersCache {

    private userCache: Record<number, TelegramUserProfile> = {}
    private api: TelegramApi

    constructor(api: TelegramApi) {
        this.api = api
    }

    public async getUser(userId: number) {
        if (this.userCache[userId]) {
            return this.userCache[userId]
        }

        const user = await this.api.getUser(userId)
        this.userCache[userId] = {
            fullName: `${user.first_name} ${user.last_name}`,
            firstName: user.first_name,
            lastName: user.last_name,
            username: user.usernames && user.usernames.active_usernames ? user.usernames.active_usernames[0] : undefined
        }

        return this.userCache[userId]
    }

}