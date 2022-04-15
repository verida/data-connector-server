import EchoModule from './modules/echo'
EchoModule.setConfig({
    exampleConfig: 'example config variable'
})

export default {
    modules: [
        EchoModule
    ]
}