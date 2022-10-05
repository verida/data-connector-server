const assert = require("assert")
import Controller from '../src/controller'

describe(`Controller Tests`, function() {

    describe("General", () => {
        it("Can get list of available providers", async () => {
            const providers = await Controller.getProviders()

            assert.ok(providers && providers.length, 'List of providers returned')
            
            const provider = providers[0]
            assert.ok(provider.icon, 'Provider has an icon')
            assert.ok(provider.name, 'Provider has a name')
            assert.ok(provider.label, 'Provider has a label')
        })
    })
})