import { Scope, ScopeType } from "./interfaces"

interface DatastoreInfo {
    uri: string
    description: string
}

const DATASTORE_LOOKUP: Record<string, DatastoreInfo> = {
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
        description: " Calendar events (ie: Meeting with Jane)"
    },
}

/**
 * Take an array of scopes and convert any short hand scopes (ie: ds:file) to
 * the URL format scope (ie: ds:base64/ac123)
 * 
 * @param scopes 
 */
export function convertDsScopes(scopes: string[]): string[] {
    for (const i in scopes) {
        const scope = scopes[i]
        const matches = scope.match(/base64\/(.*)/)
        if (matches.length == 2) {
            const base64Url = Buffer.from(matches[1], 'base64')
            scopes[i] = base64Url.toString('utf-8')
        }
    }

    return scopes
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
        description: "Get database record by ID (GET /db/$dbName/$id)"
    },
    "api:db-create": {
        type: ScopeType.API,
        description: "Create a database record (POST /db/$dbName)"
    },
    "api:db-update": {
        type: ScopeType.API,
        description: "Update a database record (PUT /db/$dbName/$id)"
    },
    "api:db-query": {
        type: ScopeType.API,
        description: "Query a database (POST /db/query/$dbName)"
    },

    /**
     * Database Access Scopes
     */
    "db:social_following": {
        type: ScopeType.DATABASE,
        description: "Social media following database (ie: Facebook pages followed)"
    },
    "db:social_post": {
        type: ScopeType.DATABASE,
        description: "Social media post database"
    },
    "db:social_email": {
        type: ScopeType.DATABASE,
        description: "Email database"
    },
    "db:favourite": {
        type: ScopeType.DATABASE,
        description: "Favourites database (ie: Liked videos, bookmarks)"
    },
    "db:file": {
        type: ScopeType.DATABASE,
        description: "Files database (ie: Documents)"
    },
    "db:social_chat_group": {
        type: ScopeType.DATABASE,
        description: "Chat groups (ie: Telegram groups)"
    },
    "db:social_chat_message": {
        type: ScopeType.DATABASE,
        description: "Chat messages"
    },
    "db:calendar_data": {
        type: ScopeType.DATABASE,
        description: "Calendars (deprecated, use calendar_event)"
    },
    "db:calendar_event": {
        type: ScopeType.DATABASE,
        description: "Calendars"
    },
    "db:social_event": {
        type: ScopeType.DATABASE,
        description: "Calendar events"
    },

    /**
     * Datastore API Scopes
     */
    "api:ds-get-by-id": {
        type: ScopeType.API,
        description: "Get datastore record by ID (GET /ds/$dsUrlEncoded/$id)"
    },
    "api:ds-create": {
        type: ScopeType.API,
        description: "Create a datastore record (POST /ds/$dsUrlEncoded)"
    },
    "api:ds-update": {
        type: ScopeType.API,
        description: "Update a datastore record (PUT /ds/$dsUrlEncoded/$id)"
    },
    "api:ds-query": {
        type: ScopeType.API,
        description: "Query a datastore (POST /ds/query/$dsUrlEncoded) or watch a datastore (GET /ds/watch/$dsUrlEncoded)"
    },
    "api:ds-delete": {
        type: ScopeType.API,
        description: "Query a datastore (DELETE /ds/$dsUrlEncoded/$id)"
    },

    /**
     * Datastore Access Scopes
     * 
     * Dynamically injected below
     */
    "api:llm-prompt": {
        type: ScopeType.LLM,
        description: "Run a LLM prompt without access to user data"
    },
    "api:llm-agent-prompt": {
        type: ScopeType.LLM,
        description: "Run a LLM agent prompt that has access to user data"
    },
    "api:llm-profile-prompt": {
        type: ScopeType.LLM,
        description: "Run a LLM prompt to generate a profile based on user data"
    },
    

    "api:search-chat-threads": {
        type: ScopeType.SEARCH,
        description: "Perform keyword search across all chat threads"
    },
    "api:search-ds": {
        type: ScopeType.SEARCH,
        description: "Perform keywords search across a datastore"
    },
    "api:search-universal": {
        type: ScopeType.SEARCH,
        description: "Perform a keyword search across all user data"
    }
}

for (const datastoreId in DATASTORE_LOOKUP) {
    const datastore = DATASTORE_LOOKUP[datastoreId]

    const base64Uri = Buffer.from(datastore.uri).toString('base64')
    SCOPES[`ds:base64/${base64Uri}`] = {
        type: ScopeType.DATASTORE,
        description: `Base64 encoded alias for scope "ds:${datastoreId}"`
    }
    SCOPES[`ds:${datastoreId}`] = {
        type: ScopeType.DATASTORE,
        description: `${datastore.description}. See ${datastore.uri}`
    }
}

export default SCOPES