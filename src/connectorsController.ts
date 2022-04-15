import { Request, Response } from 'express'

import { Client, EnvironmentType } from '@verida/client-ts'
import { AutoAccount } from '@verida/account-node'

const VERIDA_ENVIRONMENT = EnvironmentType.TESTNET
const CONTEXT_NAME = 'Verida: Data Connector'
const PRIVATE_KEY = ''
const DATABASE_SERVER = 'https://db.testnet.verida.io:5002/'
const MESSAGE_SERVER = 'https://db.testnet.verida.io:5002/'
const DEFAULT_ENDPOINTS = {
    defaultDatabaseServer: {
        type: 'VeridaDatabase',
        endpointUri: 'https://db.testnet.verida.io:5002/'
    },
    defaultMessageServer: {
        type: 'VeridaMessage',
        endpointUri: 'https://db.testnet.verida.io:5002/'
    },
}

const log4js = require("log4js")
const logger = log4js.getLogger()
logger.level = "debug"

import Connectors from "./connectors"

export default class ConnectorsController {


    public static async connect(req: Request, res: Response, next: any) {
        const connector = Connectors(req.params.connector)
        return connector.connect(req, res, next)
    }

    public static async callback(req: Request, res: Response, next: any) {
        const connector = Connectors(req.params.connector)
        return connector.callback(req, res, next)
    }

    public static async sync(req: Request, res: Response, next: any) {
        const connector = Connectors(req.params.connector)
        const data = await connector.sync(req, res, next)

        const network = new Client({
            environment: VERIDA_ENVIRONMENT
        })
        const account = new AutoAccount(DEFAULT_ENDPOINTS, {
            privateKey: PRIVATE_KEY,
            environment: VERIDA_ENVIRONMENT
        })
        await network.connect(account)
        const signerDid = await account.did()

        const query = req.query
        const did = query.did

        return res.send({
            did,
            data,
            signerDid
        })
    }

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