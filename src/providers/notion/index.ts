import { Request, Response } from "express";
import { Client } from "@notionhq/client";
import Base from "../BaseProvider";
import { NotionProviderConfig } from "./interfaces";
import { ConnectionCallbackResponse, PassportProfile } from "../../interfaces";
import passport from "passport";
import NotionStrategy from "./NotionStrategy"; 

export default class NotionProvider extends Base {
  protected config: NotionProviderConfig;

  public getProviderName() {
    return "notion";
  }

  public getProviderLabel() {
    return "Notion";
  }

  public getProviderApplicationUrl() {
    return "https://www.notion.so/";
  }

  public syncHandlers(): any[] {
    return [];
  }

  public getScopes(): string[] {
    return ["read_content", "read_comment"];
  }

  public async connect(req: Request, res: Response, next: any): Promise<any> {
    this.init();
    const auth = passport.authenticate("notion", {
      scope: this.getScopes().join(" "),
    });
    return auth(req, res, next);
  }

  public async callback(req: Request, res: Response, next: any): Promise<ConnectionCallbackResponse> {
    this.init();
    return new Promise((resolve, reject) => {
      passport.authenticate(
        "notion",
        { failureRedirect: "/failure/notion", failureMessage: true },
        (err: any, user: any) => {
          if (err) {
            return reject(err);
          }
          if (!user) {
            return reject(new Error("No user data returned from Notion"));
          }

          const profile = this.formatProfile(user);

          resolve({
            id: profile.id,
            accessToken: user.access_token,
            refreshToken: user.access_token, // Notion does not provide refresh tokens currently
            profile: {
              username: profile.connectionProfile.username,
              ...profile,
            },
          });
        }
      )(req, res, next);
    });
  }

  public async getApi(accessToken?: string): Promise<Client> {
    if (!accessToken) {
      throw new Error("Access token is required");
    }
    return new Client({ auth: accessToken });
  }

  public init() {
    passport.use(
      new NotionStrategy({
        clientID: this.config.clientId,
        clientSecret: this.config.clientSecret,
        callbackURL: this.config.callbackUrl,
      })
    );
  }

  private formatProfile(notionData: any): PassportProfile {
    const owner = notionData.owner?.user;
    const email = owner?.person?.email || null;

    return {
      id: owner?.id || "", 
      provider: this.getProviderName(),
      displayName: owner?.name || email || owner?.id || "Unknown",
      name: {
        familyName: "",
        givenName: owner?.name || "",
      },
      photos: owner?.avatar_url ? [{ value: owner.avatar_url }] : [],
      connectionProfile: {
        username: email ? email.split("@")[0] : owner?.id || "unknown",
        readableId: email || owner?.id || "unknown",
        email: email,
        verified: true,
      },
    };
  }
}
