import { Scope, ScopeType } from "./interfaces"

const SCOPES: Record<string, Scope> = {
    /**
     * API Scopes
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
        description: "Query databases (POST /db/query/$dbName)"
    },

    /**
     * Database Scopes
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
     * Datastore Scopes
     * 
     * @todo: Dynamically load these from the schemas in config
     */
    "ds:social-following": {
        type: ScopeType.DATABASE,
        description: "Social media following (ie: Facebook pages followed). See https://common.schemas.verida.io/social/following/v0.1.0/schema.json"
    },
    "ds:social-post": {
        type: ScopeType.DATABASE,
        description: "Social media posts. See https://common.schemas.verida.io/social/post/v0.1.0/schema.json"
    },
    "ds:email": {
        type: ScopeType.DATABASE,
        description: "Emails. See https://common.schemas.verida.io/social/email/v0.1.0/schema.json"
    },
    "ds:favourite": {
        type: ScopeType.DATABASE,
        description: "Favourites (ie: Liked videos, bookmarks). See https://common.schemas.verida.io/favourite/v0.1.0/schema.json"
    },
    "ds:file": {
        type: ScopeType.DATABASE,
        description: "Files (ie: Documents). See https://common.schemas.verida.io/file/v0.1.0/schema.json"
    },
    "ds:chat-group": {
        type: ScopeType.DATABASE,
        description: "Chat groups (ie: Telegram groups). See https://common.schemas.verida.io/social/chat/group/v0.1.0/schema.json"
    },
    "ds:chat-message": {
        type: ScopeType.DATABASE,
        description: "Chat messages. See https://common.schemas.verida.io/social/chat/message/v0.1.0/schema.json"
    },
    "ds:calendar": {
        type: ScopeType.DATABASE,
        description: "Calendars. See https://common.schemas.verida.io/social/calendar/v0.1.0/schema.json"
    },
    "db:event": {
        type: ScopeType.DATABASE,
        description: "Calendar events. See https://common.schemas.verida.io/social/event/v0.1.0/schema.json"
    },
}

export default SCOPES