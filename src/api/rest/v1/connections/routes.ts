import express from 'express'
import Controller from './controller'
import auth from "../../../../middleware/auth";

const router = express.Router()
const sessionAuth = auth({
    sessionRequired: true
})

router.get('/', sessionAuth, Controller.connections)
router.post('/sync', sessionAuth, auth(), Controller.sync)
router.post('/:connectionId/sync', sessionAuth, auth(), Controller.syncConnection)
router.put('/:connectionId', sessionAuth, auth(), Controller.update)
router.delete('/:connectionId', sessionAuth, auth(), Controller.disconnect)

export default router