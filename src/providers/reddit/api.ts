import { Devvit } from "@devvit/public-api";
import axios, { Axios, AxiosInterceptorOptions } from "axios";

const requestInterceptor = [
  function (config: any) {
    // Do something before request is sent
    return config;
  },
  function (error: any) {
    // Do something with request error
    return Promise.reject(error);
  },
];

/**
 * From the docs:
 * Clients connecting via OAuth2 may make up to 60 requests per minute. Monitor the following response headers to ensure that you're not exceeding the limits:
 *  X-Ratelimit-Used: Approximate number of requests used in this period
 *  X-Ratelimit-Remaining: Approximate number of requests left to use
 *  X-Ratelimit-Reset: Approximate number of seconds to end of period
 */
const responseInterceptor = [
  function (response: any) {
    // Any status code that lie within the range of 2xx cause this function to trigger
    // Do something with response data
    return response;
  },
  function (error: any) {
    // Any status codes that falls outside the range of 2xx cause this function to trigger
    // Do something with response error
    return Promise.reject(error);
  },
];

type RequestConfig = {};

type Chat = {};

/**
 * @abstract
 * @summary NOTE Data should be scrapped back as far as 3 months
 */
export class RedditApi {
  clientId: string;
  tdPath: string;
  client?: Axios | Devvit;

  constructor(clientId: string, binFile?: string) {
    this.clientId = clientId;

    // TODO Research this, might be used to store auth token
    // this.tdPath = `${tdPathPrefix}/${this.clientId}`;
    // if (binFile) {
    //   this.restoreBinFile(binFile);
    // }
  }

  // Devvit is under development
  public async getClient(
    useDevvit: boolean = false,
    startClient: boolean = false
  ): Promise<Devvit | Axios> {
    if (this.client) {
      return this.client;
    }

    try {
      if (useDevvit) {
        // this.client = new Devvit();
      } else {
        this.client = axios.create();

        this.client.interceptors.request.use(...requestInterceptor);

        // Add a response interceptor
        this.client.interceptors.response.use(...responseInterceptor);
      }

      if (startClient) {
        await this.startClient();
      }

      return this.client;
    } catch (err: any) {
      console.error(`Telegram library error: ${err.message}`);
      throw new Error(`Internal error with Telegram library`);
    }
  }

  public async startClient() {
    const client = await this.getClient();

    // load saved binary file to disk
    // const nowMinutes = Math.floor(Date.now() / 1000 / 60)
  }

  private async _call<Type>(
    endpoint: string,
    config?: RequestConfig,
    customInterceptor?: any[]
  ): Promise<Type | Type[]> {
    return {} as Type;
  }

  public async getGroupChat(chatId: number): Promise<Chat> {
    const chatDetail = await this._call("", {
      chat_id: chatId,
    });

    return chatDetail;
  }

  /**
   *
   * @summary Read all private messages from inbox, unread and sent folder from the past 3 months
   * https://www.reddit.com/dev/api#GET_message_{where}
   * @returns
   */
  public async getChats(): Promise<Chat[]> {
    // TODO Add response interceptor to check message data and if it passed the 3 months
    const customInterceptor: any[] = [];

    const chatDetail = await this._call<Chat[]>(
      "/message/inbox",
      {
        max_replies: 300,
      },
      customInterceptor
    );

    return chatDetail;
  }

  /**
   *
   * @summary Get the profile of auth token owner
   * @returns
   */
  public async getMe(): Promise<any> {
    const client = await this.getClient();
    const user = await this._call("/api/v1/me");

    return user;
  }

  /**
   *
   * @summary Get subreddits where the user is subcribed to, a contributor or a moderator
   * @returns
   */
  public async getSubreddits() {
    const client = await this.getClient();
    return await this._call("/subreddits/mine/subscribe", {});
  }
}
