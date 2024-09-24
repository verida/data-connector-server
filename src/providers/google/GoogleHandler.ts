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
          this.config.clientId as string,
          this.config.clientSecret as string,
          redirectUrl
        );

        // Handle update to access or refresh token
        const handler = this
        oAuth2Client.on('tokens', (tokens) => {
          const updatedConnection: Record<string, string> = {
            accessToken: tokens.access_token,
          }

          if (tokens.refresh_token) {
            updatedConnection.refreshToken = tokens.refresh_token
          }

          handler.updateConnection(updatedConnection)
        })
    
        oAuth2Client.setCredentials(TOKEN);
        return oAuth2Client
      }

}