import { Request, Response } from "express";
import { Client } from "@notionhq/client";
import Base from "../BaseProvider";
import { NotionProviderConfig } from "./interfaces";
import { ConnectionCallbackResponse, PassportProfile } from "../../interfaces";
import passport from "passport";
import NotionStrategy from "./NotionStrategy"; // Import the corrected NotionStrategy class

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

            console.log("++++++")
            console.log(user)
          if (err) {
            return reject(err);
          }
          if (!user) {
            return reject(new Error("No user data returned from Notion"));
          }

          const profile = this.formatProfile(user.profile);

          resolve({
            id: profile.id,
            accessToken: user.accessToken,
            refreshToken: user.refreshToken,
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

  private formatProfile(notionProfile: any): PassportProfile {
    const email = notionProfile.email || null;

    return {
      id: notionProfile.id,
      provider: this.getProviderName(),
      displayName: notionProfile.name || email || notionProfile.id,
      name: {
        familyName: "",
        givenName: notionProfile.name || "",
      },
      photos: [],
      connectionProfile: {
        username: email ? email.split("@")[0] : notionProfile.id,
        readableId: email || notionProfile.id,
        email: email,
        verified: true,
      },
    };
  }
}
