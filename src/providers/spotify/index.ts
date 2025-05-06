import { Request, Response } from "express";
import Base from "../BaseProvider";
import { SpotifyProviderConfig } from "./interfaces";
import { ConnectionCallbackResponse, PassportProfile } from "../../interfaces";
import { Client, OAuthScopeEnum, OAuthToken } from "spotify-api-sdk";
import SpotifyFollowing from "./spotify-following";
import SpotifyFavouriteHandler from "./spotify-favourite";
import SpotifyPlayHistory from "./spotify-history";
import SpotifyPlaylistHandler from "./spotify-playlist";

const { Strategy: SpotifyStrategy } = require("passport-spotify");
const passport = require("passport");

export default class SpotifyProvider extends Base {
    protected config: SpotifyProviderConfig;

    public getProviderName() {
        return "spotify";
    }

    public getProviderLabel() {
        return "Spotify";
    }

    public getProviderApplicationUrl() {
        return "https://www.spotify.com/";
    }

    public syncHandlers(): any[] {
        return [
            SpotifyFollowing, 
            SpotifyFavouriteHandler,
            SpotifyPlayHistory,
            SpotifyPlaylistHandler
        ];
    }

    public getScopes(): OAuthScopeEnum[] {
        return [
            OAuthScopeEnum.PlaylistReadPrivate,
            OAuthScopeEnum.UserReadPrivate,
            OAuthScopeEnum.UserReadEmail,
            OAuthScopeEnum.UserFollowRead,            
            OAuthScopeEnum.UserTopRead,
            OAuthScopeEnum.UserReadRecentlyPlayed
        ];
    }

    public async connect(req: Request, res: Response, next: any): Promise<any> {
        this.init();

        const auth = await passport.authenticate("spotify", {
            scope: this.getScopes(),
            showDialog: true,
        });

        return auth(req, res, next);
    }

    public async callback(req: Request, res: Response, next: any): Promise<ConnectionCallbackResponse> {
        this.init();

        const promise = new Promise((resolve, reject) => {
            const auth = passport.authenticate(
                "spotify",
                {
                    failureRedirect: "/failure/spotify",
                    failureMessage: true,
                },
                function (err: any, data: any) {
                    if (err) {
                        reject(err);
                    } else {
                        // Format profile into PassportProfile structure
                        const profile = this.formatProfile(data.profile);

                        const connectionToken: ConnectionCallbackResponse = {
                            id: profile.id,
                            accessToken: data.accessToken,
                            refreshToken: data.refreshToken,
                            profile: {
                                username: profile.connectionProfile.username,
                                ...profile,
                            },
                        };

                        resolve(connectionToken);
                    }
                }.bind(this) // Bind this to access the formatProfile method
            );

            auth(req, res, next);
        });

        const result = <ConnectionCallbackResponse>await promise;
        return result;
    }

    public async getApi(accessToken?: string, refreshToken?: string): Promise<Client> {

        if (!accessToken) {
            throw new Error("Access token is required");
        }

        const token: OAuthToken = {
            accessToken: accessToken,
            refreshToken: refreshToken,
            tokenType: "Bearer"
        }

        const client = new Client({
            authorizationCodeAuthCredentials: {
                oAuthClientId: this.config.clientId,
                oAuthClientSecret: this.config.clientSecret,
                oAuthRedirectUri: this.config.callbackUrl,
                oAuthScopes: this.getScopes(),
                oAuthToken: token
            },
        });

        return client;
    }

    public init() {
        passport.use(
            new SpotifyStrategy(
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
                    return cb(null, {
                        accessToken,
                        refreshToken,
                        profile,
                    });
                }
            )
        );
    }

    private formatProfile(spotifyProfile: any): PassportProfile {
        const displayName = spotifyProfile.displayName || spotifyProfile.username;
        const email = spotifyProfile.emails && spotifyProfile.emails.length ? spotifyProfile.emails[0].value : null;

        const profile: PassportProfile = {
            id: spotifyProfile.id,
            provider: this.getProviderName(),
            displayName: displayName,
            name: {
                familyName: (displayName && displayName.split(" ").slice(-1)[0]) || "",
                givenName: (displayName && displayName.split(" ").slice(0, -1).join(" ")) || "",
            },
            photos: spotifyProfile.photos || [],
            connectionProfile: {
                username: email ? email.split("@")[0] : spotifyProfile.id,
                readableId: spotifyProfile.id,
                email: email,
                verified: true, // Assume verified if provided by Spotify
            },
        };

        return profile;
    }
}
