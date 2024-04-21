# Verida Data Connector Server

This server enables the Verida Vault to establish a connection to third party services and pull data that the Vault can sync with the user's datastore.

## Process Flows

### Connect an API (Facebook as an example)

- [ Vault ] -> Open Webpage in Browser [ `https://apis.verida.io/connect/facebook?did=0xe14c...` ]
- Webpage redirects [ `https://apis.verida.io/connect/facebook?did=0xe14c...` ] -> Facebook Auth [https://www.facebook.com/auth]
- User completes Facebook auth
- [ Facebook ] -> API auth completion [ `https://apis.verida.io/auth/facebook?auth_token=abc123` ]
- User is shown a success page with a button to complete the auth. Clicking this button opens a deep link in the Vault to complete the authorization process and initiate the first sync. Provices `{ configJson }` with config info on the connection (ie: access / refresh tokens)
- [ Vault ] Saves `{ configJson }` to `api-connections` data store
- [ Vault ] Sends API request -> Server API [ `https://apis.verida.io/sync/facebook?did=0xe14c...&config={jsonConfig}&key=eYzfi3a02` ]
- Server API fetches data from Facebook using refresh / auth token in `jsonConfig`
- Server API syncs data for each datastore supported by Facebook.
- The Vault is notified when this is complete and then syncs the data from the server datastore(s) to the vault datastore(s).

## Implementation comments

1. The database for a user is shared between conenctors. ie: Sync Facebook and Sync Facebook data using the `followers` schema and data will be pushed into the same database for both. Should they be split?

## Security

This server is designed to receive `accessToken` and `refreshToken` values from the user for each sync request. These credentials are not stored on the server.

User data is fetched on behalf of the user and processed. This processing involves:

- Fetching from third party API
- Temporarily storing the data on disk
- Encrypting the data on disk
- Sending the encrypted data to a CouchDB server where this server and the user has `read` / `write` access
- Deleting the data from disk

This server only has access to data fetched from the third party API. It can not view the full set of data owned by the user for a given dataset. For example, if this API pulls a user's Twitter posts, it will not have access to any other posts stored in the user's Vault.

# Development

## Sessions

Sessions are used to track `redirect` URLs in the connection request. Sessions **do not** work locally if you specify `localhost` for the hostname. Use an IP address instead.