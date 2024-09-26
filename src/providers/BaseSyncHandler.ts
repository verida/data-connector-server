import { Connection, ProviderHandlerOption, SyncHandlerResponse, SyncHandlerStatus, SyncProviderLogLevel, SyncResponse, SyncHandlerPosition, ConnectionOptionType, ConnectionOptionEnumOption, BaseHandlerConfig, ConnectionHandler } from "../interfaces"
import { IDatastore } from '@verida/types'
import { EventEmitter } from "events"
import { Utils } from "../utils"
import { SchemaRecord } from "../schemas"
import BaseProvider from "./BaseProvider"
import AccessDeniedError from "./AccessDeniedError"
const _ = require("lodash")

export default class BaseSyncHandler extends EventEmitter {

    protected provider: BaseProvider
    protected config: BaseHandlerConfig
    protected connection: Connection

    protected syncStatus: SyncHandlerStatus

    constructor(config: any, connection: Connection, provider: BaseProvider) {
        super()
        // Handle any custom config for this handler
        if (config.handlers) {
            if (config.handlers[this.getId()]) {
                config = _.merge({}, config, config.handlers[this.getId()])
            }

            delete config["handlers"]
        }

        this.config = config
        this.connection = connection
        this.provider = provider
    }

    /**
     * @deprecated Use getId()
     */
    public getName(): string {
        throw new Error('Not implemented')
    }

    public getId(): string {
        return this.getName()
    }

    /**
     * Set a default label
     */
    public getLabel(): string {
        let label = this.getId()
        // Replace all instances of "-" with a space
        label = label.replace(/-/g, ' ');

        // Uppercase the first letter
        return label.charAt(0).toUpperCase() + label.slice(1);
    }

    public getConfig(): any {
        return this.config
    }

    public getOptions(): ProviderHandlerOption[] {
        return []
    }

    public setConfig(config: any) {
        this.config = config
    }

    public getProviderApplicationUrl() {
        return this.provider.getProviderApplicationUrl()
    }

    public getSchemaUri(): string {
        throw new Error('Not implemented')
    }

    protected updateConnection(connectionParams: object) {
        this.provider.updateConnection(connectionParams)
    }

    public buildConfig(newConfig: Record<string, object>, currentConfig: Record<string, string | number | boolean>): BaseHandlerConfig {
        const finalConfig: Record<string, string | number | boolean> = {}

        for (const handlerOption of this.getOptions()) {
            const configValue = currentConfig[handlerOption.id] ? currentConfig[handlerOption.id] : undefined

            if (newConfig[handlerOption.id]) {
                const newValue = newConfig[handlerOption.id]
                const validEnumOptions = handlerOption.enumOptions.map((item) => item.value)

                switch (handlerOption.type) {
                    case ConnectionOptionType.BOOLEAN:
                        if (typeof(newValue) !== "boolean") {
                            throw new Error(`${handlerOption.label}: Must be boolean`)
                        }

                        finalConfig[handlerOption.id] = newValue
                        break
                    case ConnectionOptionType.ENUM:
                        if (typeof(newValue) !== "string") {
                            throw new Error(`${handlerOption.label}: Must be string`)
                        } else if (validEnumOptions.indexOf(newValue) === -1) {
                            throw new Error(`${handlerOption.label} must be one of [${validEnumOptions.join(", ")}], not ${newValue}`)
                        }

                        finalConfig[handlerOption.id] = newValue
                        break
                    case ConnectionOptionType.ENUM_MULTI:
                        if (typeof(newValue) !== "string") {
                            throw new Error(`${handlerOption.label}: Must be string`)
                        } else {
                            const enumValues = (<string> newValue).split(',')

                            for (const enumValue of enumValues) {
                                if (validEnumOptions.indexOf(enumValue) === -1) {
                                    throw new Error(`${handlerOption.label}: Must be one of [${validEnumOptions.join(", ")}], not ${enumValue}`)
                                }
                            }
                        }

                        finalConfig[handlerOption.id] = newValue
                        break
                }
            } else {
                if (!configValue) {
                    // No existing value, so set defaults
                    finalConfig[handlerOption.id] = handlerOption.defaultValue
                } else {
                    // No value specified, so use existing value
                    finalConfig[handlerOption.id] = configValue
                }
            }
        }

        return finalConfig
    }

