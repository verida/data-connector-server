import * as fs from 'fs'
import * as path from 'path'
import { Client } from "tdlib-native";
import { TDLibAddon } from "tdlib-native/addon";

import CONFIG from '../../config'

const tdPathPrefix = `_td`

export class TelegramApi {

    clientId: string
    tdPath: string
    client?: Client

    constructor(clientId: string, binFile?: string) {
        this.clientId = clientId
        this.tdPath = `${tdPathPrefix}/${this.clientId}`

        if (binFile) {
            this.restoreBinFile(binFile)
        }
    }

    public async getClient(startClient: boolean = false): Promise<Client> {
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

        // load saved binary file to disk
        // const nowMinutes = Math.floor(Date.now() / 1000 / 60)
    
        await client.api.setTdlibParameters({
            api_id: CONFIG.providers.telegram.apiId,
            api_hash: CONFIG.providers.telegram.apiHash,
            system_language_code: 'en',
            device_model: 'Verida: Data Connector',
            application_version: '0.1',
            database_directory: `${this.tdPath}/db`,
            files_directory: `${this.tdPath}/files`,
        })
    }

    public async closeClient(deleteSession: boolean = true): Promise<string> {
        console.log('closing client')
        // Close the Telegram socket connection
        const client = await this.getClient()
        await client.api.close({})
        
        // Return the bin file representing the session
        const binFile = this.getBinFile()

        // Delete session from disk
        if (deleteSession) {
            fs.rmSync(this.tdPath, {
                recursive: true
            })
        }

        return binFile
    }

    public async getChatHistory(chatId: number, limit: number = 100): Promise<any> {
        const client = await this.getClient()
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
        console.log('restoring bin file')
        const path = `${tdPathPrefix}/${this.clientId}/db/td.binlog`
        this.ensureDirectoryExists(path)

        // Decode the base64 data
        const buffer = Buffer.from(binFile, 'base64');

        try {
            fs.writeFileSync(path, buffer)
        } catch(err: any) {
            throw new Error(`Error writing telegram binlog file: ${err.message}`)
        }
    }

    public getBinFile() {
        console.log('getting bin file')
        const path = `${tdPathPrefix}/${this.clientId}/db/td.binlog`

        try {
            const data = fs.readFileSync(path)
            return data.toString('base64');
        } catch (err: any) {
            throw new Error(`Error reading telegram binlog file: ${err.message}`)
        }
    }

    protected ensureDirectoryExists(filePath: string): void {
        console.log("ensureDirectoryExists")
        console.log(filePath)
        const dir = path.dirname(filePath);
        console.log(dir)
        
        try {
          // Ensure that the directory exists
          const result = fs.mkdirSync(dir, { recursive: true });
          console.log(result)
        } catch (err) {
          console.error('Error creating directories:', err);
          throw err;
        }
      }
      
}
