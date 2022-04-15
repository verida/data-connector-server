import express from 'express'
import Controller from './controller'

export default function routes(router: express.Router): void {
    router.post('/echo', Controller.echo)
    router.get('/error', Controller.error)
}