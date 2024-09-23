import axios from 'axios';

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
}
