import { Scope, ScopeType } from "./interfaces"

interface ScopeInfo {
    uri?: string
    description: string
}

const INVALID_SCOPE_REGEXES: RegExp[] = [
    // User wallets
    /db:([rwd]*):user_wallet/,
    /\/wallets\/([^\/]*)\/schema.json/,
    // Storage database
    /db:([rwd]*):storage_database/,
    /\/storage\/database\/([^\/]*)\/schema.json/
]

export const DATASTORE_LOOKUP: Record<string, ScopeInfo> = {
    "social-following": {
        uri: "https://common.schemas.verida.io/social/following/v0.1.0/schema.json",
        description: "Social media following (ie: Facebook pages followed)"
    },
    "social-post": {
        uri: "https://common.schemas.verida.io/social/post/v0.1.0/schema.json",
        description: "Social media post"
    },
    "social-email": {
        uri: "https://common.schemas.verida.io/social/email/v0.1.0/schema.json",
        description: "Emails"
    },
    "favourite": {
        uri: "https://common.schemas.verida.io/favourite/v0.1.0/schema.json",
        description: "Favourites (ie: Liked videos, bookmarks)"
    },
    "file": {
        uri: "https://common.schemas.verida.io/file/v0.1.0/schema.json",
        description: "Files (ie: Documents)"
    },
    "social-chat-group": {
        uri: "https://common.schemas.verida.io/social/chat/group/v0.1.0/schema.json",
        description: "Chat groups (ie: Telegram groups)"
    },
    "social-chat-message": {
        uri: "https://common.schemas.verida.io/social/chat/message/v0.1.0/schema.json",
        description: "Chat messages (ie: Telegram messages)"
    },
    "social-calendar": {
        uri: "https://common.schemas.verida.io/social/calendar/v0.1.0/schema.json",
        description: "Calendars (ie: Personal Google Calendar)"
    },
    "social-event": {
        uri: "https://common.schemas.verida.io/social/event/v0.1.0/schema.json",
        description: "Calendar events (ie: Meeting with Jane)"
    },
}

export function isKnownSchema(schemaUrl: string) {
    const knownSchemas = Object.values(DATASTORE_LOOKUP).map(item => item.uri)
    return knownSchemas.indexOf(schemaUrl) !== -1
}

export const DATABASE_LOOKUP: Record<string, ScopeInfo> = {
    "db:social_following": {
        description: `Social media followings (ie: Facebook pages followed)`
    },
    "db:social_post": {
        description: `Social media posts`
    },
    "db:social_email": {
        description: `Emails`
    },
    "db:favourite": {
        description: `Favourites (ie: Liked videos, bookmarks)`
    },
    "db:file": {
        description: `Files (ie: Google docs)`
    },
    "db:social_chat_group": {
        description: `Chat groups (ie: Telegram groups)`
    },
    "db:social_chat_message": {
        description: `Chat messages`
    },
    "db:calendar_data": {
        description: `Calendars database`
    },
    "db:calendar_event": {
        description: `Calendars`
    },
    "db:social_event": {
        description: `Calendar events`
    }
}

/**
 * Take an array of scopes and expand any short hand scopes (ie: ds:file) to
 * the full scope. Convert base64 encoded URL scopes to have the actual URL.
 * 
 * @param scopes 
 */
export function expandScopes(scopes: string[], expandPermissions: boolean = true): string[] {
    const expandedScopes: string[] = []
    for (const i in scopes) {
        let scope = scopes[i]

        // Unwrap base64 encoded URL scopes to expanded URL scopes
        const matches = scope.match(/(r|rw|rwd):base64\/(.*)/)
        if (matches && matches.length == 3) {
            const base64Url = Buffer.from(matches[2], 'base64')
            scope = scopes[i] = `ds:${matches[1]}:${base64Url.toString('utf-8')}`
        }

        // Skip scope if it's not permitted
        let skipScope = false
        for (const regex of INVALID_SCOPE_REGEXES) {
            if (scope.match(regex)) {
                skipScope = true
                break
            }
        }

        if (skipScope) {
            continue
        }

        // Expand read / write scopes
        const matches2 = scope.match(/(ds|db):(r|rw|rwd):(.*)/)
        if (matches2 && matches2.length == 4) {
            const scopeType = matches2[1]       // ie: ds
            const permissions = matches2[2]     // ie: rw
            let grant = matches2[3]           // ie: social-event

            // Convert URL shorthand scopes to full scopes
            if (typeof DATASTORE_LOOKUP[grant] !== "undefined" && scopeType == "ds") {
                grant = DATASTORE_LOOKUP[grant].uri
            }

            if (expandPermissions) {
                switch (permissions) {
                    case "r":
                        expandedScopes.push(`${scopeType}:r:${grant}`)
                        break
                    case "rw":
                        expandedScopes.push(`${scopeType}:r:${grant}`)
                        expandedScopes.push(`${scopeType}:w:${grant}`)
                        break
                    case "rwd":
                        expandedScopes.push(`${scopeType}:r:${grant}`)
                        expandedScopes.push(`${scopeType}:w:${grant}`)
                        expandedScopes.push(`${scopeType}:d:${grant}`)
                        break
                }
            } else {
                expandedScopes.push(`${scopeType}:${permissions}:${grant}`)
            }

            scope = undefined
        }

        if (scope) {
            expandedScopes.push(scope)
        }
    }

    return expandedScopes
}

