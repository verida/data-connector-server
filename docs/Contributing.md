
# Contributing

There are specific guidelines that must be adhered to when making a contribution.

## New Data Provider

We actively encourage the development of any new data providers that expand the available API's users can connect to pull their personal data.

You can browse the [open issues for new connectors](https://github.com/verida/data-connector-server/issues?q=is%3Aissue+is%3Aopen+label%3Anew-connector).

Key terms:

1. `Provider` A data provider object (ie: `facebook`) that manages a user authenticating with the provider to establish a connection.
2. `Connection` A specific connection that a user has made with a provider. Connections are stored in a user's Verida Vault.
3. `Handler`  Providers have multiple handlers (ie: the `google` provider has handlers `gmail`, `youtube`) that manage specific configuration options and performs the necessary syncronization

### Basic Structure

#### Provider Class

2. `src/providers/<provider-name>/index.ts` extending [BaseProvider](./src/providers/BaseProvider.ts)
3. `assets/<provider-name>/icon.png` with the official icon for the data source. Must be 256x256 pixels.
4. An exported Typescript interface called `ConfigInterface` that defines the configuration options available for the API

Other considerations:

1. The authentication must use `passport-js` if an existing authentication module exists
2. The official npm package of the API in question must be used if it exists
3. There should be no console output, instead use `log4js` with sensible logging (`trace`, `debug`, `info`, `error`)
4. Use appropriate data schemas if they exist
5. Do NOT commit a PR with any API keys, accessTokens or other secrets

#### Handler Class


The data source handler must populate the appopriate schema with relant fields sourced from the API. While the fields may vary, at a minimum the connector must populate the following fields:

- `name` - A human readable name that best represents the record
- `sourceApplication` - URL of the application the data was sourced from. Remove any `www` prefix. Use `https` if available.
- `sourceId` - Unique ID of the record sourced from the API
- `sourceData` - Full, unaltered JSON of the data retreived from the API. This allows a future upgrade path to add more data into the schema from the original data.
- `insertedAt` - Date/time the data was inserted. If not available in the API, use another date/time that is an approximation, or worst case scenario use the current date/time.

Some common optional fields include:

- `uri` - A URL to view the pi
- `icon` - A small icon representing the data
- `summary` - A brief summary of the recrod
- `uri` - A public link to the unique record in the application (ie: Tweet URL)

#### Configuration

5. An entry in [src/serverconfig.json](src/serverconfig.json) for the provider that provides the default configuration for the data source


### Managing Sync Position

### Provider Options

### Unit Tests

6. `/test/<provider-name>.ts` file that contains appropriate unit tests that demonstrates succesful fetching of data and succesful handling of API errors

### Documentation

Each data source provider must contain the following:

1. `src/providers/<provider-name>/README.md` containing:
   1. Instructions on how to obtain any necessary API keys for the server
   2. Instructions on how to configure the provider
   3. Any limitations of the provider (ie: Only fetches maximum of 1,000 records)
   4. Any issues where the data provided doesn't exactly match the schema
   5. Details of any new schemas created to support this API connector or modifications to existing schemas (including a link to a PR that contains the proposed schema changes in the [@verida/schemas-common](https://github.com/verida/schemas-common) repo)
   6. Details of any future improvements or features that could be considered
   7. Details of any performance considerations
   8. Details of any known issues with the data source API being used



## Core Contributions

We welcome PR's that resolve any oustanding Github issue.