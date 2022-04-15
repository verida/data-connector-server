# Verida Data Connector Server

This server enables the Verida Vault to establish a connection to third party services and pull data that the Vault can sync with the user's datastore.

## Process Flows

### Connect an API

- [ Vault ] -> Open Webpage [ `https://apis.verida.io/connect/facebook?did=0xe14c...` ]
- Webpage redirects [ `https://apis.verida.io/connect/facebook?did=0xe14c...` ] -> Facebook Auth [https://www.facebook.com/auth]
- User completes Facebook auth
- [ Facebook ] -> API auth completion [ `https://apis.verida.io/auth/facebook?refresh_token=abc123` ]
- [ `https://apis.verida.io/auth/facebook` ] -> WebView send response to React Native [ `{ configJson }` ]
- [ Vault ] Handle `onMessage` to pull `{ configJson }` from WebView
- [ Vault ] Close WebView
- [ Vault ] Saves `{ configJson }` to `api-connections` data store
- [ Vault ] Sends API request -> Server API [ `https://apis.verida.io/sync/facebook?did=0xe14c...&config={jsonConfig}&key=eYzfi3a02` ]
- Server API fetches data from Facebook using refresh / auth token in `jsonConfig`
- Server API syncs data for each datastore supported by Facebook. Each datastore is accessed