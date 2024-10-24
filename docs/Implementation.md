
# Implementation

## User Data

The long term objective is to pull as much of a user's data as possible, to maximize the personal data they own and control.

In the short term, the focus is on high value structured data (ie: social media posts, health records, financial records). Each type of structured data must be pushed into a common Verida schema (ie: [social/following/schema.json](https://common.schemas.verida.io/social/following/v0.1.0/schema.json)) to maximize interoperability. The raw, original data, is also stored for future reference in the `sourceData` property on each saved record.

Images and video are not yet supported as the Verida Network does not officially support file storage.

## Security Considerations

In an ideal world, a user could connect directly to a third party service and pull their data, without needing an intermediary like this server. However, the vast majority of consumer API's use `OAuth` which require an application to register themselves and maintain a secret key to use the API.

An end user could register their own application and obtain their own API key, however in reality that is an awful user experience and beyond the capabilities of the vast majority. Instead, it's necessary to have a centralized application (this Verida Data Connector Server) to maintain the secret API key and facilitate interactions with each third party API.

All that being said, this server is open source, and this server will be designed to operate within a secure enclave ensuring user data is never seen by anyone, not even the Verida team.

Where possible, API authentication requests are for read only access to data, not write access. (ie: Access to read gmail, but not send emails)

## User Privacy

This server currently receives the Verida account private key via headers, in the future the server will instead receive `accessToken` and `refreshToken` values from the user for each sync request.

User data is fetched on behalf of the user and processed. This processing involves:

- Fetching from third party API
- Temporarily storing the data on disk
- Encrypting the data on disk
- Sending the encrypted data to the Verida network
- Deleting the data from disk

This server only has access to data fetched from the third party API. It can not view the full set of data owned by the user for a given dataset. For example, if this API pulls a user's Twitter posts, it will not have access to any other posts stored in the user's Vault.



## How it Works

### Providers

A `provider` is an implementation of an integration with a third party service (ie: `Discord`). It facilitates:

1. Authenticating a user
2. Handling expired access tokens
3. Handling connection and sync errors
4. Pulling data from the third party service API and transforming it into the relevant Verida common schema(s)

Anyone can create a new provider and submit it via a PR to then be made available to all users of the supported Verida applications that integrate with the Data Connector Server.

### Connecting

Here's the flow for connecting to a new third third party service:

1. Generate a connection URL for the service (ie: `http://127.0.0.1:3000/connect/discord`)
2. Redirect the user to the connection URL
3. Data Connector Server redirects the user to the third party authenticate page (ie: `Discord` authenticate this application page)
4. User successfully authenticates and is redirected to the `http://127.0.0.1:3000/callback/discord` endpoint
5. Data Connector Server handles the callback response to obtain a user `profile` object an any `accessToken` and `refreshToken` from the callback response
6. Data Connector Server redirects the user back to the original application that made the request, providing the `profile`, `accessToken` and `refreshToken`
7. The original application making the request should then save this data so it can make future data synchronization requests

Where this server is running on `127.0.0.1`. (Don't user `localhost`, see `Sessions` below)

### Syncing Data

1. An API request is made to initiate a sync for a given provider (ie: `http://127.0.0.1:3000/syncStart/discord`)
2. This sync request includes the user's `did`, `accessToken`, `refreshToken` and details for an encrypted database to save the new data
3. The Data Connector Server process the request, connects to the remote API with the auth token and creates database entries in the encrypted database
4. Once complete the Data Connector Server updates a status database specifying the status of the sync (`success` / `fail`)
5. The application who initiate the sync request monitors the status database. Once the status is updated, it handles any errors, or if the sync was successful, it migrates the data from the sync database into the user's appropriate `Verida: Vault` database. This ensures the Data Connector Server never gets access to all the user's data, only the data that is sync'd from the remote API.
6. Once data is syncronized from the syncing database to the local applciation database, the reqeusting application notifies the server the sync has completed (ie: `http://127.0.0.1:3000/syncDone/discord`). This allows the server to delete the sync database data. (@todo: Enable the user to do this remotely)

## Implementation Notes

1. The database for a user is shared between connectors. ie: Syncing Twitter and Facebook data with the `followers` schema will push data into the same database. Should they be split?