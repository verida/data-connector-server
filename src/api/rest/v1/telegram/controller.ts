import { Response } from "express";
import { TelegramApi } from '../../../../providers/telegram/api'

import { UniqueRequest } from "../../../../interfaces";

const pendingClients: Record<string, TelegramApi> = {}

export default class Controller {

    public static async loginSubmit(req: UniqueRequest, res: Response, next: any) {
        const requestId = req.body.requestId
        const clientId = requestId

        if (!pendingClients[requestId]) {
            return res.status(400).send({
                error: `Unable to locate original login request`
            });
        }

        const api = pendingClients[requestId]
        const client = await api.getClient(false)

        try {
            switch (req.body.type) {
                case 'authcode':
                    const code = req.body.code
                    const codeStatus = await client.api.checkAuthenticationCode({
                        code
                    })
                    console.log(codeStatus)
                    break
                case 'phone':
                    const phone_number = req.body.phone
                    const setphoneresponse = await client.api.setAuthenticationPhoneNumber({
                        phone_number
                    })
                    const status = await client.api.getAuthorizationState({})
                    break
                case 'password':
                    const password = req.body.password
                    const passwordStatus = await client.api.checkAuthenticationPassword({
                        password
                    })
                    break
            }

            res.send({
                success: true
            })
        } catch (error) {
            console.log(error)
            res.status(400).send({
                error: error.message
            });
        }
    }

    public static async login(req: UniqueRequest, res: Response, next: any) {
        Controller.gc()
        const requestId = req.requestId

        const clientId = requestId
        const api = new TelegramApi(clientId)

        try {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders()
            // Tell the client to retry every 10 seconds if connectivity is lost
            res.write('retry: 10000\n\n')
            
            const client = await api.getClient()
            pendingClients[requestId] = api
            
            client.updates.subscribe(async (data: any) => {
                switch(data._) {
                    case 'updateAuthorizationState':
                        if (data.authorization_state._ == "authorizationStateWaitOtherDeviceConfirmation") {
                            const link = data.authorization_state.link
                            res.write(`data: ${JSON.stringify({
                                type: 'qrcode',
                                requestId,
                                link
                            })}\n\n`)
                        } else if (data.authorization_state._ == "authorizationStateWaitPassword") {
                            const hint = data.authorization_state.password_hint
                            res.write(`data: ${JSON.stringify({
                                type: 'password',
                                requestId,
                                hint
                            })}\n\n`)
                        } else if (data.authorization_state._ == 'authorizationStateWaitPhoneNumber') {
                            res.write(`data: ${JSON.stringify({
                                type: 'phone',
                                requestId
                            })}\n\n`)
                        } else if (data.authorization_state._ == 'authorizationStateWaitCode') {
                            res.write(`data: ${JSON.stringify({
                                type: 'authcode',
                                method: data.authorization_state.code_info.type,
                                requestId
                            })}\n\n`)
                        } else if (data.authorization_state._ == 'authorizationStateReady') {
                            // We are logged in!
                            await api.closeClient(false)
                            res.write(`data: ${JSON.stringify({
                                type: 'complete',
                                redirect: `/callback/telegram?id=${requestId}`
                            })}\n\n`)
                        }
                        break
                }
            })
            await api.startClient() // can this happen before events are bound?
            
            // const state = await client.api.getAuthorizationState({})
            // console.log('state', state)
            
        } catch (error) {
            console.log(error)
            res.status(400).send({
                error: error.message
            });
        }
    }

    public static gc() {
        // @todo: garbage collect expired login attempts
    }

}