import { Request, Response } from "express";
const fs = require('fs')
const path = require('path');
const { exec } = require('child_process');
import util from 'util';
import CONFIG from "../../../../config"

// Promisify exec to use async/await
const execAsync = util.promisify(exec);

/**
 *
 */
export class AdminController {

    public async logs(req: Request, res: Response) {
        if (!CONFIG.verida.logging.exposeLogs) {
            return res.status(403).send('Permission denied')
        }

        try {
            const logsPassword = CONFIG.verida.logging.logsPassword
            const password = req.query.password

            if (logsPassword != password) {
                return res.status(403).send('Permission denied')
            }

            const data = fs.readFileSync(CONFIG.verida.logging.logToFile, 'utf8');
            return res.status(200).send(`<html><body><pre>${data}</pre></body></html>`)
        } catch (err) {
            if (err.message.match('no such file')) {
                return res.status(200).send(`No logs found`)
            } else {
                console.error('Error reading file:', err);
                return res.status(500).send(err.message)
            }
        }
    }

    public async clearLogs(req: Request, res: Response) {
        if (!CONFIG.verida.logging.exposeLogs) {
            return res.status(403).send('Permission denied')
        }

        const logsPassword = CONFIG.verida.logging.logsPassword
        const password = req.query.password

        if (logsPassword != password) {
            return res.status(403).send('Permission denied')
        }

        fs.unlinkSync(CONFIG.verida.logging.logToFile)
        return res.status(200).send("Success")
    }

    public async updateConfig(req: Request, res: Response) {
        const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

        // @ts-ignore
        if (!req.file) {
            return res.status(400).send('No file uploaded.');
        }
        
        try {
            const password = req.query.password
            console.log(`${ADMIN_PASSWORD} != ${password}`)

            if (ADMIN_PASSWORD != password) {
                return res.status(403).send('Permission denied')
            }

            // @ts-ignore
            const file = req.file;
            const destinationPath = path.join(process.cwd(), './src/serverconfig.local.json');

            try {
                await fs.promises.writeFile(destinationPath, file.buffer);
                console.log('File saved to:', destinationPath);
            } catch (err) {
                console.error(`Error saving file: ${err.message}`);
                throw new Error(`Error saving file`)
            }

            // Restart server
            const { stdout } = await execAsync('pm2 restart dcs');

            return res.status(200).send("Success")
        } catch (err) {
            if (err.message.match('no such file')) {
                return res.status(200).send(`No logs found`)
            } else {
                console.error('Error reading file:', err);
                return res.status(500).send(err.message)
            }
        }
    }
}

export const controller = new AdminController()
