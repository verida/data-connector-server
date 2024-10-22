import { Request, Response } from "express";
const fs = require('fs')
import CONFIG from "../../../../config"
import { Utils } from "../../../../utils";

/**
 *
 */
export class AdminController {

    public async logs(req: Request, res: Response) {
        try {
            await Utils.getNetworkConnectionFromRequest(req, { checkAdmin: true })
        } catch (error: unknown) {
            if (error instanceof Error && error.message.includes('Access denied')) {
                return res.status(403).send('Access denied')
            }
            return res.status(500).send(error instanceof Error ? error.message : 'Something went wrong')
        }

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
        try {
            await Utils.getNetworkConnectionFromRequest(req, { checkAdmin: true })
        } catch (error: unknown) {
            if (error instanceof Error && error.message.includes('Access denied')) {
                return res.status(403).send('Access denied')
            }
            return res.status(500).send(error instanceof Error ? error.message : 'Something went wrong')
        }

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
}

export const controller = new AdminController()
