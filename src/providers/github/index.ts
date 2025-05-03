import { Request, Response } from "express";
import Base from "../BaseProvider";
import { ConnectionCallbackResponse, PassportProfile } from "../../interfaces";
import { GithubProviderConfig } from "./interfaces";

const passport = require("passport");
const GitHubStrategy = require("passport-github2");

export default class GitHubProvider extends Base {
    protected config: GithubProviderConfig;

    public getProviderName() {
        return "github";
    }

    public getProviderLabel() {
        return "Github";
    }

    public getProviderApplicationUrl() {
        return "https://github.com/";
    }

    public syncHandlers(): any[] {
        return [];
    }

    public getScopes(): string[] {
        return ["read:user", "user:email", "repo"];
    }

    public async connect(req: Request, res: Response, next: any): Promise<any> {
        this.init();

        const auth = passport.authenticate("github", {
            scope: this.getScopes(),
        });

        return auth(req, res, next);
    }

    public async callback(req: Request, res: Response, next: any): Promise<ConnectionCallbackResponse> {
        this.init();

        return new Promise((resolve, reject) => {
            passport.authenticate(
                "github",
                {
                    failureRedirect: "/failure/github",
                    failureMessage: true,
                },
                (err: any, user: any) => {
                    if (err) {
                        return reject(err);
                    }
                    if (!user) {
                        return reject(new Error("No user data returned from GitHub"));
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

    public async getApi(accessToken?: string, refreshToken?: string): Promise<any> {
        // Placeholder for GitHub API integration
    }

    public init() {
        passport.use(
            new GitHubStrategy(
                {
                    clientID: this.config.clientId,
                    clientSecret: this.config.clientSecret,
                    callbackURL: this.config.callbackUrl,
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

    private formatProfile(githubProfile: any): PassportProfile {
        const email = githubProfile.emails && githubProfile.emails.length
            ? githubProfile.emails[0].value
            : null;

        return {
            id: githubProfile.id,
            provider: this.getProviderName(),
            displayName: githubProfile.displayName || email || githubProfile.username,
            name: {
                familyName: githubProfile.name?.split(" ").slice(-1)[0] || "",
                givenName: githubProfile.name?.split(" ").slice(0, -1).join(" ") || "",
            },
            photos: githubProfile.photos || [],
            connectionProfile: {
                username: email ? email.split("@")[0] : githubProfile.username,
                readableId: email || githubProfile.username,
                email: email,
                verified: githubProfile._json?.email_verified || false,
            },
        };
    }
}
