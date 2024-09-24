# Verida Data Connector Server

## Overview

This server enables a user to authenticate with third party services to take ownership of their personal data stored with the third party.

The `Verida Vault` utilizes this server, redirecting a user to connect to an API. Once connected, the `Verida Vault` makes regular `sync` requests to the API in order to keep up-to-date with the user's latest data in that third party service.

## Running the Server

### Configuration

Create a local configuration file:

```
cp src/serverconfig.example.json src/serverconfig.local.json
```

 Update `src/serverconfig.local.json` to:

1. Specify the details of each provider you want to run. You will need to obtain the necessary API keys for each provider.
2. Specify the correct `serverUrl` and `assetsUrl` that point to the correct address of your server. Don't use `localhost` as it breaks sessions, use `127.0.0.1` instead (*).
3. `testVeridaKey`: A Verida private key (or seedphrase) that controls a DID. This is used by the command line when connecting a provider, and also used by the unit tests to load providers and save test data.
4. Update any connection credentials

_(*) Sessions are used to track `redirect` URLs in the connection request. Sessions **do not** work locally if you specify `localhost` for the hostname. Use an IP address instead._

### Starting the server

Once off initialization:

```
npm use
yarn
```

Start the server:

```
yarn run dev
```

## Tests

Before running tests, ensure `src/serverconfig.json` has a Verida identity private key set in `testVeridaKey`. The tests use this identity to store test data. Use a new identity as the tests will delete any existing data and potentially add junk data. See steps below on how to create a new test Verida identity.

```
yarn run core-cli 
```

Run all tests:

```
yarn run tests
```

Run a specficic test:

```
yarn run test tests/providers/facebook.test.ts
```

## Create a Test Verida Identity

Create a new Verida identity:

```
yarn run core-cli CreateAccount -n banksia -s
```

You also need to create the `Verida: Vault` context for the account that will become the container for all the databases storing your personal data. This can be achieved by creating a basic profile:

```
yarn run core-cli SetProfile -k <privateKey> --network banksia -n "John" -c "Australia"
```

Replace `<privateKey>` with the key output from the `CreateAccount` command above.

By default, this will select three storage nodes on the Verida network to store and replicate your encrypted data. Alternatively, it is possible to run a local instance of the Verida Storage Node server and use it to store your data.

You can link your local storage node to your Verida identity by running this command instead:

```
yarn run core-cli SetProfile -k <privateKey> --network banksia --storageNodes "http://localhost:5000/" -n "John" -c "Australia"
```

_Note: `storageNodes` are only linked the first time the profile is set, so it's important to specify your local storage node the first time you run `SetProfile`_

You can learn how to use all the core Verida command line tools with:

```
yarn run core-cli --help
yarn run core-cli CreateAccount --help
```

## Learn more

- [How to contribute](./docs/Contributing.md)
- [API Endpoints](./docs/Endpoints.md) to establish connections, sync data and get provider metadata
- [Command Line Tools](./docs/CLI.md) to help establish provider connections, manually sync data and view data
- [Implementation notes](./docs/Implementation.md) that explain the inner workings and design details