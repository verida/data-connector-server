import express from 'express'
import Controller from './controller'

const router = express.Router()

router.get('/', Controller.connections)
router.post('/sync', Controller.sync)
router.post('/:connectionId/sync', Controller.syncConnection)
router.put('/:connectionId', Controller.update)
router.delete('/:connectionId', Controller.disconnect)

export default router