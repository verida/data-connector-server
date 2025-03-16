# Notion Provider Configuration  

## Notion Integration Setup  

1. Go to [Notion Integrations](https://www.notion.so/my-integrations)  
2. Create a new integration:  
    - Click **New Integration**  
    - Add an integration name and redirect Urls    
    - Choose the capabilities needed (Read Content, Read Comments, Read Users)  
3. Copy the `Secret Key` and `Public Key` - store it securely  

## Authentication  

The Notion provider uses Integration Token authentication:  
- Use the Integration Token as the `accessToken`  
- No `refreshToken` is required  

## Data Access  

Notion API provides access to:  
- Pages  
- Databases  
- Blocks (content elements)  
- Users  
- Comments  

### Pagination  

Notion uses cursor-based pagination:  
- `start_cursor` and `has_more` for pagination control  
- Default page size of 100 items  
- Maximum page size of 100 items  

## Rate Limits  

- Rate limits vary by tier  
- Standard tier: ~3 requests per second  
- See [Notion API Limits](https://developers.notion.com/reference/request-limits) for current limits  

## Notes  

- Database queries support filtering and sorting  
- Block content is retrieved recursively for nested structures  
- Rich text content includes formatting metadata  
- User permissions are respected based on integration access  
- Some features may require specific Notion plan types  

#### Example – Cursor-Based Pagination  

```javascript
const response = await notion.databases.query({
    database_id: databaseId,
    page_size: 10,
    start_cursor: nextCursor,  // optional, for pagination
});
