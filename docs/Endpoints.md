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

## GET `/connect/:provider?redirect=<redirect>&key=<key>&did=<did>`

Establish a connection to a provider. The connection credentials (ie: `access_token`, `refresh_token` are saved into the identities `connection` datastore in the Verida Vault)

Query parameters:

1. `key` Seed phrase (or private key) that controls the DID (ie :`0x...` or `work house ...`)
2. `did` DID of the identity to sync (ie: `did:vda:polamoy:0x....`)


## GET `/sync?did=<did>&seed=<seed>`

Query parameters:

1. `did` DID of the identity to sync (ie: `did:vda:polamoy:0x....`)
2. `seed` Seed phrase (or private key) that controls the DID (ie :`0x...` or `work house ...`)

Example response:

```
{
    "success": true
}
```