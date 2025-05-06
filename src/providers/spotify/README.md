# Spotify Provider

## Configuration

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in with your Spotify account
3. Click `Create an App`
4. Fill in the app name and description, and choose `Web API`
5. Once created, click `Settings`
6. Note down your `Client ID` and `Client Secret`
7. Add your redirect URI (typically `http://localhost:5021/callback/spotify` for local development)

## Spotify Favourite(User's Top Tracks)

GET https://api.spotify.com/v1/me/top/tracks


### Query Parameters

| Parameter  | Value    | Description                                |
|------------|----------|--------------------------------------------|
| limit      | integer  | Optional. The maximum number of items to return. Default: 20. Minimum: 1. Maximum: 50. |
| offset     | integer  | Optional. The index of the first item to return. Default: 0 |
| time_range | string   | Optional. Over what time frame the affinities are computed. Valid values:<br>• `short_term` (last 4 weeks)<br>• `medium_term` (last 6 months)<br>• `long_term` (calculated from several years of data and including all new data as it becomes available). Default: medium_term |




