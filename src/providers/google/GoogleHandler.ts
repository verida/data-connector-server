import BaseSyncHandler from "../BaseSyncHandler";
import { google, Auth } from "googleapis";

export default class BaseGoogleHandler extends BaseSyncHandler {

    public getGoogleAuth(): Auth.OAuth2Client {
        const TOKEN = {
          access_token: this.connection.accessToken,
          refresh_token: this.connection.refreshToken,
          scope: "https://www.googleapis.com/auth/gmail.readonly",
          token_type: "Bearer",
        };
    
        const redirectUrl = "";
    
        const oAuth2Client = new google.auth.OAuth2(
          this.config.clientId,
          this.config.clientSecret,
          redirectUrl
        );

        // Handle update to access or refresh token
        const handler = this
        oAuth2Client.on('tokens', (tokens) => {
            handler.updateConnection({
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token
            })
          });
    
        oAuth2Client.setCredentials(TOKEN);
        return oAuth2Client
      }

}