import express from 'express'
import { controller } from './controller'
import auth from "../../../../middleware/auth";
import multer from 'multer';

// Configure Multer to store uploaded files in memory
const storage = multer.memoryStorage();
const upload = multer({ storage });

const router = express.Router()

router.get(/logs$/, controller.logs)

router.get(/clearLogs$/, controller.clearLogs)

router.post(/updateConfig$/, upload.single('file'), controller.updateConfig)

export default router