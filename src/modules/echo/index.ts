import Controller from './controller'
import Routes from './routes'

export default {
    Controller,
    Routes,
    setConfig(config: object) {
        Controller.setConfig(config)
    }
}