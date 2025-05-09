import { RedditApi } from "./api";
import { Account } from "./types";

export interface TelegramUserProfile {
  fullName: string;
  firstName: string;
  lastName: string;
  username?: string;
}

/**
 * Helper utility to fetch a user object
 */
export class AccountCache {
  private accountCache: Record<string, Account> = {};
  private api: RedditApi;

  constructor(api: RedditApi) {
    this.api = api;
  }

  public async getAccount(userId: string) {
    if (this.accountCache[userId]) {
      return this.accountCache[userId];
    }

    const user = await this.api.getUser(userId);

    this.accountCache[userId] = user;

    return this.accountCache[userId];
  }
}
