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

export function createModel(db: OAuthMemoryDb) {
  async function getClient (clientId: string, clientSecret: string) {
    return db.findClient(clientId, clientSecret);
  }

  async function validateScope (user: User, client: Client, scope: Scope) {
    if (!user || user.id !== 'system') {
      return false;
    }

    if (!client || !db.findClientById(client.id)) {
      return false;
    }

    if (typeof scope === 'string') {
      return enabledScopes.includes(scope) ? [scope] : false;
    } else {
      return scope.every(s => enabledScopes.includes(s)) ? scope : false;
    }
  }

  async function getUserFromClient (_client: Client) {
    // In this setup we don't have any users, so
    // we return an object, representing a "system" user
    // and avoid creating any user documents.
    // The user document is nowhere relevant for accessing resources,
    // so we can safely use it like this.
    const client = db.findClient(_client.id, _client.secret);
    return client && getUserDoc();
  }

  async function generateAuthorizationCode(client: Client, user: User, scope: Scope): Promise<string> {
    // Get the current timestamp
    const timestamp = Date.now().toString();
    const entropy = `${client.id}:${user.did}:${JSON.stringify(scope)}:${timestamp}`
    const hash = createHash('sha256').update(entropy).digest('hex');

    // Return the first 40 characters of the hex string
    return hash.slice(0, 40);
  }

  async function saveToken (token: Token, client: Client, user: User) {
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
      db.saveAccessToken(token.accessToken, meta);
    }

    if (token.refreshToken) {
      db.saveRefreshToken(token.refreshToken, meta);
    }

    return token;
  }

  async function getAccessToken (accessToken: string) {
    const meta = db.findAccessToken(accessToken);

    if (!meta) {
      return false;
    }

    return {
      accessToken,
      accessTokenExpiresAt: meta.accessTokenExpiresAt,
      user: getUserDoc(),
      client: db.findClientById(meta.clientId),
      scope: meta.scope
    };
  }

  async function getRefreshToken (refreshToken: string) {
    const meta = db.findRefreshToken(refreshToken);

    if (!meta) {
      return false;
    }

    return {
      refreshToken,
      refreshTokenExpiresAt: meta.refreshTokenExpiresAt,
      user: getUserDoc(),
      client: db.findClientById(meta.clientId),
      scope: meta.scope
    };
  }

  async function revokeToken (token: Token) {
    db.deleteRefreshToken(token.refreshToken);

    return true;
  }

  async function verifyScope (token: Token, scope: Scope) {
    if (typeof scope === 'string') {
      return enabledScopes.includes(scope);
    } else {
      return scope.every(s => enabledScopes.includes(s));
    }
  }

  async function saveAuthorizationCode(code: Code, client: Client, user: User) {
    authCodes.push(code)
  }

  async function getAuthorizationCode(code: string) {
    return {
        authorizationCode: code.authorization_code,
        expiresAt: code.expires_at,
        redirectUri: code.redirect_uri,
        scope: code.scope,
        client: client, // with 'id' property
        user: user
      };
  }

  return  {
    getClient,
    saveToken,
    getAccessToken,
    getRefreshToken,
    revokeToken,
    validateScope,
    verifyScope,
    getUserFromClient
  };
}