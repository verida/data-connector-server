import { Request, Response } from "express";
import Base from "../BaseProvider";

import {
  BaseProviderConfig,
  ConnectionCallbackResponse,
  PassportProfile,
} from "../../interfaces";
import { RedditApi } from "./api";
import crypto from "crypto";
import MessageHandler from "./message";
import CommentHandler from "./comment";
import SubredditHandler from "./subreddit";
import PostHandler from "./post";

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
      MessageHandler,
      // CommentHandler,
      // SubredditHandler,
      // PostHandler
    ];
  }

  public async connect(req: Request, res: Response, next: any): Promise<any> {
    this.init();

    req.session.state = crypto.randomBytes(32).toString("hex");
    req.session.save((err) => console.log(err));

    const auth = await passport.authenticate("reddit", {
      // NOTE Setting this to permanent returns a refresh token
      duration: "permanent",
      scope: ["identity", "read", "privatemessages", "mysubreddits", "history"],
      failureRedirect: "/failure/reddit",
      failureMessage: true,
      state: true,
    });

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
        // TODO Move these
        {
          failureRedirect: "/failure/reddit",
          failureMessage: true,
          state: true,
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
      throw new Error(`Unable to load Reddit API, no refresh (bin file) token`);
    }

    await api.getClient();
    this.api = api;
    return api;
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

// TODO
// Schemas TODO Create in official repo too
// Refresh token
