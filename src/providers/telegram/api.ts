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
        console.log('getting telegram client')
        if (this.client) {
            return this.client
        }

        // Loading addon
        console.log('loading adapter')
        const adapter = await TDLibAddon.create();
        console.log('adapter loaded')
    
        // Make TDLib shut up. Immediately
        Client.disableLogs(adapter);
    
        console.log('creating new client')
        const client = new Client(adapter);
        console.log('client created')
    
        console.log('starting client')
        await client.start()
        console.log('client started')
        this.client = client

        if (startClient) {
            await this.startClient()
        }

        return this.client
    }
    
    public async startClient() {
        console.log('startClient()')
        const client = await this.getClient()

        // load saved binary file to disk
        // const nowMinutes = Math.floor(Date.now() / 1000 / 60)
    
        console.log('setting params')
        await client.api.setTdlibParameters({
            api_id: CONFIG.providers.telegram.apiId,
            api_hash: CONFIG.providers.telegram.apiHash,
            system_language_code: 'en',
            device_model: 'Verida: Data Connector',
            application_version: '0.1',
            database_directory: `${this.tdPath}/db`,
            files_directory: `${this.tdPath}/files`,
            use_chat_info_database: false,
            use_message_database: false,
            use_file_database: false
        })

        console.log('params set')
    }

    public async closeClient(deleteSession: boolean = true): Promise<string> {
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

    public async getChatGroupIds(limit: number=500): Promise<string[]> {
        const client = await this.getClient()
        const chatGroups: string[] = []
        
        while (chatGroups.length < limit) {
            const response = await client.api.getChats({
                limit
              });
    
            if (!response.chat_ids.length || response.total_count == 0) {
                break
            }
    
            for (const chatId of response.chat_ids) {
                chatGroups.push(chatId.toString())
            }
        }

        return chatGroups
    }

    public async getChatGroup(chat_id: number): Promise<any> {
        const client = await this.getClient()
        const chatDetail = await client.api.getChat({
            chat_id,
        });

        return chatDetail
    }

    public async getUser(user_id: number): Promise<any> {
        const client = await this.getClient()
        const user = await client.api.getUser({
            user_id,
        });

        return user
    }

    public async getSupergroup(supergroup_id: number) {
        const client = await this.getClient()
        return await client.api.getSupergroup({
            supergroup_id
        })
    }

    public async getChatMessage(chatGroupId: string, messageId: string): Promise<any> {
        const client = await this.getClient()
        return await client.api.getMessage({
            chat_id: parseInt(chatGroupId),
            message_id: parseInt(messageId)
        })
    }

    public async getChatHistory(chatId: number, limit: number=100, fromMessageId: number=0, toMessageId?: number): Promise<{
        messages: any[]
        breakIdHit: boolean
    }> {
        const client = await this.getClient()
        const messages: any[] = []
    
        let breakIdHit = false
        while (messages.length < limit && !breakIdHit) {
            const chatHistory = await client.api.getChatHistory({
                chat_id: chatId,
                from_message_id: fromMessageId,
                limit
            })
    
            if (!chatHistory.messages || chatHistory.total_count == 0) {
                break
            }
    
            for (const message of chatHistory.messages) {
                fromMessageId = message.id
                if (fromMessageId == toMessageId) {
                    breakIdHit = true
                    break
                }

                messages.push(message)
    
                if (messages.length >= limit) {
                    break
                }
            }
        }
    
        return {
            messages,
            breakIdHit
        }
    }

    public async downloadFile(file_id: number): Promise<string> {
        const client = await this.getClient()
        const file = await client.api.downloadFile({
            file_id,
            priority: 1,
            synchronous: true
        })
        
        const data = fs.readFileSync(file.local.path)
        const base64 = data.toString('base64');
        return base64
    }

    public restoreBinFile(binFile: string) {
        console.debug('restoring bin file')
        const path = `${tdPathPrefix}/${this.clientId}/db/td.binlog`
        this.ensureDirectoryExists(path)

        // Decode the base64 data
        const buffer = Buffer.from(binFile, 'base64');

        try {
            fs.writeFileSync(path, buffer)
        } catch(err: any) {
            throw new Error(`Error writing telegram binlog file: ${err.message}`)
        }

        console.debug('bin file restored')
    }

    public getBinFile() {
        const path = `${tdPathPrefix}/${this.clientId}/db/td.binlog`

        try {
            const data = fs.readFileSync(path)
            const base64 = data.toString('base64');
            return base64
        } catch (err: any) {
            throw new Error(`Error reading telegram binlog file: ${err.message}`)
        }
    }

    protected ensureDirectoryExists(filePath: string): void {
        const dir = path.dirname(filePath);
        
        try {
          // Ensure that the directory exists
          const result = fs.mkdirSync(dir, { recursive: true });
        } catch (err) {
          console.error('Error creating directories:', err);
          throw err;
        }
      }
      
}
