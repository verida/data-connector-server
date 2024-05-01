import { Request, Response } from "express";
import Base from "../BaseProvider";
import BaseProviderConfig from "../BaseProviderConfig";

const passport = require("passport");
const { Strategy: TelegramStrategy } = require("passport-telegram");
const Telegram = require("@yuva1422/telegram.js");
//import SBTs from './sbts'
// import Following from "./following";
import TokenExpiredError from "../TokenExpiredError";

export interface TelegramProviderConfig extends BaseProviderConfig {
  clientID: string;
  clientSecret: string;
  callbackUrl: string;
  limitResults: boolean;
}

export default class TelegramProvider extends Base {
  protected config: TelegramProviderConfig;

  public getProviderId() {
    return "telegram";
  }

  public getProviderLabel() {
    return "Telegram";
  }

  public syncHandlers(): any[] {
    return [
      //SBTs
      // Following,
    ];
    return [];
  }

  public async connect(req: Request, res: Response, next: any): Promise<any> {
    this.init();
    const auth = await passport.authenticate(this.getProviderId());
    return auth(req, res, next);
  }

  /**
   * @todo: Create proper connectionToken response
   *
   * @param req
   * @param res
   * @param next
   * @returns
   */
  public async callback(req: Request, res: Response, next: any): Promise<any> {
    this.init();

    const promise = new Promise((resolve, rejects) => {
      const auth = passport.authenticate(
        this.getProviderId(),
        {
          failureRedirect: "/failure/telegram",
          failureMessage: true,
        },
        function (err: any, data: any) {
          if (err) {
            rejects(err);
          } else {
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

  public async getApi(
    accessToken?: string,
    refreshToken?: string
  ): Promise<any> {
    let me, client;

    try {
      client = new Telegram.client();
      client.login(accessToken);

      me = client.user;
    } catch (err: any) {}

    this.profile = {
      id: me.id,
      name: `${me.firstName} ${me.lastName}`,
      username: me.username,
      avatarUrl: (await me.getPhotos())?.url,
      createdAt: "0",
    };

    return client;
  }

  public init() {
    // obtain a new access token from refresh token
    passport.use(
      new TelegramStrategy(
        {
          clientID: this.config.clientID,
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
