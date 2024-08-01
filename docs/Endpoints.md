# API Endpoints

## GET `/providers`

Obtain a list of all providers.

Example response:

```json
{
    "google": {
        "name": "google",
        "label": "Google",
        "icon": "http://localhost/assets/google/icon.png",
        "description": "Google supports many services; Gmail, Youtube etc.",
        "handlers": {
            "gmail": [{
                "name": "backdate",
                "label": "Backdate history",
                "type": "enum",
                "enumOptions": ["1 month", "3 months", "6 months", "12 months"],
                "defaultValue": "3 months"
            }]
        }
    },
    "facebook": {
        "name": "facebook",
        "label": "Facebook",
        "icon": "http://localhost/assets/facebook/icon.png",
        "description": "Sync your posts and who you follow",
        "options": []
    }
}
```

The `handlers` object lists the configuration options available for each handler for a given provider. These options need to be presented to the user in the interface, so the user can choose their preferences for the handler syncronization.

## GET `/connect/:provider?key=<key>&did=<did>`

Establish a connection to a provider. The connection credentials (ie: `access_token`, `refresh_token` are saved into the identities `connection` datastore in the Verida Vault)

Query parameters:

1. `key` (required)  Seed phrase (or private key) that controls the DID (ie :`0x...` or `work house ...`)
2. `did` (required)  DID of the identity to sync (ie: `did:vda:polamoy:0x....`)

Example request:

```
http://127.0.01:5021/connect/facebook?key=0x..&did=0x..
```

_Note: The `Connect` [command line tool](./CLI.md) will open this URL in a new browser window to initialize a new connection._

## GET `/sync/:provider?did=<did>&key=<seed>`

Start syncronizing data for all the connected providers (and their associated handlers). This will occur in the background on the server. The server will update the data connection activity log and all the user data stored in the Verida Vault.

Query parameters:

1. `did` (required) DID of the identity to sync (ie: `did:vda:polamoy:0x....`)
2. `key` (required) Seed phrase (or private key) that controls the DID (ie :`0x...` or `work house ...`)
3. `provider` (optional) Sync a specific provider only

Example response:

```json
{
    "success": true
}
```

_Note: The server should respond with success immeidately, indicating the sync was successfully started. This does not indicate all the data sync process completed, check the sync logs for specific insight into the success / failure / progress of each provider and sync handler._

Example request:

```
http://127.0.01:5021/sync?key=0x..&did=0x..
```

_Note: The `Connect` [command line tool](./CLI.md) will open this URL in a new browser window to initialize a new connection._