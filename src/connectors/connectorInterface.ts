import { Request, Response } from 'express'

export default interface ConnectorInterface {

    connect(req: Request, res: Response, next: any): any
    callback(req: Request, res: Response, next: any): any
    sync(req: Request, res: Response, next: any): any

}