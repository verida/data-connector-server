const assert = require("assert");
import Axios from "axios"
import https from 'https';
import CONFIG from "../../src/config"

import { authenticate, resolveScopes, revokeToken } from "./utils";
import { expandScopes } from "../../src/api/rest/v1/auth/scopes";

const ENDPOINT = `${CONFIG.serverUrl}/api/rest/v1`
const AUTH_ENDPOINT = `${ENDPOINT}/auth`
const SCOPES = ["test-scope"]
const GRANTED_DATASTORE = "https://common.schemas.verida.io/social/post/v0.1.0/schema.json"
const DENIED_DATASTORE = "https://common.schemas.verida.io/social/email/v0.1.0/schema.json"

// Create an https.Agent that disables certificate validation
const agent = new https.Agent({
    rejectUnauthorized: false,
});

const axios = Axios.create({
    httpsAgent: agent,
});

describe(`Auth tests`, function () {
    this.timeout(200 * 1000)

    let authCode, authCode2, authCode3, sessionToken, sessionToken2, sessionToken3, userAuthToken

    it(`Can issue an auth token for a third party app`, async () => {
        try {
            const authResponse = await authenticate(SCOPES)
            authCode = authResponse.authCode
            sessionToken = authResponse.sessionToken

            assert.ok(authCode, 'Have an auth code')
        } catch (err) {
            assert.fail(`Failed: ${err.message}`)
        }
    })

    it(`Can make a valid scoped request`, async() => {
        try {
            const response = await axios.get(`${AUTH_ENDPOINT}/check-scope?scope=test-scope`, {
                headers: {
                    Authorization: `Bearer ${authCode}`,
                  }
            })

            assert.ok(response.data, 'Have a response')
            assert.equal(response.data.authenticated, true, 'Successfully authenticated')
        } catch (err) {
            console.error(err.message)
            console.error(err.response.data)
            assert.fail('Failed')
        }
    })

    it(`Can make an invalid scoped request`, async() => {
        try {
            const response = await axios.get(`${AUTH_ENDPOINT}/check-scope?scope=invalid-scope`, {
                headers: {
                    Authorization: `Bearer ${authCode}`,
                }
            })

            assert.ok(response.data, 'Have a response')
            assert.equal(response.data.authenticated, false, 'Failed authentication')
        } catch (err) {
            console.error(err.message)
            console.error(err.response.data)
            assert.fail('Failed')
        }
    })

    it(`Can fetch auth tokens`, async() => {
        try {
            const response = await axios.get(`${AUTH_ENDPOINT}/tokens`, {
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": sessionToken
                }
            })

            assert.ok(response.data, 'Have a response')
            assert.ok(response.data.tokens.length, 'Have tokens')
        } catch (err) {
            console.error(err.message)
            console.error(err.response)
            assert.fail('Failed')
        }
    })

    it(`Can fetch info for current token`, async() => {
        try {
            const response = await axios.get(`${AUTH_ENDPOINT}/token?tokenId=${encodeURIComponent(authCode)}`)

            assert.ok(response.data, 'Have a response')
            assert.ok(response.data.token && response.data.token._id, 'Have token data')
        } catch (err) {
            console.error(err.message)
            console.error(err.response)
            assert.fail('Failed')
        }
    })

    it(`Can't revoke an auth token using an auth token`, async() => {
        try {
            const tokenId = authCode.substring(0,36)
            await axios.get(`${AUTH_ENDPOINT}/revoke?tokenId=${tokenId}`, {
                headers: {
                    Authorization: `Bearer ${authCode}`,
                }
            })

            assert.fail('Incorrectly revoked auth token')
        } catch (err) {
            if (err.response.status == 403) {
                assert.ok(err.response.data.error.match('Invalid token'), 'No credentials error correctly returned')
            } else {
                console.error(err.message)
                console.error(err.response)
                assert.fail('Failed')
            }
        }
    })

    it(`Can revoke an auth token`, async() => {
        try {
            const tokenId = authCode.substring(0,36)
            const response = await axios.get(`${AUTH_ENDPOINT}/revoke?tokenId=${tokenId}`, {
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": sessionToken
                },
            })

            assert.ok(response.data, 'Have a response')
            assert.equal(response.data.revoked, true, 'Successfully revoked token')
        } catch (err) {
            console.error(err.message)
            console.error(err.response)
        }
    })

    it(`Can no longer use revoked token`, async() => {
        try {
            await axios.get(`${AUTH_ENDPOINT}/check-scope?scope=test-scope`, {
                headers: {
                    Authorization: `Bearer ${authCode}`,
                }
            })

            assert.fail('Revoked token was successfully used')
        } catch (err) {
            if (err.response.status == 403) {
                assert.ok(err.response.data.error.match('Invalid token'), 'Invalid token error returned')
            } else {
                console.error(err.message)
                console.error(err.response.data)
                assert.fail('Failed')
            }
        }
    })

    it(`Can issue an auth token to a user`, async () => {
        try {
            const response = await axios.post(`${AUTH_ENDPOINT}/token`, {
                scopes: SCOPES
            }, {
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": sessionToken
                },
            })

            assert.ok(response.data, 'Have a response')
            assert.ok(response.data.token, 'Have a token')
            userAuthToken = response.data.token
        } catch (err) {
            console.error(err.message)
            console.error(err.response.data)
            assert.fail('Failed')
        }
    })

    it(`Can revoke a user generated auth token`, async() => {
        try {
            const tokenId = userAuthToken.substring(0,36)
            const response = await axios.get(`${AUTH_ENDPOINT}/revoke?tokenId=${tokenId}`, {
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": sessionToken
                },
            })

            assert.ok(response.data, 'Have a response')
            assert.equal(response.data.revoked, true, 'Successfully revoked token')
        } catch (err) {
            console.error(err.message)
            console.error(err.response)
            assert.fail('Failed')
        }
    })

    it(`Can get a list of all supported scopes`, async() => {
        try {
            const response = await axios.get(`${AUTH_ENDPOINT}/scopes`)

            // console.log(response.data.scopes)

            assert.ok(response.data, 'Have a response')
            assert.ok(Object.keys(response.data.scopes).length, 'Have scopes')
            assert.ok(response.data.scopes["ds:r:file"].description, 'Scopes have a description')
        } catch (err) {
            console.error(err)
            console.error(err.response)
            assert.fail('Failed')
        }
    })

    it(`Can successfully expand supported scopes`, async() => {
        const testSchemaUrl = "https://common.schemas.verida.io/social/event/v0.1.0/schema.json"
        const b64Url = Buffer.from(testSchemaUrl).toString('base64')

        const fileSchema = "https://common.schemas.verida.io/file/v0.1.0/schema.json"
        const favouriteSchema = "https://common.schemas.verida.io/favourite/v0.1.0/schema.json"
        const socialEventSchema = "https://common.schemas.verida.io/social/event/v0.1.0/schema.json"

        const testScopes = [
            "ds:r:file",
            "ds:rw:favourite",
            "ds:rwd:social-event",
            "db:r:file",
            "db:rw:favourite",
            "db:rwd:social_event",
            `ds:rwd:base64/${b64Url}`,
            "api:llm-agent-prompt"
        ]        

        const { resolvedScopes, scopeValidity } = expandScopes(testScopes)

        const expectedScopes = [
            `ds:r:${fileSchema}`,
            `ds:r:${favouriteSchema}`,
            `ds:w:${favouriteSchema}`,
            `ds:r:${socialEventSchema}`,
            `ds:w:${socialEventSchema}`,
            `ds:d:${socialEventSchema}`,
            'db:r:file',
            'db:r:favourite',
            'db:w:favourite',
            'db:r:social_event',
            'db:w:social_event',
            'db:d:social_event',
            `ds:r:${testSchemaUrl}`,
            `ds:w:${testSchemaUrl}`,
            `ds:d:${testSchemaUrl}`,
            "api:llm-agent-prompt"
          ]

          assert.deepEqual(resolvedScopes, expectedScopes, 'Expanded scopes match expected scopes')

          const expectedScopeValidity = {
            'ds:r:file': true,
            'ds:rw:favourite': true,
            'ds:rwd:social-event': true,
            'db:r:file': true,
            'db:rw:favourite': true,
            'db:rwd:social_event': true,
            'ds:rwd:https://common.schemas.verida.io/social/event/v0.1.0/schema.json': true,
            'api:llm-agent-prompt': true
          }

          assert.deepEqual(scopeValidity, expectedScopeValidity, 'Scope validity matches expected scopes')
    })

    it(`Can successfully resolve scopes`, async() => {
        const testSchemaUrl = "https://common.schemas.verida.io/social/event/v0.1.0/schema.json"
        const b64Url = Buffer.from(testSchemaUrl).toString('base64')

        const testScopes = [
            // Add scopes that are not permitted
            "ds:r:https://vault.schemas.verida.io/wallets/v0.1.0/schema.json",
            "ds:rwd:https://vault.schemas.verida.io/wallets/v0.1.1/schema.json",
            `ds:r:base64/${Buffer.from('https://vault.schemas.verida.io/wallets/v0.2.0/schema.json').toString('base64')}`,
            "ds:r:https://core.schemas.verida.io/storage/database/v0.1.0/schema.json",
            "ds:r:https://core.schemas.verida.io/invalid/v0.1.0/schema.json",
            "db:r:storage_database",
            "db:r:user_wallet",
            "db:rwd:user_wallet",
            // Add scopes that are valid
            "ds:r:file",
            "ds:rw:favourite",
            "ds:rwd:social-event",
            "db:r:file",
            "db:rw:favourite",
            "db:rwd:social_event",
            `ds:rwd:base64/${b64Url}`,
            "api:llm-agent-prompt",
            "api:invalid"
        ]

        const expectedScopesResponse = [
            {
              type: 'ds',
              permissions: [ 'r' ],
              description: 'A file',
              name: 'File',
              uri: 'https://common.schemas.verida.io/file/v0.1.0/schema.json',
              knownSchema: true
            },
            {
              type: 'ds',
              permissions: [ 'r', 'w' ],
              description: 'Favourite links across all platforms',
              name: 'Favourite',
              uri: 'https://common.schemas.verida.io/favourite/v0.1.0/schema.json',
              knownSchema: true
            },
            {
              type: 'ds',
              permissions: [ 'r', 'w', 'd' ],
              description: 'Schema for a calendar event',
              name: 'Event',
              uri: 'https://common.schemas.verida.io/social/event/v0.1.0/schema.json',
              knownSchema: true
            },
            {
              type: 'db',
              name: 'file',
              permissions: [ 'r' ],
              description: 'Files (ie: Google docs)'
            },
            {
              type: 'db',
              name: 'favourite',
              permissions: [ 'r', 'w' ],
              description: 'Favourites (ie: Liked videos, bookmarks)'
            },
            {
              type: 'db',
              name: 'social_event',
              permissions: [ 'r', 'w', 'd' ],
              description: 'Calendar events'
            },
            {
              type: 'ds',
              permissions: [ 'r', 'w', 'd' ],
              description: 'Schema for a calendar event',
              name: 'Event',
              uri: 'https://common.schemas.verida.io/social/event/v0.1.0/schema.json',
              knownSchema: true
            },
            {
              type: 'api',
              name: 'llm-agent-prompt',
              description: 'Run a LLM agent prompt that has access to user data'
            }
        ]

        const expectedScopeValidity = {
            'ds:r:https://vault.schemas.verida.io/wallets/v0.1.0/schema.json': false,
            'ds:rwd:https://vault.schemas.verida.io/wallets/v0.1.1/schema.json': false,
            'ds:r:https://vault.schemas.verida.io/wallets/v0.2.0/schema.json': false,
            'ds:r:https://core.schemas.verida.io/storage/database/v0.1.0/schema.json': false,
            'ds:r:https://core.schemas.verida.io/invalid/v0.1.0/schema.json': false,
            'db:r:storage_database': false,
            'db:r:user_wallet': false,
            'db:rwd:user_wallet': false,
            'ds:r:file': true,
            'ds:rw:favourite': true,
            'ds:rwd:social-event': true,
            'db:r:file': true,
            'db:rw:favourite': true,
            'db:rwd:social_event': true,
            'ds:rwd:https://common.schemas.verida.io/social/event/v0.1.0/schema.json': true,
            'api:llm-agent-prompt': true,
            'api:invalid': false
        }

        try {
            const response = await resolveScopes(AUTH_ENDPOINT, testScopes)

            assert.ok(response.data, 'Have a response')
            assert.ok(Object.keys(response.data.scopes).length, 'Have scopes')
            assert.deepEqual(expectedScopesResponse, response.data.scopes, 'Resolved scopes match expected scopes response')

            assert.ok(Object.keys(response.data.scopeValidity).length, 'Have scope validity')
            assert.deepEqual(expectedScopeValidity, response.data.scopeValidity, 'Resolved scopes validity match expected values')
        } catch (err) {
            console.error(err)
            console.error(err.response)
            assert.fail('Failed')
        }
    })

    it(`Can successfully resolve scopes - edgecases`, async() => {
        try {
            // A single scope, resolves
            let response
            response = await resolveScopes(AUTH_ENDPOINT, ["api:llm-agent-prompt"])
            assert.equal(response.data.scopes.length, 1, "A single scope is returned")
            assert.equal(response.data.scopes[0].name, "llm-agent-prompt", "Correct scope name returned")
            assert.equal(response.data.scopes[0].type, "api", "Correct scope type returned")

            // An invalid api scope returns empty scopes
            response = await resolveScopes(AUTH_ENDPOINT, ["api:invalid"])
            assert.equal(response.data.scopes.length, 0, "Scopes are empty")
        } catch (err) {
            console.error(err)
            console.error(err.response)
            assert.fail('Failed')
        }
    })

    it(`Can successfully make middleware requests with appropriate scopes`, async() => {
        const authResponse = await authenticate([
            "api:ds-query",
            "api:llm-agent-prompt",
            "api:search-ds",
            `ds:r:${GRANTED_DATASTORE}`
        ])
        authCode2 = authResponse.authCode
        sessionToken2 = authResponse.sessionToken

        try {
            // Make ds search (granted datastore)
            const r1 = await axios.post(`${ENDPOINT}/search/datastore/${btoa(GRANTED_DATASTORE)}`, {
                keywords: "phone number",
                index: ["name"]
            }, {
                headers: {
                    Authorization: `Bearer ${authCode2}`,
                }
            })

            assert.ok(r1.data, "Response")
            assert.ok(r1.data.total >= 0, "Valid response")
        } catch (err) {
            assert.fail('Failed to search granted datastore')
        }

        // Make ds search (denied datastore)
        try {
            await axios.post(`${ENDPOINT}/search/datastore/${btoa(DENIED_DATASTORE)}`, {
                keywords: "phone number",
                index: ["name"]
            }, {
                headers: {
                    Authorization: `Bearer ${authCode2}`,
                }
            })
            
            assert.fail("Denied datastore was accessible")
        } catch (err)  {
            assert.ok(err.response.data.error.match('invalid scope'))
        }

        // Make LLM agent prompt query
        try {
            const response = await axios.post(`${ENDPOINT}/llm/agent`, {
                prompt: "Generate JSON list of the names of all the tools you can access",
            }, {
                headers: {
                    Authorization: `Bearer ${authCode2}`,
                }
            })
            
            const expectedTools = [ 'SocialPostFetch', 'SocialPostQuery', 'KeywordIndex', 'WebSearch' ]
            assert.deepEqual(response.data.tools, expectedTools, 'Expected tools returned')
        } catch (err)  {
            console.log(err.message)
            console.log(err.response.data)
            assert.fail("Failed to make LLM request")
        }

        // @todo: check that if you have access to no datastores, then you can't access any (rather than access all)
    })

    it(`No datastore access if no datastores granted (edge case test)`, async() => {
        const authResponse = await authenticate([
            "api:search-ds",
        ])
        authCode3 = authResponse.authCode
        sessionToken3 = authResponse.sessionToken

        // Make ds search (denied datastore)
        try {
            await axios.post(`${ENDPOINT}/search/datastore/${btoa(DENIED_DATASTORE)}`, {
                keywords: "phone number",
                index: ["name"]
            }, {
                headers: {
                    Authorization: `Bearer ${authCode3}`,
                }
            })
            
            assert.fail("Denied datastore was accessible")
        } catch (err)  {
            assert.ok(err.response.data.error.match('invalid scope'), 'Invalid scope error returned')
            assert.ok(err.response.data.error.match(DENIED_DATASTORE), 'Error mentions denied datastore')
        }
    })

    this.afterAll(async () => {
        await revokeToken(authCode, sessionToken2)
        await revokeToken(authCode2, sessionToken2)
        await revokeToken(authCode3, sessionToken3)
    })
})