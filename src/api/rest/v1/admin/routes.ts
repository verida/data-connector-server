import express from 'express'
import { controller } from './controller'
import auth from "../../../../middleware/auth";
import multer from 'multer';

// Configure Multer to store uploaded files in memory
const storage = multer.memoryStorage();
const upload = multer({ storage });

const router = express.Router()

router.get(/logs$/, auth({
    options: { checkAdmin: true }
}), controller.logs)

router.get(/clearLogs$/, auth({
    options: { checkAdmin: true }
}), controller.clearLogs)

router.post(/updateConfig$/, upload.single('file'), auth({
    options: { checkAdmin: true }
}), controller.updateConfig)

export default router