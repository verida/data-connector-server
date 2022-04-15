import express from 'express'
import Config from './config'

export default class ModuleManager {

    private router: express.Router

    public constructor(router: express.Router) {
        this.router = router
    }

    public initialize(): express.Router {
        for (var moduleId in Config.modules) {
            const module = Config.modules[moduleId]
            module.Routes(this.router)
        }

        return this.getRouter()
    }

    public load(moduleRoutes: Function) {
        moduleRoutes(this.router)
    }

    public getRouter(): express.Router {
        return this.router
    }

}