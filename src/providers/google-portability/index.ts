import { Request, Response } from "express";
import Base from "../BaseProvider";
import { BaseProviderConfig, SyncProviderLogLevel } from "../../interfaces";
import { google, dataportability_v1 } from "googleapis";

const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20");

import GoogleDataPortability from './dataportability'

export interface GoogleDataPortabilityProviderConfig extends BaseProviderConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
}

export default class GoogleDataPortabilityProvider extends Base {
  protected config: GoogleDataPortabilityProviderConfig;

  public getProviderId() {
    return "google-portability";
  }

  public getProviderLabel() {
    return "Google (Data Portability)";
  }

  public getProviderApplicationUrl() {
    return "https://google.com/";
  }

  public syncHandlers(): any[] {
    return [GoogleDataPortability];
  }

  public getScopes(): string[] {
    return [
      "https://www.googleapis.com/auth/dataportability.myactivity.search",
    ];
  }

  public async connect(req: Request, res: Response, next: any): Promise<any> {
    this.init();

    const auth = await passport.authenticate("google", {
      scope: this.getScopes(),
      accessType: "offline",
    });

    return auth(req, res, next);
  }

  public async callback(req: Request, res: Response, next: any): Promise<any> {
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
            console.log("callback!");
            console.log(data);
            const connectionToken = {
              id: data.profile.id,
              accessToken: data.accessToken,
              refreshToken: data.refreshToken,
              profile: data.profile,
            };

            resolve(connectionToken);
          }
        }
      );

      auth(req, res, next);
    });

    const result = await promise;
    return result;
  }

  public async getApi(accessToken?: string, refreshToken?: string): Promise<dataportability_v1.Dataportability> {
    const TOKEN = {
      access_token: accessToken ? accessToken : this.connection.accessToken,
      refresh_token: refreshToken ? refreshToken : this.connection.refreshToken,
      scope: "https://www.googleapis.com/auth/dataportability.myactivity.search",
      token_type: "Bearer",
    };

    const redirectUrl = "";

    const oAuth2Client = new google.auth.OAuth2(
      this.config.clientId,
      this.config.clientSecret,
      redirectUrl
    );

    oAuth2Client.setCredentials(TOKEN);

    return google.dataportability({version: "v1", auth: oAuth2Client})
  }

  public init() {
    console.log(this.config);
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
