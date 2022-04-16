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
2. The `sync` endpoint pulls data from the third party API, converts it into the correct Verida schema, then saves it to a datastore owned and controlled by this server (but readable by the user who made the request). This data is stored, encrypted, on the Verida network. It is also stored, unencrypted on the local disk , until `syncDone` is called by the Vault. `syncDone` calls `destroy()` on the local database, which deletes the files from disk. It's not currently possible to delete from the Storage Node (this will be fixed). I tried calling `destroy()` on the local copy once the `sync` process had completed, but no data ended up in CouchDB. I suspect this is because there hadn't been enough time to sync data between the local copy and the server copy. It could be possible to detect when syncing has completed and then destroy.

