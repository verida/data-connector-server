import { Client, Scope } from "oauth2-server";

export interface Meta {
    clientId: string
    userId: any
    scope: Scope
    accessTokenExpiresAt: Date
    refreshTokenExpiresAt: Date
}

/**
 * In memory database of DIDs and private keys
 */


export class OAuthMemoryDb {
    private clients: Client[] = []
    private accessTokens: Map<string, Meta>
    private refreshTokens: Map<string, Meta>

    constructor () {
      this.accessTokens = new Map();
      this.refreshTokens= new Map();
    }
  
    saveClient(client: Client) {
      this.clients.push(client);
  
      return client;
    }
  
    findClient (clientId: string, clientSecret: string) {
      return this.clients.find(client => {
        if (clientSecret) {
          return client.id === clientId && client.secret === clientSecret;
        } else {
          return client.id === clientId;
        }
      });
    }
  
    findClientById (id: string) {
      return this.clients.find(client => client.id === id);
    }
  
    saveAccessToken (accessToken: string, meta: Meta) {
      this.accessTokens.set(accessToken, meta);
    }
  
    findAccessToken (accessToken: string) {
      return this.accessTokens.get(accessToken);
    }
  
    deleteAccessToken (accessToken: string) {
      this.accessTokens.delete(accessToken);
    }
  
    saveRefreshToken (refreshToken: string, meta: Meta) {
      this.refreshTokens.set(refreshToken, meta);
    }
  
    findRefreshToken (refreshToken: string) {
      return this.refreshTokens.get(refreshToken);
    }
  
    deleteRefreshToken (refreshToken: string) {
      this.refreshTokens.delete(refreshToken);
    }
  }