import { Request, Response } from "express";
import Base from "../BaseProvider";
import BaseProviderConfig from "../BaseProviderConfig";
import Following from "./following";
import Posts from "./posts";
import TokenExpiredError from "../TokenExpiredError";

const passport = require("passport");
const { Strategy: YoutubeV3Strategy } = require("passport-youtube-v3");
const { google } = require("googleapis");
export interface YouTubeProviderConfig extends BaseProviderConfig {
  clientID: string;
  clientSecret: string;
  callbackUrl: string;
}

export default class YouTubeProvider extends Base {
  protected config: YouTubeProviderConfig;

  public getProviderId() {
    return "youtube";
  }

  public getProviderLabel() {
    return "YouTube";
  }

  public syncHandlers(): any[] {
    return [Following, Posts];
  }

  public init() {
    passport.use(
      new YoutubeV3Strategy(
        {
          clientID: this.config.clientID,
          clientSecret: this.config.clientSecret,
          callbackURL: this.config.callbackUrl,
          scope: ["https://www.googleapis.com/auth/youtube.readonly"],
        },
        (accessToken: string, refreshToken: string, profile: any, cb: any) => {
          return cb(null, {
            accessToken,
            refreshToken,
            profile,
          });
        }
      )
    );
  }

  public async connect(req: Request, res: Response, next: any): Promise<any> {
    this.init();
    const auth = await passport.authenticate("youtube");
    return auth(req, res, next);
  }

  public async callback(req: Request, res: Response, next: any): Promise<any> {
    this.init();

    const promise = new Promise((resolve, reject) => {
      const auth = passport.authenticate("youtube", (err: any, data: any) => {
        if (err) {
          reject(err);
        } else {
          const connectionToken = {
            id: data.profile.id,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            profile: data.profile,
          };
          resolve(connectionToken);
        }
      });
      auth(req, res, next);
    });

    const result = await promise;
    return result;
  }

  public async getApi(accessToken: string, refreshToken?: string): Promise<any> {
    let oauth2Client;

    try {
      oauth2Client = new google.auth.OAuth2(this.config.clientID, this.config.clientSecret);
      oauth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
      await oauth2Client.getAccessToken();
    } catch (error) {
      console.log("Access token has expired, attempting to refresh");

      try {
        const tokenResponse = await oauth2Client.refreshToken(refreshToken);
        oauth2Client.setCredentials({
          access_token: tokenResponse.tokens.access_token,
          refresh_token: tokenResponse.tokens.refresh_token || refreshToken,
        });

        this.setAccountAuth(tokenResponse.tokens.access_token, tokenResponse.tokens.refresh_token || refreshToken);
      } catch (err) {
        console.error("Failed to refresh the access token:", err.message);
        throw new TokenExpiredError(err.message);
      }
    }

    const youtube = google.youtube({
      version: "v3",
      auth: oauth2Client,
    });

    return youtube;
  }
}
