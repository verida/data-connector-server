import { Request, Response } from "express";
import Base from "../BaseProvider";
import BaseProviderConfig from "../BaseProviderConfig";
import Following from "./following";

const passport = require("passport");
const { OAuth2Strategy } = require("passport-google-oauth");

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
    return [Following];
  }

  public init() {
    passport.use(
      new OAuth2Strategy(
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
    const auth = await passport.authenticate("google", {
      scope: ["https://www.googleapis.com/auth/youtube.readonly"],
    });
    return auth(req, res, next);
  }

  public async callback(req: Request, res: Response, next: any): Promise<any> {
    this.init();

    const promise = new Promise((resolve, reject) => {
      const auth = passport.authenticate("google", (err: any, data: any) => {
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

  public async getApi(
    accessToken: string,
    refreshToken?: string
  ): Promise<any> {
    // Here, you would implement API requests to YouTube using the acquired accessToken.
    // Depending on what you want to achieve, this could involve using Google's APIs Node.js client.
    const { google } = require("googleapis");
    const youtube = google.youtube({
      version: "v3",
      auth: accessToken,
    });

    try {
      const response = await youtube.channels.list({
        mine: true,
        part: "snippet,contentDetails,statistics",
      });
      return response.data.items[0]; // This example assumes you want channel details
    } catch (error) {
      console.error("The API returned an error: " + error);
      throw error;
    }
  }
}
