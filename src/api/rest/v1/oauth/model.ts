import { createHash } from 'crypto'
import { Client, Scope, Token, User } from "oauth2-server";
import { Meta, OAuthMemoryDb } from "./db";
import CONFIG from "../../../../config"

const SCHEMAS: string[] = Object.values(CONFIG.verida.schemas)

let enabledScopes: string[] = []
for (const schema of SCHEMAS) {
    enabledScopes.push(`${Buffer.from(schema).toString('base64')}:read`)
    enabledScopes.push(`${Buffer.from(schema).toString('base64')}:write`)
}

const getUserDoc = () => ({ id: 'system' });

const authCodes = []

export class OAuthModel {
  protected db: OAuthMemoryDb

  constructor(db: OAuthMemoryDb) {
    this.db = db
  }

  public async getClient (clientId: string, clientSecret: string) {
    console.log('getClient()')
    return this.db.findClient(clientId, clientSecret);
  }

  public async validateScope (user: User, client: Client, scope: Scope) {
    console.log('validateScope()')
    if (!user || user.id !== 'system') {
      return false;
    }

    if (!client || !this.db.findClientById(client.id)) {
      return false;
    }

    if (typeof scope === 'string') {
      return enabledScopes.includes(scope) ? [scope] : false;
    } else {
      return scope.every(s => enabledScopes.includes(s)) ? scope : false;
    }
  }

  public async getUserFromClient (_client: Client) {
    console.log('getUserFromClient()')
    // In this setup we don't have any users, so
    // we return an object, representing a "system" user
    // and avoid creating any user documents.
    // The user document is nowhere relevant for accessing resources,
    // so we can safely use it like this.
    const client = this.db.findClient(_client.id, _client.secret);
    return client && getUserDoc();
  }

  public async generateAuthorizationCode(client: Client, user: User, scope: Scope): Promise<string> {
    console.log('generateAuthorizationCode()')
    // Get the current timestamp
    const timestamp = Date.now().toString();
    const entropy = `${client.id}:${user.did}:${JSON.stringify(scope)}:${timestamp}`
    const hash = createHash('sha256').update(entropy).digest('hex');

    // Return the first 40 characters of the hex string
    return hash.slice(0, 40);
  }

  public async saveToken (token: Token, client: Client, user: User) {
    console.log('saveToken()')
    const meta: Meta = {
      clientId: client.id,
      userId: user.id,
      scope: token.scope,
      accessTokenExpiresAt: token.accessTokenExpiresAt,
      refreshTokenExpiresAt: token.refreshTokenExpiresAt
    };

    token.client = client;
    token.user = user;

    if (token.accessToken) {
      this.db.saveAccessToken(token.accessToken, meta);
    }

    if (token.refreshToken) {
      this.db.saveRefreshToken(token.refreshToken, meta);
    }

    return token;
  }

  public async getAccessToken (accessToken: string) {
    console.log('getAccessToken()')
    const meta = this.db.findAccessToken(accessToken);

    if (!meta) {
      return false;
    }

    return {
      accessToken,
      accessTokenExpiresAt: meta.accessTokenExpiresAt,
      user: getUserDoc(),
      client: this.db.findClientById(meta.clientId),
      scope: meta.scope
    };
  }

  public async getRefreshToken (refreshToken: string) {
    console.log('getRefreshToken()')
    const meta = this.db.findRefreshToken(refreshToken);

    if (!meta) {
      return false;
    }

    return {
      refreshToken,
      refreshTokenExpiresAt: meta.refreshTokenExpiresAt,
      user: getUserDoc(),
      client: this.db.findClientById(meta.clientId),
      scope: meta.scope
    };
  }

  public async revokeToken (token: Token) {
    console.log('revokeToken()')
    this.db.deleteRefreshToken(token.refreshToken);

    return true;
  }

  public async verifyScope (token: Token, scope: Scope) {
    console.log('verifyScope()')
    if (typeof scope === 'string') {
      return enabledScopes.includes(scope);
    } else {
      return scope.every((s: string) => enabledScopes.includes(s));
    }
  }

  // public async saveAuthorizationCode(code: any, client: Client, user: User) {
  //   console.log('saveAuthorizationCode()')
  //   authCodes.push(code)
  // }

  // public async getAuthorizationCode(code: any) {
  //   console.log('getAuthorizationCode()')
  //   return {
  //       authorizationCode: code.authorization_code,
  //       expiresAt: code.expires_at,
  //       redirectUri: code.redirect_uri,
  //       scope: code.scope,
  //       client: client, // with 'id' property
  //       user: user
  //     };
  // }
}