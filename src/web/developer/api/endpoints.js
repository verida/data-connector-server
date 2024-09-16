const apiPrefix = `/api/rest/v1`

const commonParams = {
    "provider": {
        "type": "string",
        "required": true,
        "documentation": "The name of the provider to connect to, ie: `google`",
        "default": "google"
    },
    "providerId": {
        "type": "string",
        "required": false,
        "documentation": "The unique provider ID to use. For example, if you have two Google accounts connected, you can specify which account. The provider ID is listed in the /dashboard/connections table.",
    },
    "query": {
        "type": "object",
        "required": false,
        "documentation": `A <a href=\"https://pouchdb.com/api.html#query_index\">pouchdb style filter</a>.
                
**Example:**

\`\`\`
{
    category: "sport",
    insertedAt: {
        "$gte": "2020-01-01"
    }
}
\`\`\`
`
    },
    "options": {
        "type": "object",
        "required": false,
        "documentation": `Additional options provided as JSON. Available options are; sort, limit, skip as per the <a href=\"https://pouchdb.com/api.html#query_index\">pouchdb documentation</a>.

**Example:**

\`\`\`
{
    sort: [{
        _id: "desc"
    }],
    limit: 20,
    skip: 0
}
\`\`\`
`,
        "default": JSON.stringify({
            sort: [{
                _id: "desc"
            }],
            limit: 20,
            skip: 0
        })
    }
}

const commonUrlVariables = {
    "databaseName": {
        "type": "string",
        "required": true,
        "documentation": "The name of the database (ie: `social_chat_group`)."
    },
    "schemaUrl": {
        "type": "string",
        "required": true,
        "documentation": "The base64 encoded URL of the datastore schema (ie: `https://common.schemas.verida.io/social/chat/group/v0.1.0/schema.json` is encoded to `aHR0cHM6Ly9jb21tb24uc2NoZW1hcy52ZXJpZGEuaW8vc29jaWFsL2NoYXQvZ3JvdXAvdjAuMS4wL3NjaGVtYS5qc29u`).\n\nEnter the schema URL in the input box and it will be automatically converted to base64.",
        "preProcessing": (value) => btoa(value),
        "default": "https://common.schemas.verida.io/social/chat/group/v0.1.0/schema.json"
    }
}