    /**
     * Continuously syncronize the data in batches, until complete.
     * 
     * Saves the data.
     * 
     * @param api 
     * @param syncPosition 
     * @param syncSchemaPositionDs 
     * @returns 
     */
    public async sync(
        api: any,
        syncPosition: SyncHandlerPosition,
        syncSchemaPositionDs: IDatastore): Promise<SyncHandlerResponse> {
        let syncResults
        try {
            const syncResult = await this._sync(api, syncPosition)
            syncResults = <SchemaRecord[]> syncResult.results
            await this.handleResults(syncResult.position, syncResults, syncSchemaPositionDs)
        } catch (err: any) {
            let message: string
            if (err instanceof AccessDeniedError) {
                message = `Access denied, ensure access has been granted`
                syncPosition.accessDenied = true
            } else {
                message = `Unknown error handling sync results: ${err.message}`
            }

            this.emit('log', {
                level: SyncProviderLogLevel.ERROR,
                message
            })

            syncPosition.status = SyncHandlerStatus.ERROR
            if (syncPosition.errorRetries) {
                syncPosition.errorRetries++
            }
        }

        return {
            syncPosition,
            syncResults
        }
    }

    protected async handleResults(
        position: SyncHandlerPosition,
        items: SchemaRecord[],
        syncSchemaPositionDs: IDatastore
        ): Promise<void> {
        try {
            // Ensure we always update, so delete any revision value
            delete position['_rev']
            const result = await syncSchemaPositionDs.save(position, {
                // The position record may already exist, if so, force update
                forceUpdate: true
            })
            if (!result) {
                const message = `Unable to update sync position: ${JSON.stringify(syncSchemaPositionDs.errors, null, 2)} (${JSON.stringify(position, null, 2)})`
                this.emit('log', {
                    level: SyncProviderLogLevel.ERROR,
                    message
                })
            }
        } catch (err: any) {
            const message = `Unable to update sync position: ${err.message} (${JSON.stringify(position, null, 2)})`
            this.emit('log', {
                level: SyncProviderLogLevel.ERROR,
                message
            })
        }

        // save items
        for (let i in items) {
            const item = items[i]
            if (!item.insertedAt) {
                const message = `Unable to save item: insertedAt field is missing (${item._id}})`
                this.emit('log', {
                    level: SyncProviderLogLevel.ERROR,
                    message
                })
                continue
            }

            // Load schema specified in item, fallback to default schema for this sync handler
            // This allows a sync handler to return results of different schema types
            if (!item.schema) {
                item.schema = this.getSchemaUri()
            }

            if (item.sourceAccountId) {
                item.sourceAccountId = this.provider.getAccountId()
            }
            
            const schemaDatastore = await this.provider.getDatastore(item.schema)

            try {
                const success = await schemaDatastore.save(item, {
                    forceUpdate: true
                })
                if (!success) {
                    // @ts-ignore
                    const message = `Unable to save item: ${Utils.datastoreErrorsToString(schemaDatastore.errors)} (${item._id} / ${item._rev})`

                    this.emit('log', {
                        level: SyncProviderLogLevel.ERROR,
                        message
                    })
                }
            } catch (err: any) {
                const message = `Unable to save item: ${err.message} (${item._id} / ${item._rev})`
                this.emit('log', {
                    level: SyncProviderLogLevel.ERROR,
                    message
                })
            }
        }
    }

    /**
     * Syncronize the most recent data to the oldest data.
     * 
     * This must be implemented by the sync handler.
     * 
     * @returns SyncResponse Array of results that need to be saved and the updated syncPosition
     */
    public async _sync(api: any, syncPosition: SyncHandlerPosition): Promise <SyncResponse> {
        throw new Error('Not implemented')
    }

    /**
     * Backfill to add extra detail to these records
     * 
     * This can be implemented by the sync handler.
     * 
     * @returns SyncResponse Array of results that need to be saved and the updated syncPosition
     */
    protected async _backfill(api: any, backfillPosition: SyncHandlerPosition): Promise<SyncResponse> {
        backfillPosition.status = SyncHandlerStatus.ENABLED

        return {
            position: backfillPosition,
            results: []
        }
    }

    /**
     * Update the `syncPosition` when the sync has stopped.
     * 
     * This can be implemented by the sync handler.
     * 
     * @param syncPosition 
     * @param serverResponse 
     */
    protected stopSync(syncPosition: SyncHandlerPosition, serverResponse?: any): SyncHandlerPosition {
        return syncPosition
    }

    protected buildItemId(itemId: string) {
        return `${this.provider.getProviderName()}-${this.connection.profile.id}-${itemId}`
    }
}