/**
 * API Scopes
 */
const SCOPES: Record<string, Scope> = {
    /**
     * Database API Scopes
     */
    "api:db-get-by-id": {
        type: ScopeType.API,
        description: "Get database record by ID (GET /db/$dbName/$id)",
        userNote: `Get individual database records`
    },
    "api:db-create": {
        type: ScopeType.API,
        description: "Create a database record (POST /db/$dbName)",
        userNote: `Create database records`
    },
    "api:db-update": {
        type: ScopeType.API,
        description: "Update a database record (PUT /db/$dbName/$id)",
        userNote: `Update database records`
    },
    "api:db-query": {
        type: ScopeType.API,
        description: "Query a database (POST /db/query/$dbName)",
        userNote: `Query a database`
    },

    /**
     * Datastore API Scopes
     */
    "api:ds-get-by-id": {
        type: ScopeType.API,
        description: "Get datastore record by ID (GET /ds/$dsUrlEncoded/$id)",
        userNote: `Get individual data`
    },
    "api:ds-create": {
        type: ScopeType.API,
        description: "Create a datastore record (POST /ds/$dsUrlEncoded)",
        userNote: `Create new data`
    },
    "api:ds-update": {
        type: ScopeType.API,
        description: "Update a datastore record (PUT /ds/$dsUrlEncoded/$id)",
        userNote: `Update data`
    },
    "api:ds-query": {
        type: ScopeType.API,
        description: "Query a datastore (POST /ds/query/$dsUrlEncoded) or watch a datastore (GET /ds/watch/$dsUrlEncoded)",
        userNote: `Query data`
    },
    "api:ds-delete": {
        type: ScopeType.API,
        description: "Delete a record from a datastore (DELETE /ds/$dsUrlEncoded/$id)",
        userNote: `Delete data`
    },

    /**
     * Datastore Access Scopes
     * 
     * Dynamically injected below
     */
    "api:llm-prompt": {
        type: ScopeType.API,
        description: "Run a LLM prompt without access to user data",
        userNote: `Run a LLM prompt without access to user data`
    },
    "api:llm-agent-prompt": {
        type: ScopeType.API,
        description: "Run a LLM agent prompt that has access to user data",
        userNote: `Run a LLM agent prompt that has access to user data`
    },
    "api:llm-profile-prompt": {
        type: ScopeType.API,
        description: "Run a LLM prompt to generate a profile based on user data",
        userNote: `Run a LLM prompt to generate a profile based on user data`
    },
    

    "api:search-chat-threads": {
        type: ScopeType.API,
        description: "Perform keyword search across all chat threads",
        userNote: `Perform keyword search across all chat threads`
    },
    "api:search-ds": {
        type: ScopeType.API,
        description: "Perform keywords search across a datastore",
        userNote: `Perform keywords search across specific types of data`
    },
    "api:search-universal": {
        type: ScopeType.API,
        description: "Perform a keyword search across all user data",
        userNote: `Perform a keyword search across all accessible data`
    }
}

for (const datastoreId in DATASTORE_LOOKUP) {
    const datastore = DATASTORE_LOOKUP[datastoreId]

    const base64Uri = Buffer.from(datastore.uri).toString('base64')
    SCOPES[`ds:r:base64/${base64Uri}`] = {
        type: ScopeType.DATASTORE,
        description: `Read access. Base64 encoded alias for scope "ds:${datastoreId}"`
    }
    SCOPES[`ds:rw:base64/${base64Uri}`] = {
        type: ScopeType.DATASTORE,
        description: `Read and write access. Base64 encoded alias for scope "ds:${datastoreId}"`
    }
    SCOPES[`ds:rwd:base64/${base64Uri}`] = {
        type: ScopeType.DATASTORE,
        description: `Read, write and delete access. Base64 encoded alias for scope "ds:${datastoreId}"`
    }

    SCOPES[`ds:r:${datastoreId}`] = {
        type: ScopeType.DATASTORE,
        description: `Read access. ${datastore.description}. See ${datastore.uri}`
    }
    SCOPES[`ds:rw:${datastoreId}`] = {
        type: ScopeType.DATASTORE,
        description: `Read and write access. ${datastore.description}. See ${datastore.uri}`
    }
    SCOPES[`ds:rwd:${datastoreId}`] = {
        type: ScopeType.DATASTORE,
        description: `Read, write and delete access. ${datastore.description}. See ${datastore.uri}`
    }
}

export default SCOPES