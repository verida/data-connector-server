# Reddit Connector

The Reddit connector fetches a user's personal reddit data from the past 3 months.

## Handlers

## Known issues

1. Private chat messages are not supported in the official API, see [here](https://www.reddit.com/r/redditdev/comments/17s83sf/chat_api/)

## Refresh Tokens

<!-- TODO -->

## Unit Tests

This repository contains a suite of unit tests designed to test the core Reddit API and to validate the integration of a Reddit account with the provider's synchronization handlers. The tests ensure that the Reddit data is correctly fetched and processed. The unit tests cover the following aspects:

- Fetching and testing Reddit account.
- Fetching and testing Reddit account's subreddits, including where the account has the role of contributor, moderator or subscriber.
- Fetching and testing Reddit account's messages including notifications and private messages.
- Fetching and testing Reddit account's comments
- Fetching and testing Reddit account's interactions e.g. listing(posts, comments, etc.) that the user has upvoted, donwvoted, hidden or saved

### Prerequisites

Before running the unit tests, ensure that you have the following set up:

1. **Reddit Account**: A YouTube account with some activity is required. This activity includes uploaded videos, subscriptions, and liked videos.

2. **Reddit Account Data**: Make sure to have an account with some activity e.g. messages sent/received, comments, etc.
   You can:
   a. create a testing config file with the expected account information e.g. account name, number of messages, etc.
   b. Run the tests with the following expected results

   - **Messages**: An account with more than 50 messages.
   - **Comments**: More than 50 comments by your account.
   - **Posts**: Have at least a post.

3. **Authorized Application**: Make sure to create an authorized `web app` application and fill in the required information in the `serverconfig.local.json`

### Running the Tests

```bash
# To run the API tests
yarn run test tests/providers/reddit/api.test.ts
# To run the handler tests
yarn run test tests/providers/reddit/handlers/*.test.ts
```

## Resources

- [API Overview](https://www.reddit.com/dev/api/)
- [Reddit Passport](https://github.com/Slotos/passport-reddit)
- [OAuth2](https://github.com/reddit-archive/reddit/wiki/OAuth2)
- [API Scopes](https://www.reddit.com/api/v1/scopes)
- []()