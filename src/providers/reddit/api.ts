import { Devvit, Subreddit } from "@devvit/public-api";
import axios, { Axios, AxiosInterceptorOptions, AxiosResponse } from "axios";

const OAUTH_ENDPOINT = "https://oauth.reddit.com/";

const requestInterceptor = (token: string) => [
  function (request: any) {
    request.headers.Authorization = `Bearer ${token}`;
    // Do something before request is sent
    return request;
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
  function (response: AxiosResponse) {
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

type RequestConfig = {
  max_replies?: number;
  pagination?: PaginationParams;
};

type Chat = {};

type PaginationParams = {
  after: string;
};

/**
 * @abstract
 * @summary NOTE Data should be scrapped back as far as 3 months
 */
export class RedditApi {
  clientId: string;
  tdPath: string;
  client?: Axios;

  constructor(clientId: string) {
    this.clientId = clientId;
  }

  // Devvit is under development
  public async getClient(useDevvit: boolean = false): Promise<Devvit | Axios> {
    if (this.client) {
      return this.client;
    }

    try {
      if (useDevvit) {
        // this.client = new Devvit();
      } else {
        this.client = axios.create();

        this.client.interceptors.request.use(
          ...requestInterceptor(this.clientId)
        );

        // Add a response interceptor
        this.client.interceptors.response.use(...responseInterceptor);
      }

      return this.client;
    } catch (err: any) {
      console.error(`Telegram library error: ${err.message}`);
      throw new Error(`Internal error with Telegram library`);
    }
  }

  /**
   *
   * @summary This functions makes a request to the reddit API endpoint. It assumes that requested data is either a single entity or a listing
   * In case of a listing a custom interceptor has to set the terminationCriteriaMet flag to true and the pagination params.
   * The returned value is always a Type array, where Type is the supplied type.
   * @param endpoint
   * @param config
   * @param customInterceptor
   * @returns The returned data is either an array or an array of arrays. We can extract the data in the caller function based on the requested type.
   * @example profile -> resp[0] messages -> resp.flat() or subreddits -> resp.flat().flat() (multiple types of subreddits)
   */
  private async _call<Type>(
    method: "GET" | "POST" | "PUT",
    endpoint: `${string}.json`,
    config?: RequestConfig,
    customInterceptor?: any[]
  ): Promise<Type[] | undefined> {
    let terminationCriteriaMet = true;
    let data: Type[] = [];
    let pagination: PaginationParams = config.pagination;

    const myInterceptor = axios.interceptors.request.use(...customInterceptor);

    let action;
    switch (method) {
      case "GET":
        action = this.client.get;
        break;
      case "POST":
        action = this.client.post;
        break;
      case "PUT":
        action = this.client.put;
        break;
    }

    while (terminationCriteriaMet) {
      const resp = await action<{
        data: Type;
        terminationCriteriaMet: boolean;
        pagination: PaginationParams;
      }>(`${OAUTH_ENDPOINT}${endpoint}?after=${after}`, {
        params: {
          ...config,
          ...pagination,
        },
      });
      data.push(resp.data.data);
      terminationCriteriaMet = resp.data.terminationCriteriaMet;
      pagination = resp.data.pagination;
    }

    this.client.interceptors.request.eject(myInterceptor);

    return data;
  }

  /**
   *
   * @summary Read all private messages from inbox, unread and sent folder from the past 3 months
   * @see https://www.reddit.com/dev/api#GET_message_{where}
   * @returns
   */
  public async getChats(): Promise<Chat[]> {
    // TODO Add response interceptor to check message data and if it passed the 3 months
    const customInterceptor: any[] = [];

    const chatDetail = await this._call<Chat[]>(
      "GET",
      "/message/inbox.json",
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
  public async getMe(): Promise<string> {
    const user = await this._call<string>("GET", "/api/v1/me.json");

    return user[0];
  }

  /**
   *
   * @summary Get subreddits where the user is subcribed to, a contributor or a moderator
   * @see https://www.reddit.com/dev/api#GET_subreddits_mine_{where}
   * @returns
   */
  public async getSubreddits(): Promise<Subreddit[] | undefined> {
    const endpoints: `${string}.json`[] = [
      "/subreddits/mine/contributor.json",
      "/subreddits/mine/moderator.json",
      "/subreddits/mine/subscribe.json",
    ];
    const subreddits = await Promise.all(
      endpoints.map(async (endpoint) => {
        return await this._call<Subreddit[]>(
          "GET",
          "/message/inbox.json",
          {
            max_replies: 300,
          },
          [
            (response: AxiosResponse) => {
              if (response.data.children.length === 0) {
                return {
                  data: [] as any[],
                  terminationCriteriaMet: true,
                  pagination: {},
                };
              }
            },
          ]
        );
      })
    );

    return subreddits.flat().flat();
  }
}
