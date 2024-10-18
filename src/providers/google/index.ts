import { Request, Response } from "express";
import Base from "../BaseProvider";
import Gmail from "./gmail";
import YouTubeFollowing from "./youtube-following";
import YouTubePost from "./youtube-post";
import { GoogleProviderConfig, GoogleProviderConnection } from "./interfaces";
import YouTubeFavourite from "./youtube-favourite";
import GoogleDriveDocument from "./gdrive-document";
import { ConnectionCallbackResponse, PassportProfile } from "../../interfaces";

const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20");

export default class GoogleProvider extends Base {
  protected config: GoogleProviderConfig
  protected connection: GoogleProviderConnection

  public getProviderName() {
    return "google";
  }

  public getProviderLabel() {
    return "Google";
  }

  public getProviderApplicationUrl() {
    return "https://google.com/";
  }

  public syncHandlers(): any[] {
    return [
      Gmail,
      YouTubeFollowing,
      YouTubePost,
      YouTubeFavourite,
      GoogleDriveDocument
    ];
  }

  public getScopes(): string[] {
    return [
        "profile",
        "openid",
        "email",
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/youtube.readonly",
        "https://www.googleapis.com/auth/drive.readonly"
    ];
  }

  public async connect(req: Request, res: Response, next: any): Promise<any> {
    this.init();

    // e: "openid email profile https://mail.google.com/", access_type: "offline"}
    const auth = await passport.authenticate("google", {
      scope: this.getScopes(),
      accessType: "offline",
    });

    return auth(req, res, next);
  }

  public async callback(req: Request, res: Response, next: any): Promise<ConnectionCallbackResponse> {
    this.init();

    const promise = new Promise((resolve, rejects) => {
      const auth = passport.authenticate(
        "google",
        {
          failureRedirect: "/failure/google",
          failureMessage: true,
        },
        function (err: any, data: any) {
          if (err) {
            rejects(err);
          } else {
            const profile = <PassportProfile> data.profile
            const email = profile.emails && profile.emails.length ? profile.emails[0].value : undefined
            const username = email ? email : profile.id
            
            const connectionToken: ConnectionCallbackResponse = {
              id: profile.id,
              accessToken: data.accessToken,
              refreshToken: data.refreshToken,
              profile: {
                username,
                ...profile,
                connectionProfile: {
                  readableId: email,
                }
              }
            };

            resolve(connectionToken);
          }
        }
      );

      auth(req, res, next);
    });

    const result = <ConnectionCallbackResponse> await promise;
    return result;
  }

  public async getApi(
    accessToken?: string,
    refreshToken?: string
  ): Promise<any> {}

  public init() {
    passport.use(
      new GoogleStrategy(
        {
          clientID: this.config.clientId,
          clientSecret: this.config.clientSecret,
          callbackURL: this.config.callbackUrl,
        },
        function (
          accessToken: string,
          refreshToken: string,
          profile: any,
          cb: any
        ) {
          // Simply return the raw data
          return cb(null, {
            accessToken,
            refreshToken,
            profile,
          });
        }
      )
    );
  }
}
