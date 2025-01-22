import express from 'express'
import { controller } from './controller'
import auth from "../../../../middleware/auth";

const router = express.Router()

router.post('/prompt', auth({
    scopes: ["api:llm-prompt"],
    credits: 2
}), controller.prompt)

// router.post('/personal', auth({
//     scopes: ["api:llm-personal-prompt"],
// }), controller.personalPrompt)

router.post('/profile', auth({
    scopes: ["api:llm-profile-prompt"],
    credits: 5
}), controller.profilePrompt)

router.get('/hotload', auth(), controller.hotLoad)

router.post('/agent', auth({
    scopes: ["api:llm-agent-prompt"],
    credits: 5
}), controller.agent)

export default router