import axios, { Axios, AxiosResponse } from "axios";
import {
  Comment,
  EntityPrefixes,
  Account,
  BaseRequestConfig,
  PaginationParams,
  Subreddit,
  Message,
  PrivateMessage,
  Post,
  Listing,
} from "./types";

const URL = "https://oauth.reddit.com";

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

const now = new Date();
const threeMonthsAgo = now.setMonth(now.getMonth() - 3);

/**
 * TODO:
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

/**
 * @abstract
 * @summary This API is a combination of the original API and the in-development Devvit library(v0.11). This is required given that some of the methods are either
 *    not supported or return incomplete data.
 */
export class RedditApi {
  clientId: string;
  tdPath: string;
  client?: Axios;

  constructor(clientId: string) {
    console.log(clientId);
    this.clientId = clientId;
    try {
      this.client = axios.create();

      this.client.interceptors.request.use(
        ...requestInterceptor(this.clientId)
      );

      // Add a response interceptor
      this.client.interceptors.response.use(...responseInterceptor);
    } catch (err: any) {
      console.error(`Reddit library error: ${err.message}`);
      throw new Error(`Internal error with Telegram library`);
    }
  }

  public getClient(): Axios {
    return this.client;
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
    url: `${string}.json`,
    config?: BaseRequestConfig,
    customInterceptor?: any[]
  ): Promise<Type[] | undefined> {
    let terminationCriteriaMet = true;
    let data: Type[] = [];
    let pagination: PaginationParams = config?.pagination;

    let myInterceptor;
    if (customInterceptor) {
      myInterceptor = axios.interceptors.request.use(...customInterceptor);
    }

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
        kind: EntityPrefixes | "Listing";
        data: Type | Listing;
      }>(`${url}`, {
        params: {
          ...config,
          ...pagination,
        },
      });

      // Single entities get returned
      if (resp.data.kind !== "Listing") {
        return [resp.data as Type];
      }

      data.push(
        // Only keep the data, without the prefix
        ...(resp.data.data as Listing).children.map(
          (withPrefix) => withPrefix.data as Type
        )
      );

      // Check if termination criteria met, which includes default criteria e.g. Cretead.created_utc within last 3 months and custom termination criteria
      terminationCriteriaMet =
        (
          (resp.data.data as Listing).children[
            (resp.data.data as Listing).children.length - 1
          ].data as Account | Comment | Subreddit | Post | Message
        ).created_utc > threeMonthsAgo;
      // Adjust pagination config

      pagination = {
        after: (resp.data.data as Listing).children[
          (resp.data.data as Listing).children.length - 1
        ].name,
      };
    }

    // Remove custom interceptor if used
    if (myInterceptor) this.client.interceptors.request.eject(myInterceptor);

    return data;
  }

  /**
   *
   * @summary Get the profile of auth token owner
   * @returns
   */
  public async getMe(): Promise<Account> {
    const url = `${URL}/api/v1/me.json`;
    const user = await this._call<Account>("GET", url);
    // TODO Check if no error was returned

    return user[0];
  }

  /**
   *
   * @summary Get the profile of auth token owner
   * @returns
   */
  public async getUser(username: string): Promise<Account> {
    try {
      const user = await this._call<Account>(
        "GET",
        `${URL}/user/${username}/about.json`
      );

      return user[0];
    } catch (error) {
      console.log(error.message);
    }
    // return typeof usernameOrId === "string"
    //   ? await this.devvitClient.getUserByUsername(usernameOrId)
    //   : await this.devvitClient.getUserById(String(usernameOrId));
  }

  /**
   * @see Chat messages are not supported: https://www.reddit.com/r/redditdev/comments/17s83sf/chat_api/
   */
  public async getChats() {
    throw new Error("Not supported");
  }

  /**
   *
   * @summary Read all private messages from inbox, unread and sent folder from the past 3 months
   * @see https://www.reddit.com/dev/api#GET_message_{where}
   * @returns
   */
  public async getMessages(
    type?: "inbox" | "unread" | "sent" | "private"
  ): Promise<(PrivateMessage | Message)[]> {
    let endpoints: `${string}.json`[] = [
      "/message/inbox.json",
      "/message/unread.json",
      "/message/sent.json",
    ];

    if (type && type !== "private") {
      endpoints = [`/message/${type}.json`];
    } else if (type) {
      endpoints = ["/message/messages.json"];
    }

    const allMessages = await Promise.all(
      endpoints.map(async (endpoint) => {
        const messages = await this._call<Message>("GET", `${URL}${endpoint}`, {
          count: 0,
        });

        if (type && type === "private") {
          return messages as unknown as PrivateMessage[];
        }
        return messages as Message[];
      })
    );

    return allMessages.flat();
  }

  /**
   *
   * @summary This method is implemented by making api calls since no such Devvit method exists (v.0.11)
   * @summary Get subreddits where the user is subcribed to, a contributor or a moderator
   * @see https://www.reddit.com/dev/api#GET_subreddits_mine_{where}
   * @returns
   */
  public async getSubreddits(
    type: "contributor" | "moderator" | "subscriber"
  ): Promise<Subreddit[] | undefined> {
    const endpoints: `${string}.json`[] = [
      "/subreddits/mine/contributor.json",
      "/subreddits/mine/moderator.json",
      "/subreddits/mine/subscriber.json",
    ];
    const subreddits = await Promise.all(
      endpoints.map(async (endpoint) => {
        return await this._call<Subreddit>("GET", `${URL}${endpoint}`);
      })
    );

    return subreddits.flat();
  }

  getPostsByMe(username: string) {
    const url = `${URL}/user/${username}/submitted`;
    // https://oauth.reddit.com/user/Delicious_Lychee_478/submitted.json
  }

  getPosts(
    username: string,
    type: "saved" | "upvoted" | "downvoted" | "hidden"
  ) {
    // TODO Move to params
    const url = `${URL}/user/${username}/${type}.json?type=links`;
  }

  /**
   *
   * @summary Fetch comments for a user
   * @param user
   * @param pageSize
   * @param limit
   * @param timeframe
   * @param sort
   * @param before
   * @param after
   * @returns
   */
  public async getCommentsByMe(
    pageSize: number,
    limit: number,
    timeframe: "all" = "all",
    sort: "new" = "new",
    before?: string,
    after?: string,
    username?: string
  ): Promise<Comment[]> {
    let options = {
      pageSize: 1,
      timeframe,
      sort,
      limit,
      before,
      after,
    };
    // TODO This might not be needed
    options = JSON.parse(JSON.stringify(options));

    if (!username) {
      username = (await this.getMe()).name;
    }

    try {
      const url = `${URL}/user/${username}/comments.json`;
      const comments = await this._call<Comment[]>(
        "GET",
        url as `${string}.json`
      );
      console.log(comments);
      return [];
    } catch (error) {
      console.log(error.message);
    }
  }

  getComments(
    username: string,
    type: "saved" | "upvoted" | "downvoted" | "hidden"
  ) {
    const url = `${URL}/user/${username}/${type}.json?type=comments`;
  }
}
