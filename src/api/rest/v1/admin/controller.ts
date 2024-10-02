import { Request, Response } from "express";
const fs = require('fs')
import CONFIG from "../../../../config"
import { Utils } from "../../../../utils";

function formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) {
      bytes /= 1024;
      i++;
    }
    return `${bytes.toFixed(2)} ${units[i]}`;
  }
  
  interface MemoryUsage {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  }
  
  function convertMemoryUsage(memoryUsage: MemoryUsage): { [key: string]: string } {
    const readableMemoryUsage: { [key: string]: string } = {};
    for (const key in memoryUsage) {
      readableMemoryUsage[key] = formatBytes(memoryUsage[key as keyof MemoryUsage]);
    }
    return readableMemoryUsage;
  }
  

/**
 * 
 */
export class AdminController {
    
    public async memory(req: Request, res: Response) {
        const memoryUsage = process.memoryUsage()
        const humanReadable = convertMemoryUsage(memoryUsage);
        return res.json({
            memoryUsage,
            humanReadable
        })
    }

    public async status(req: Request, res: Response) {
        return res.json({
            logsExposed: CONFIG.verida.logging.exposeLogs,
            environment: CONFIG.verida.environment,
            apiVersion: CONFIG.verida.apiVersion,
            build: CONFIG.verida.build,
            schemas: CONFIG.verida.schemas,
            activeDIDs: Utils.didCount()
        })
    }

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
}

export const controller = new AdminController()