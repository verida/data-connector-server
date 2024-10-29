import { Request, Response } from "express";
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
            mode: CONFIG.verida.mode,
            activeDIDs: Utils.didCount()
        })
    }
}

export const controller = new AdminController()
