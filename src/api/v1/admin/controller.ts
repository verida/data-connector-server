import { Request, Response } from "express";

const dsCache: Record<string, any> = {}

/**
 * 
 */
export class MemoryController {
    
    public async memory(req: Request, res: Response) {
        const memoryUsage = process.memoryUsage()
        return res.json(memoryUsage)
    }
}

export const controller = new MemoryController()