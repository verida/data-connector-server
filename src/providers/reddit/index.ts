import { Request, Response } from "express";
import Base from "../BaseProvider";

import {
  BaseProviderConfig,
  ConnectionCallbackResponse,
  PassportProfile,
} from "../../interfaces";
import { RedditApi } from "./api";
import CommentsHandler from "./comments";
import { PassportStatic } from "passport";
import crypto from "crypto";

export interface RedditProviderConfig extends BaseProviderConfig {
  apiHash: string;
  appId: string;
  appSecret: string;
  callbackUrl: string;
  limitResults: boolean;
}

const passport = require("passport");
const Strategy = require("passport-reddit");

export default class RedditProvider extends Base {
  protected config: RedditProviderConfig;
  protected api?: RedditApi;

  public getProviderName() {
    return "reddit";
  }

  public getProviderLabel() {
    return "Reddit";
  }

  public getProviderApplicationUrl() {
    return "https://reddit.com/";
  }

  public setConfig(config: RedditProviderConfig) {
    this.config = config;
  }

  public syncHandlers(): any[] {
    return [
      // CommentsHandler
    ];
  }

  public async connect(req: Request, res: Response, next: any): Promise<any> {
    this.init();

    req.session.state = crypto.randomBytes(32).toString("hex");
    req.session.save((err) => console.log(err));

    const auth = await passport.authenticate("reddit");

    return auth(req, res, next);
  }

  public async callback(
    req: Request,
    res: Response,
    next: any
  ): Promise<ConnectionCallbackResponse> {
    this.init();

    const promise = new Promise((resolve, rejects) => {
      const auth = passport.authenticate(
        "reddit",
        {
          failureRedirect: "/failure/reddit",
          failureMessage: true,
          state: true,
          scope: ["identity", "read"],
        },
        function (err: any, data: any) {
          if (err) {
            rejects(err);
          } else {
            const username = data.profile.id;
            const profile = <PassportProfile>data.profile;
            const name = data.profile.name;

            const connectionToken: ConnectionCallbackResponse = {
              id: profile.id,
              accessToken: data.accessToken,
              refreshToken: data.refreshToken,
              profile: {
                username,
                ...profile,
                connectionProfile: {
                  readableId: name,
                },
                name,
                displayName: name,
              },
            };

            resolve(connectionToken);
          }
        }
      );

      auth(req, res, next);
    });

    const result = <ConnectionCallbackResponse>await promise;
    return result;
  }

  // refreshToken and this.connection is undefined
  public async getApi(
    accessToken?: string,
    refreshToken?: string
  ): Promise<RedditApi> {
    if (this.api) {
      return this.api;
    }

    const api = new RedditApi(
      accessToken ? accessToken : this.connection!.accessToken
    );
    if (!refreshToken) {
      refreshToken = this.connection ? this.connection.refreshToken : undefined;
    }

    if (!refreshToken) {
      throw new Error("Unable to load Reddit API");
    }

    // api.restoreBinFile(refreshToken);

    await api.getClient(true);
    this.api = api;
    return api;
  }

  public async close() {
    try {
      // const api = await this.getApi();
      // const binFile = await api.closeClient();

      // this.connection!.refreshToken = binFile;
    } catch (err: any) {
      // Error with binFile (possibly because auth has been disconnected), do nothing
    }
  }

  public async init() {
    passport.use(
      new Strategy.RedditStrategy(
        {
          clientID: this.config.appId,
          clientSecret: this.config.appSecret,
          // TODO 127... throws 'Cannot read properties of undefined (reading 'id')', probably same state error
          callbackURL: "http://localhost:5021/callback/reddit",
        },
        function (
          accessToken: string,
          refreshToken: string,
          profile: any,
          cb: any
        ) {
          // console.log(accessToken, refreshToken, profile, cb);
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
