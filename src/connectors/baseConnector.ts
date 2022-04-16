import { Request, Response } from 'express'

export default class BaseConnector {

    protected config: object

    public constructor(config: object) {
        this.config = config
    }

    public async connect(req: Request, res: Response, next: any): Promise<any> {
        throw new Error('Not implemented')
    }

    public async callback(req: Request, res: Response, next: any): Promise<any> {
        throw new Error('Not implemented')
    }

    public async sync(req: Request, res: Response, next: any): Promise<any> {
        throw new Error('Not implemented')
    }

    public schemaUris(): string[] {
        throw new Error('Not implemented')
    }

}