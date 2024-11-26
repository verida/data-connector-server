import { Request, Response } from 'express'
import Providers from "../../../../providers"
import { ConnectionOption, ProviderHandler } from '../../../../interfaces'
import CONFIG from '../../../../config'

export interface ProviderResult {
    id: string
    status: string,
    label: string,
    icon: string,
    description: string,
    options: ConnectionOption[],
    handlers: ProviderHandler[]
}

/**
 */
export default class Controller {

    public static async provider(req: Request, res: Response) {
        const providerId = req.params.providerId
        const providers = Object.keys(CONFIG.providers)

        const results: ProviderResult[] = []
        for (let p in providers) {
            const providerName = providers[p]
            if (providerName !== providerId) {
                continue
            }

            try {
                const provider = Providers(providerName)

                const providerConfig = provider.getConfig()

                const syncHandlers = await provider.getSyncHandlers()
                const handlers: ProviderHandler[] = []
                for (const handler of syncHandlers) {
                    handlers.push({
                        id: handler.getId(),
                        label: handler.getLabel(),
                        options: handler.getOptions()
                    })
                }

                results.push({
                    id: providerId,
                    status: providerConfig.status,
                    label: provider.getProviderLabel(),
                    icon: provider.getProviderImageUrl(),
                    description: provider.getDescription(),
                    options: provider.getOptions(),
                    handlers
                })
            } catch (error: unknown) {
                // TODO: Once the tsconfig is updated, remove the 'unknown' type
                // TODO: Once the tsconfig is updated, create a new Error with an explicit error message (e.g. 'Failed to load provider <providerName>') and pass the caught error as a cause (cause is not supported yet on this config)
                console.error(error)
                // skip broken providers
            }
        }

        const result: Record<string, any> = {
            success: false
        }

        if (results.length) {
            result.success = true
            result.item = results[0]
        }

        return res.send(result)
    }

    public static async providers(req: Request, res: Response) {
        const providers = Object.keys(CONFIG.providers)

        const results: ProviderResult[] = []

        for (let p in providers) {
            const providerName = providers[p]
            const providerConfig = CONFIG.providers[providerName]

            const status = providerConfig['status']

            // TODO: Remove the 'enabled' check, keeping it now for backwards compatibility
            // TODO: Once proper typing on the provider config, reverse the check of the status. For now, we have to explicitly check for the active and upcoming statuses
            if ((status !== 'active' && status !== 'upcoming') || (typeof providerConfig['enabled'] === 'boolean' && !providerConfig['enabled'])) {
                // Ignore disabled providers
                continue
            }

            try {
                const provider = Providers(providerName)

                // If the provider is upcoming, explicitly set the options and handlers to an empty array

                const options = status === 'upcoming' ? [] : provider.getOptions()

                const syncHandlers = await provider.getSyncHandlers()
                const handlers: ProviderHandler[] = status === 'upcoming' ? [] : syncHandlers.map((handler) => ({
                    id: handler.getId(),
                    label: handler.getLabel(),
                    options: handler.getOptions()
                }))

                results.push({
                    id: providerName,
                    status,
                    label: provider.getProviderLabel(),
                    icon: provider.getProviderImageUrl(),
                    description: provider.getDescription(),
                    options,
                    handlers
                })
            } catch (error: unknown) {
                // TODO: Once the tsconfig is updated, remove the 'unknown' type
                // TODO: Once the tsconfig is updated, create a new Error with an explicit error message (e.g. 'Failed to load provider <providerName>') and pass the caught error as a cause (cause is not supported yet on this config)
                console.error(error)
                // skip broken providers
            }
        }

        return res.send({
            success: true,
            items: results
        })
    }

}
