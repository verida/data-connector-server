import { Request, Response } from 'express'
import Providers from "../../../../providers"
import { ConnectionOption, ProviderHandler } from '../../../../interfaces'
import CONFIG from '../../../../config'

export interface ProviderResult {
    id: string
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
            if (providerName != providerId) {
                continue
            }

            try {
                const provider = Providers(providerName)
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
                    label: provider.getProviderLabel(),
                    icon: provider.getProviderImageUrl(),
                    description: provider.getDescription(),
                    options: provider.getOptions(),
                    handlers
                })
            } catch (err) {
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

            try {
                const provider = Providers(providerName)
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
                    id: providerName,
                    label: provider.getProviderLabel(),
                    icon: provider.getProviderImageUrl(),
                    description: provider.getDescription(),
                    options: provider.getOptions(),
                    handlers
                })
            } catch (err) {
                console.log(err)
                // skip broken providers
            }
        }

        return res.send({
            success: true,
            items: results
        })
    }

}