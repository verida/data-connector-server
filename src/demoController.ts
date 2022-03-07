import { Request, Response } from 'express'
const log4js = require("log4js")
const logger = log4js.getLogger()
logger.level = "debug";

export default class DemoController {

    /**
     * 
     * @param {*} req 
     * @param {*} res 
     */
    public static async echo(req: Request, res: Response) {
        logger.debug("/echo", req.query)
        const message = req.body.message

        return res.status(200).send({
            status: "success",
            data: {
                message: `hello ${message}`
            }
        })
    }

    public static async error(req: Request, res: Response) {
        logger.warn("/error")
        return res.status(400).send({
            status: "fail",
            message: "Error generated"
        })
    }

}