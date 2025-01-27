import axios from 'axios';
import { SchemaSocialChatGroup } from '../../schemas';

export class SlackHelpers {
  // Method to fetch user information using Slack's `users.info` API
  static async getUserInfo(accessToken: string, userId: string) {
    try {
      const response = await axios.get('https://slack.com/api/users.info', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        params: {
          user: userId  // The target user's Slack ID
        }
      });

      if (response.data.ok) {
        return response.data.user;  // Return user profile info
      } else {
        throw new Error(`Slack API Error: ${response.data.error}`);
      }
    } catch (error) {
      throw new Error(`Failed to fetch user info: ${error.message}`);
    }
  }

  // Helper function to fetch user info for all unique user IDs in parallel
  static async fetchUserInfoBulk(accessToken: string, userIds: string[]): Promise<{ [key: string]: any }> {
    const promises = userIds.map((userId) =>
      this.getUserInfo(accessToken, userId)
    );
    const results = await Promise.all(promises);

    // Map user info by userId
    const userInfoMap: { [key: string]: any } = {};
    results.forEach((userInfo, index) => {
      userInfoMap[userIds[index]] = userInfo;
    });

    return userInfoMap;
  }

  static getGroupPositionIndex(
    groupList: SchemaSocialChatGroup[],
    groupId: string|undefined
  ): number {
    const groupPosition = groupList.findIndex(
      (group) => group.sourceId === groupId
    );

    // If not found, return 0 to start from the beginning
    return groupPosition === -1 ? 0 : groupPosition;
  }
}
