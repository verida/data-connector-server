# Slack APP configuration

1. Please go to [Slack API Apps](https://api.slack.com/apps)
2. Create new app
    - Select `From scratch`
    - Add `App Name` and select a workspace to be used for development
3. You can get `client ID` and `client Secret` from the `Basic Information` section
4. Add redirect URL and scopes in `OAuth & Permissions` section
    - Redirect URL: `https://127.0.0.1:5021/callback/slack`
    - There are two types of tokens: bot and user, and add following scopes: `channels:history`, `channels:read`, `groups:read`, `users:read`, `im:read`, `im:history`