import { Request } from "express";
import https from "https";
import { URL } from "url";
import passport from "passport";

interface NotionStrategyOptions {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
}

export default class NotionStrategy extends passport.Strategy {
    name = "notion";
    private _clientID: string;
    private _clientSecret: string;
    private _callbackURL: string;
    private _authorizationURL: string;
    private _tokenURL: string;

    constructor({ clientID, clientSecret, callbackURL }: NotionStrategyOptions) {
        super();
        if (!clientID || !clientSecret || !callbackURL) {
            throw new TypeError("Missing required options for NotionStrategy");
        }
        this._clientID = clientID;
        this._clientSecret = clientSecret;
        this._callbackURL = callbackURL;
        this._authorizationURL = "https://api.notion.com/v1/oauth/authorize";
        this._tokenURL = "https://api.notion.com/v1/oauth/token";
    }

    async authenticate(req: Request, options?: any) {
        options = options || {};
        if (req.query?.code) {
            try {
                const oauthData = await this.getOAuthAccessToken(req.query.code as string);
                
                if (oauthData.owner.type !== "user") {
                    return this.fail(`Notion API token not owned by user, instead: ${oauthData.owner.type}`);
                }

                return this.success(oauthData);
            } catch (error) {
                return this.error(error);
            }
        } else {
            const authUrl = new URL(this._authorizationURL);
            authUrl.searchParams.set("client_id", this._clientID);
            authUrl.searchParams.set("redirect_uri", this._callbackURL);
            authUrl.searchParams.set("response_type", "code");
            return this.redirect(authUrl.toString());
        }
    }

    private async getOAuthAccessToken(code: string): Promise<any> {
        const accessTokenBody = {
            grant_type: "authorization_code",
            code,
            redirect_uri: this._callbackURL,
        };
        const encodedCredential = Buffer.from(`${this._clientID}:${this._clientSecret}`).toString("base64");

        const requestOptions = {
            hostname: new URL(this._tokenURL).hostname,
            path: new URL(this._tokenURL).pathname,
            headers: {
                Authorization: `Basic ${encodedCredential}`,
                "Content-Type": "application/json",
            },
            method: "POST",
        };

        return new Promise((resolve, reject) => {
            const accessTokenRequest = https.request(requestOptions, (res) => {
                let data = "";
                res.on("data", (d) => {
                    data += d;
                });
                res.on("end", () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            accessTokenRequest.on("error", reject);
            accessTokenRequest.write(JSON.stringify(accessTokenBody));
            accessTokenRequest.end();
        });
    }
}
