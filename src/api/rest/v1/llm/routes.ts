import express from 'express'
import { controller } from './controller'
import auth from "../../../../middleware/auth";
import CONFIG from "../../../../config"

const router = express.Router()

router.post('/prompt', auth({
    scopes: ["api:llm-prompt"],
    credits: CONFIG.verida.billing.routeCredits['api:llm-prompt']
}), controller.prompt)

// router.post('/personal', auth({
//     scopes: ["api:llm-personal-prompt"],
// }), controller.personalPrompt)

router.post('/profile', auth({
    scopes: ["api:llm-profile-prompt"],
    credits: CONFIG.verida.billing.routeCredits['api:llm-profile-prompt']
}), controller.profilePrompt)

router.get('/hotload', auth(), controller.hotLoad)

router.post('/agent', auth({
    scopes: ["api:llm-agent-prompt"],
    credits: CONFIG.verida.billing.routeCredits['api:llm-agent-prompt']
}), controller.agent)

export default router