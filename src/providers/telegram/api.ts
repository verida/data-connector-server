import * as fs from 'fs'
import { Client } from "tdlib-native";
import { TDLibAddon } from "tdlib-native/addon";

import CONFIG from '../../config'
import { ConnectionProfile } from '../../interfaces';
import { Utils } from '../../utils'

const tdPathPrefix = `_td`

export class TelegramApi {

    clientId: string
    client?: Client

    constructor(clientId: string, binFile?: string) {
        this.clientId = this.clientId

        if (binFile) {
            this.restoreBinFile(binFile)
        }
    }

    public async getClient(startClient: boolean = true): Promise<Client> {
        if (this.client) {
            return this.client
        }

        // Loading addon
        const adapter = await TDLibAddon.create();
    
        // Make TDLib shut up. Immediately
        Client.disableLogs(adapter);
    
        const client = new Client(adapter);
    
        await client.start()
        this.client = client

        if (startClient) {
            await this.startClient()
        }

        return this.client
    }
    
    public async startClient() {
        const client = await this.getClient()
        const path = `${tdPathPrefix}/${this.clientId}`

        // load saved binary file to disk
        // const nowMinutes = Math.floor(Date.now() / 1000 / 60)
    
        await client.api.setTdlibParameters({
            api_id: CONFIG.providers.telegram.apiId,
            api_hash: CONFIG.providers.telegram.apiHash,
            system_language_code: 'en',
            device_model: 'Verida: Data Connector',
            application_version: '0.1',
            database_directory: `${path}/db`,
            files_directory: `${path}/files`,
        })
    }

    public async closeClient(): Promise<string> {
        const client = await this.getClient()
        await client.api.close({})
        return this.getBinFile()
    }

    public async getChatHistory(client: Client, chatId: number, limit: number = 100): Promise<any> {
        const messages = []
        let fromMessageId = 0
    
        while (messages.length < limit) {
            console.log('loop')
            const chatHistory = await client.api.getChatHistory({
                chat_id: chatId,
                from_message_id: fromMessageId,
                limit
            })
    
            if (!chatHistory.messages || chatHistory.total_count == 0) {
                break
            }
    
            for (const message of chatHistory.messages) {
                messages.push(message)
                fromMessageId = message.id
    
                if (messages.length >= limit) {
                    break
                }
            }
        }
    
        // is_outgoing
    
        return messages
    }

    public restoreBinFile(binFile: string) {
        const path = `${tdPathPrefix}/${this.clientId}`

        // Decode the base64 data
        const buffer = Buffer.from(binFile, 'base64');

        try {
            fs.writeFileSync(path, buffer)
        } catch(err: any) {
            throw new Error(`Error writing telegram binlog file: ${err.message}`)
        }
    }

    public getBinFile() {
        const path = `${tdPathPrefix}/${this.clientId}`

        try {
            const data = fs.readFileSync(path)
            return data.toString('base64');
        } catch (err: any) {
            throw new Error(`Error reading telegram binlog file: ${err.message}`)
        }
    }
}
