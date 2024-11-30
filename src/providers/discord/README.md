# Discord Connector Configuration

This guide provides instructions for configuring a Discord connector.

## Steps for Setting up a Discord App

1. **Go to the [Discord Developer Portal](https://discord.com/developers/applications)**  
   Access the Discord Developer Portal to create a new application and manage its settings.

2. **Create a New Application**
   - Click **New Application**.
   - Enter an **App Name** and select the associated workspace or team for development.

3. **Retrieve Client ID and Client Secret**
   - Under the **OAuth2** tab, locate the `Client ID` and `Client Secret`, which are required for authentication.

4. **Configure Redirect URL and Permissions Scopes**
   - Navigate to the **OAuth2** section to set up redirect URLs and required scopes.
     - **Redirect URL**: `https://127.0.0.1:5021/callback/discord`
     - Add the following scopes:       
       - `identify`
       - `guilds`
       - `guilds.members.read`
       - `messages.read`
       - `email`
       - `dm_channels.read`
       - `dm_channels.messages.read`

### Notes

Discord servers contain numerous public channels and general messages. To ensure relevant data access, We process only **Direct Messages (DMs)** here.

To use DM-related scopes, the App should be approved by Discord team due to security reasons.
## Pagination in Discord

Discord uses cursor-based pagination, which allows fetching messages in relation to specific message IDs (`before` or `after` parameters).


```
    const response = await apiClient.channels.messages.list({
        channel_id,
        limit,
        before,           // Message ID to retrieve messages sent before this ID
        after             // Message ID to retrieve messages sent after this ID
    });
```