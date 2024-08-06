import { Request, Response } from 'express'
import Base from "../BaseProvider"

// const tdl = require('tdl')
// const { getTdjson } = require('prebuilt-tdlib')
// tdl.configure({ tdjson: getTdjson() })

import { Client, Authenticator } from "tdlib-native";
import { TDLibAddon } from "tdlib-native/addon";

import { BaseProviderConfig } from '../../interfaces'

export interface TelegramProviderConfig extends BaseProviderConfig {
    apiId: number
    apiHash: string
}

/**
 * A fake provider used for testing purposes
 */
export default class TelegramProvider extends Base {

    protected config: TelegramProviderConfig

    public getProviderName() {
        return 'telegram'
    }

    public getProviderLabel() {
        return 'Telegram'
    }

    public getProviderApplicationUrl() {
        return 'https://telegram.org/'
    }

    // public getProviderId(): string {
    //     return "1"
    // }

    public setConfig(config: TelegramProviderConfig) {
        this.config = config
    }

    // public syncHandlers(): any[] {
    //     return [
    //         Post
    //     ]
    // }

    public async connect(req: Request, res: Response, next: any): Promise<any> {
        // Loading addon
        const adapter = await TDLibAddon.create();

        // Make TDLib shut up. Immediately
        Client.disableLogs(adapter);

        const client = new Client(adapter);
        
        const promise = new Promise(async (resolve, reject) => {
            client.updates.subscribe((data) => {
                switch(data._) {
                    case 'updateAuthorizationState':
                        console.log('have auth state')
                        console.log(data.authorization_state)
                        // @ts-ignore
                        if (data.authorization_state.link) {
                            // @ts-ignore
                            resolve(data.authorization_state.link)
                        }
                        break
                }
            })

            await client.start()
            
            await client.api.setTdlibParameters({
                api_id: this.config.apiId,
                api_hash: this.config.apiHash,
                system_language_code: 'en',
                device_model: 'Verida: Data Connector',
                application_version: '0.1'
            })
                try {
                    const result = await client.api.requestQrCodeAuthentication({})
                    console.log('result:')
                    console.log(result)
                } catch (err) {
                    console.log('have err')
                    console.log(err)
                }
        })

        const qrCodeLink = await promise
        console.log(qrCodeLink)

        const output = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>QR Code Display</title>
    <script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"></script>
    <style>
        .qr-container {
            text-align: center;
            margin-top: 20px;
        }
        .qr-code {
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Login with Telegram</h1>
        <p>Scan the QR code to connect your Telegram account:</p>
        <div class="qr-container">
            <div id="qr-code" class="qr-code"></div>
        </div>
    </div>

    <script>
        // The known link stored in a variable
        const qrCodeLink = '${qrCodeLink}'; // Replace with your actual link

        function generateQRCode(link) {
            const qrCodeContainer = document.getElementById('qr-code');

            // Clear previous QR code
            qrCodeContainer.innerHTML = '';

            // Generate new QR code
            QRCode.toCanvas(link, function (error, canvas) {
                if (error) {
                    console.error(error);
                } else {
                    qrCodeContainer.appendChild(canvas);
                }
            });
        }

        // Auto-populate QR code on page load
        document.addEventListener('DOMContentLoaded', function() {
            generateQRCode(qrCodeLink);
        });
    </script>
</body>
</html>`

        // await client.destroy()
        return res.send(output)
    }

    public async callback(req: Request, res: Response, next: any): Promise<any> {
        return {
            id: 1,
            accessToken: 'fake-access-token',
            refreshToken: 'fake-refresh-token',
            profile: {
                id: 1,
                name: 'Fake user'
            }
        }
    }

    public async getApi(accessToken?: string, refreshToken?: string): Promise<any> {
        return
    }

}