// Global JSON object with endpoint configurations
const apiEndpoints = {
    "/ds/query/{schemaUrl}": {
        "method": "POST",
        "path": `${apiPrefix}/ds/query/{schemaUrl}`,
        "documentation": "Query a datastore",
        "urlVariables": {
            "schemaUrl": commonUrlVariables.schemaUrl
        },
        "params": {
            "query": commonParams.query,
            "options": {
                "type": "object",
                "required": false,
                "documentation": "Additional options provided as JSON. Available options are; sort, limit, skip as per the <a href=\"https://pouchdb.com/api.html#query_index\">pouchdb documentation</a>.",
                "default": JSON.stringify({
                    sort: [{
                        _id: "desc"
                    }],
                    limit: 20
                })
            }
        }
    },
    "/ds/get/{schemaUrl}/{recordId}": {
        "method": "GET",
        "path": `${apiPrefix}/ds/get/{schemaUrl}/{recordId}`,
        "documentation": "Retrieves a record from a datastore.",
        "urlVariables": {
            "schemaUrl": commonUrlVariables.schemaUrl,
            "recordId": {
                "type": "string",
                "required": true,
                "documentation": "The unique ID of the record to fetch."
            }
        }
    },
    "/db/query/{databaseName}": {
        "method": "POST",
        "path": `${apiPrefix}/db/query/{databaseName}`,
        "documentation": "Query a database",
        "urlVariables": {
            "databaseName": commonUrlVariables.databaseName
        },
        "params": {
            "query": commonParams.query,
            "options": commonParams.options
        }
    },
    "/db/get/{databaseName}/{recordId}": {
        "method": "GET",
        "path": `${apiPrefix}/db/get/{databaseName}/{recordId}`,
        "documentation": "Retrieves a record from a database.",
        "urlVariables": {
            "databaseName": commonUrlVariables.databaseName,
            "recordId": {
                "type": "string",
                "required": true,
                "documentation": "The unique ID of the record to fetch."
            }
        }
    },
    "/search/universal": {
        "method": "GET",
        "path": `${apiPrefix}/search/universal`,
        "documentation": "Universal keyword search across multiple datastores",
        "params": {
            "keywords": {
                "type": "string",
                "documentation": "List of keywords to search for",
                "default": "robert gray",
                "required": true
            },
            "limit": {
                "type": "number",
                "documentation": "Limit results. Defaults to `20`.",
                "default": 5
            },
            "minResultsPerType": {
                "type": "number",
                "documentation": "Minimum number of results per type (ie: `emails`). Defaults to `5`.",
                "default": 5
            },
            "searchTypes": {
                "type": "string",
                "documentation": `Comma separated list of record types to search:

- chat-messages: Individual chat messages
- emails: Individual emails
- favorites: Individual favorites
- following: Individual social media accounts followed
- posts: Individual social media posts

Defaults to \`"emails,chat-messages"\`.
`,
                "default": `emails,chat-messages`
            }
        }
    },
    "/search/datastore/{schemaUrl}": {
        "method": "GET",
        "path": `${apiPrefix}/search/datastore/{schemaUrl}`,
        "documentation": `Execute a keyword search on a datastore.

It's possible to define the fields to index on and the fields to be stored in the search index which is then returned with results.

The index is cached for the user, until the user cache times out.

Requests with the exact same list of indexed and stored fields will re-use the same index. If there is any difference in the indexed or stored fields, a new index is created, which increases the memory footprint.

Returns:

- \`total\` - Total number of search results found in the search index
- \`items\` - Array of item results
`,
        "urlVariables": {
            "schemaUrl": commonUrlVariables.schemaUrl,
        },
        "params": {
            "keywords": {
                "type": "string",
                "documentation": "List of keywords to search for",
                "default": "robert gray",
                "required": true
            },
            "options": {
                "type": "object",
                "documentation": `Search options that match the options availalbe from the [minisearch documentation](https://www.npmjs.com/package/minisearch).

**Example:**

\`\`\`
{
    fields: ['title', 'text'],
    searchOptions: {
        boost: { title: 2 },
        fuzzy: 0.2
    }
}
\`\`\`,
`,
                "default": "{}"
            },
            "limit": {
                "type": "number",
                "documentation": "Limit how many chat threads to return. Defaults to `20`.",
                "default": 20
            },
            "fields": {
                "type": "string",
                "documentation": "Comma separated list of fields to inlude in search index (ie: `name,description`)",
                "default": "name,description"
            },
            "store": {
                "type": "string",
                "documentation": "Comma separated list of fields to store in the index and return with results (ie: `name,description`)",
                "default": "name,description"
            }
        }
    },
    "/search/chatThreads": {
        "method": "GET",
        "path": `${apiPrefix}/search/chatThreads`,
        "documentation": `Search chat messages by keyword and return matching chat threads to ensure the full message context is available.

Each result contains the chat group and an array of messages.`,
        "params": {
            "keywords": {
                "type": "string",
                "documentation": "List of keywords to search for",
                "default": "robert gray",
                "required": true
            },
            "limit": {
                "type": "number",
                "documentation": "Limit how many chat threads to return. Defaults to `20`.",
                "default": 5
            },
            "merge": {
                "type": "boolean",
                "documentation": "Merge overlapping threads. If two messages match within the same chat group, they are merged to produce a single chat group.",
                "default": true
            }
        }
    },
    "/providers": {
        "method": "GET",
        "path": `${apiPrefix}/providers`,
        "documentation": "Retrieves a list of available providers."
    },
    "/sync": {
        "method": "GET",
        "path": `${apiPrefix}/sync`,
        "documentation": "Start syncing data for a given provider",
        "params": {
            "provider": commonParams.provider,
            "providerId": commonParams.providerId,
            "force": {
                "type": "boolean",
                "required": false,
                "documentation": "Force the sync to occur, ignoring the current status of the connection."
            }
        }
    },
    "/sync/status": {
        "method": "GET",
        "path": `${apiPrefix}/sync/status`,
        "documentation": `Get the status of the current sync connection for a provider.`
    },
    "/sync/logs": {
        "method": "GET",
        "path": `${apiPrefix}/sync/logs`,
        "documentation": `Live stream of the sync logs.

This is not a typical HTTP request, it uses EventSource to stream the loading progress.

**Example code:**

\`\`\`
const eventSource = new EventSource(\`${apiPrefix}/llm/hotload?key=<key>\`);
    
eventSource.onmessage = function(event) {
    console.log(event)
}
\`\`\`
`
    },
    "/admin/memory": {
        "method": "GET",
        "path": `${apiPrefix}/admin/memory`,
        "documentation": `Memory usage of the server.

**rss (Resident Set Size):** This represents the total memory allocated for the process, including code, stack, and heap. It is the overall memory usage by the server (in bytes), which includes all allocations by the operating system, not just the memory allocated by the JavaScript engine (V8).

**heapTotal:** This is the total size of the heap that V8 (the JavaScript engine) has reserved for the server. It indicates the amount of memory allocated for the JavaScript objects and functions that your application may use.

**heapUsed:** This represents the actual memory used by JavaScript objects and functions within the total allocated heap (heapTotal). It shows how much of the heap is currently occupied by active data.

**external:** This refers to the memory used by C++ objects bound to JavaScript objects. It is memory outside of V8's JavaScript heap but managed by native code and typically allocated for objects that V8 doesn’t directly manage.

**arrayBuffers:** This is the memory allocated for ArrayBuffer and SharedArrayBuffer instances in JavaScript. It indicates how much memory is consumed specifically by array buffer-backed objects.
`
    },
    "/llm/hotload": {
        "method": "GET",
        "path": `${apiPrefix}/llm/hotload`,
        "documentation": `Hot load into memory all the data necessary for fast presonal LLM requests.

This is not a typical HTTP request, it uses EventSource to stream the loading progress.

**Example code:**

\`\`\`
const eventSource = new EventSource(\`${apiPrefix}/llm/hotload?key=<key>\`);
    
eventSource.onmessage = function(event) {
    console.log(event)
}
\`\`\`
`
    },
    "/llm/prompt": {
        "method": "POST",
        "path": `${apiPrefix}/llm/prompt`,
        "documentation": `Send a LLM prompt request to a pre-configured LLM.`,
        "params": {
            "prompt": {
                "type": "string",
                "required": true,
                "documentation": `User prompt (ie: \`Who hosted the 2000 olympics?\`)`
            }
        }
    },
    "/llm/personal": {
        "method": "POST",
        "path": `${apiPrefix}/llm/personal`,
        "documentation": `Send a LLM prompt request to the built-in personal AI LLM.`,
        "params": {
            "prompt": {
                "type": "string",
                "required": true,
                "documentation": `User prompt (ie: \`How much have I spent on software this quarter?\`)`
            }
        }
    }
};