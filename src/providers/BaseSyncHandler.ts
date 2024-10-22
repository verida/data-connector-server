import { Connection, ProviderHandlerOption, SyncHandlerResponse, SyncHandlerStatus, SyncProviderLogLevel, SyncResponse, SyncHandlerPosition, ConnectionOptionType, ConnectionOptionEnumOption, BaseHandlerConfig, ConnectionHandler } from "../interfaces"
import { IDatastore } from '@verida/types'
import { EventEmitter } from "events"
import { Utils } from "../utils"
import { SchemaRecord } from "../schemas"
import BaseProvider from "./BaseProvider"
import AccessDeniedError from "./AccessDeniedError"
import InvalidTokenError from "./InvalidTokenError"
const _ = require("lodash")

export default class BaseSyncHandler extends EventEmitter {

    protected provider: BaseProvider
    protected config: BaseHandlerConfig
    protected connection: Connection

    protected enabled: boolean
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
        this.enabled = true

        if (this.connection?.handlers) {
            const handlerConfigs = this.connection.handlers.reduce((handlers: Record<string, ConnectionHandler>, handler: ConnectionHandler) => {
                handlers[handler.id] = handler
                return handlers
            }, {})

            if (handlerConfigs[this.getId()]) {
                const handlerConfig = handlerConfigs[this.getId()]

                if (!handlerConfig.enabled) {
                    this.enabled = false
                } else {
                    for (const option of this.getOptions()) {
                        if (handlerConfig.config[option.id]) {
                            this.config[option.id] = handlerConfig.config[option.id]
                        } else {
                            this.config[option.id] = option.defaultValue
                        }
                    }
                }
            }
        }

        // Set break timestamp based on config
        if (this.config.backdate) {
            const monthMilliseconds = 1000 * 60 * 60 * 24 * 30
            let months = 1

            switch (this.config.backdate) {
                case '3-months':
                    months = 3
                    break
                case '6-months':
                    months = 6
                    break
                case '12-months':
                    months = 12
                    break
            }

            this.config.breakTimestamp = (new Date((new Date()).getTime() - monthMilliseconds * months)).toISOString()
        }
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
        return [{
          id: 'backdate',
          label: 'Backdate history',
          type: ConnectionOptionType.ENUM,
          enumOptions: [{
            value: '1-month',
            label: '1 month'
          }, {
            value: '3-months',
            label: '3 months'
          }, {
            value: '6-months',
            label: '6 months'
          }, {
            value: '12-months',
            label: '12 months'
          }],
          defaultValue: '3-months'
        }]
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
        if (!this.enabled) {
            this.emit('log', {
                level: SyncProviderLogLevel.DEBUG,
                message: `Disabled, skipping sync`
            })
            return
        }
        
        let syncResults: SchemaRecord[] = []
        let savePosition = false
        try {
            const syncResult = await this._sync(api, syncPosition)
            syncResults = <SchemaRecord[]> syncResult.results
            await this.handleResults(syncResult.position, syncResults, syncSchemaPositionDs)
        } catch (err: any) {
            let message: string
            savePosition = true
            if (err instanceof AccessDeniedError) {
                message = `Access denied. Re-connect and ensure you enable ${this.getLabel()}.`
                syncPosition.status = SyncHandlerStatus.INVALID_AUTH
                syncPosition.syncMessage = message

                this.emit('log', {
                    level: SyncProviderLogLevel.WARNING,
                    message
                })
            } else if (err instanceof InvalidTokenError) {
                // Re-throw so the provider can handle
                throw err
            } else {
                console.error(err)
                message = `Unknown error handling sync results: ${err.message}`
                this.emit('log', {
                    level: SyncProviderLogLevel.ERROR,
                    message
                })

                syncPosition.status = SyncHandlerStatus.ERROR
                syncPosition.syncMessage = `${err.message}`
                if (syncPosition.errorRetries) {
                    syncPosition.errorRetries++
                }
            }
        }

        if (savePosition) {
            await syncSchemaPositionDs.save(syncPosition, {
                // The position record may already exist, if so, force update
                forceUpdate: true
            })
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