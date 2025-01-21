import express from 'express'
import Controller from './controller'
import auth from "../../../../middleware/auth";

const router = express.Router()

router.get('/', auth(), Controller.connections)
router.post('/sync', auth(), Controller.sync)
router.post('/:connectionId/sync', auth(), Controller.syncConnection)
router.put('/:connectionId', auth(), Controller.update)
router.delete('/:connectionId', auth(), Controller.disconnect)

export default router