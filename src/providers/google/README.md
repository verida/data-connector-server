
# Notes

`pdf-parse` is used to convert PDF files to text so their contents can be searched. There is a bug in the library that causes this message to be output to the console when fonts can't be found: `Warning: TT: undefined function: 32` (see https://github.com/mozilla/pdf.js/issues/3768#issuecomment-36468349)

## Refresh Tokens

Google only provides a `refreshToken` when a user first connects their account. If the user attempts to reconnect, the second OAuth process will only return an `accessToken`.

# YouTube Integration Unit Tests

This repository contains a suite of unit tests designed to validate the integration of a YouTube account with the provider's synchronization handlers. The tests ensure that the YouTube data is correctly fetched and processed. The unit tests cover the following aspects:

- Fetching and testing YouTube favorites.
- Fetching and testing YouTube following (subscriptions).
- Fetching and testing YouTube posts (uploaded videos).

## Prerequisites

Before running the unit tests, ensure that you have the following set up:

1. **YouTube Account**: A YouTube account with some activity is required. This activity includes uploaded videos, subscriptions, and liked videos.

2. **YouTube Data**: Make sure your YouTube account has:
   - **Favorites**: At least 7 videos you have liked.
   - **Following**: At least 7 Channels you have subscribed to.
   - **Posts**: At least 7 videos you have uploaded.
3. **Activity**: Make sure you have made activities within the last 24 hours.

## Running the Tests

```bash
yarn run test tests/providers/google/youtube-[xxx].tests.ts
