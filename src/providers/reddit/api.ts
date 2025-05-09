import axios, { Axios, AxiosResponse } from "axios";
import {
  Comment,
  EntityPrefixes,
  Account,
  Subreddit,
  Message,
  PrivateMessage,
  Post,
  Listing,
  SubredditConfig,
  CommentConfig,
  MessageConfig,
  PostConfig,
  CommentFullname,
  MessageFullname,
  SubredditFullname,
  PostFullname,
} from "./types";

const log4js = require("log4js");
const logger = log4js.getLogger();

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
    this.clientId = clientId;
    try {
      this.client = axios.create();

      this.client.interceptors.request.use(
        ...requestInterceptor(this.clientId)
      );

      // Add a response interceptor
      this.client.interceptors.response.use(...responseInterceptor);
    } catch (err: any) {
      logger.erroror(`Reddit library error: ${err.message}`);
      throw new Error(`Internal error with Reddit library`);
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
    limit: number = 1000,
    config?: SubredditConfig | CommentConfig | MessageConfig | PostConfig,
    backdate?: number | Date,
    customInterceptor?: any[]
  ): Promise<Type[] | undefined> {
    let terminationCriteriaMet = true;
    let data: Type[] = [];

    backdate = backdate ? new Date(backdate) : threeMonthsAgo;

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
    let i = 0;
    while (terminationCriteriaMet) {
      const resp = await action<{
        kind: EntityPrefixes | "Listing";
        data: Type | Listing;
      }>(`${url}`, {
        params: {
          ...config,
        },
      });

      // Single entities get returned
      if (resp.data.kind !== "Listing") {
        return [resp.data as Type];
      }

      const list = resp.data.data as Listing;
      data.push(
        // Only keep the data, without the prefix
        ...list.children.map((withPrefix) => withPrefix.data as Type)
      );

      i += list.children.length;

      // Check if termination criteria met, which includes default criteria e.g. Cretead.created_utc within last 3 months and custom termination criteria
      terminationCriteriaMet =
        i < limit &&
        list.after !== null &&
        (
          list.children[list.children.length - 1].data as
            | Account
            | Comment
            | Subreddit
            | Post
            | Message
        ).created_utc *
          1000 >
          +backdate;

      // Adjust pagination params
      config.after = list.after;
    }

    // Remove custom interceptor if used
    if (myInterceptor) this.client.interceptors.request.eject(myInterceptor);

    return data.slice(0, limit);
  }

  /**
   *
   * @summary Get the profile of auth token owner
   * @returns
   */
  public async getMe(): Promise<Account> {
    const url = `${URL}/api/v1/me.json`;
    const user = await this._call<Account>("GET", url);

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
      logger.error("[User] " + error.message);
    }
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
    type?: "inbox" | "unread" | "sent" | "private",
    maxFetch: number = 50,
    backdate?: number | Date,
    after?: MessageFullname,
    before?: MessageFullname,
    limit?: number
  ): Promise<(PrivateMessage | Message)[]> {
    let options: MessageConfig = {
      before,
      after,
      limit,
      show: "given",
    };

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
        try {
          const messages = await this._call<Message>(
            "GET",
            `${URL}${endpoint}`,
            maxFetch,
            options,
            backdate
          );

          if (type && type === "private") {
            return messages as unknown as PrivateMessage[];
          }
          return messages as Message[];
        } catch (error) {
          logger.error("[Message] " + error.message);
          return undefined;
        }
      })
    );

    const sol = allMessages.flat();
    if (sol.length === 1 && sol[0] === undefined) return undefined;
    return sol;
  }

  /**
   *
   * @summary This method is implemented by making api calls since no such Devvit method exists (v.0.11)
   * @summary Get subreddits where the user is subcribed to, a contributor or a moderator
   * @see https://www.reddit.com/dev/api#GET_subreddits_mine_{where}
   * @returns
   */
  public async getSubreddits(
    type: "contributor" | "moderator" | "subscriber",
    maxFetch: number,
    backdate?: number | Date,
    after?: SubredditFullname,
    before?: SubredditFullname,
    limit: number = 50
  ): Promise<Subreddit[] | undefined> {
    let options: SubredditConfig = {
      after: after,
      before,
      limit,
    };
    let endpoints = [`/subreddits/mine/${type}.json`];
    if (!type) {
      endpoints = [
        "/subreddits/mine/contributor.json",
        "/subreddits/mine/moderator.json",
        "/subreddits/mine/subscriber.json",
      ];
    }
    const subreddits = await Promise.all(
      endpoints.map(async (endpoint) => {
        try {
          return await this._call<Subreddit>(
            "GET",
            `${URL}${endpoint}` as `${string}.json`,
            maxFetch,
            options,
            backdate
          );
        } catch (error) {
          logger.error("[Subreddit] " + error.message);
          return undefined;
        }
      })
    );

    const sol = subreddits.flat();
    if (sol.length === 1 && sol[0] === undefined) return undefined;
    return sol;
  }

  async getPostsCreatedByUser(
    username?: string,
    maxFetch: number = 1000,
    backdate?: number | Date,
    after?: PostFullname,
    before?: PostFullname,
    limit: number = 50,
    sort: "new" = "new"
  ): Promise<Post[]> {
    let options: PostConfig = {
      before,
      after,
      sort,
      t: "all",
      type: "posts",
      username,
      limit,
      show: "given",
    };

    const url = `${URL}/user/${username}/submitted.json`;
    if (!username) {
      // Contrary to other object `name` field returns the username and not the "fullname"
      username = (await this.getMe()).name;
    }

    try {
      const posts = await this._call<Post>(
        "GET",
        url as `${string}.json`,
        maxFetch,
        options,
        backdate
      );
      return posts;
    } catch (error) {
      logger.error("[Post] " + error.message);
    }
  }

  async getPosts(
    type: "saved" | "upvoted" | "downvoted" | "hidden",
    maxFetch: number = 1000,
    username?: string,
    backdate?: number | Date,
    after?: PostFullname,
    before?: PostFullname,
    limit: number = 50,
    sort: "new" = "new"
  ): Promise<Post[]> {
    let options: PostConfig = {
      before,
      after,
      sort,
      t: "all",
      type: "posts",
      username,
      limit,
      show: "given",
    };

    let urls = [`${URL}/user/${username}/${type}.json`];
    if (!type) {
      urls = [
        `${URL}/user/${username}/saved.json`,
        `${URL}/user/${username}/upvoted.json`,
        `${URL}/user/${username}/downvoted.json`,
        `${URL}/user/${username}/hidden.json`,
      ];
    }

    if (!username) {
      // Contrary to other object `name` field returns the username and not the "fullname"
      username = (await this.getMe()).name;
    }

    const posts = await Promise.all(
      urls.map(async (url) => {
        try {
          return await this._call<Post>(
            "GET",
            url as `${string}.json`,
            maxFetch,
            options,
            backdate
          );
        } catch (error) {
          logger.error("[Post] " + error.message);
          return undefined;
        }
      })
    );
    const sol = posts.flat();
    if (sol.length === 1 && sol[0] === undefined) return undefined;
    return sol;
  }

  /**
   *
   * @summary Get comments created by a user
   * @param user
   * @param pageSize
   * @param limit
   * @param timeframe
   * @param sort
   * @param before
   * @param after
   * @returns
   */
  public async getCommentsCreatedByUser(
    username?: string,
    backdate?: number | Date,
    maxFetch?: number,
    after?: CommentFullname,
    before?: CommentFullname,
    limit?: number,
    sort: "new" = "new"
  ): Promise<Comment[]> {
    let options: CommentConfig = {
      before,
      after,
      sort,
      t: "all",
      type: "comments",
      username,
      limit,
    };

    if (!username) {
      // Contrary to other object `name` field returns the username and not the "fullname"
      username = (await this.getMe()).name;
    }

    if (!username) return;

    try {
      const url = `${URL}/user/${username}/comments.json`;
      const comments = await this._call<Comment>(
        "GET",
        url as `${string}.json`,
        maxFetch,
        options,
        backdate
      );
      return comments;
    } catch (error) {
      logger.error("[Comment] " + error.message);
    }
  }

  /**
   *
   * @summary Get comments interacted by user (saved, upvodted, downvoted, hidden)
   * @param type
   * @param username
   * @param limit
   * @param sort
   * @param before
   * @param after
   * @returns
   */
  async getComments(
    type?: "saved" | "upvoted" | "downvoted" | "hidden",
    maxFetch: number = 1000,
    username?: string,
    backdate?: number | Date,
    after?: CommentFullname,
    before?: CommentFullname,
    limit: number = 50,
    sort: "new" = "new"
  ) {
    let options: CommentConfig = {
      before,
      after,
      sort,
      t: "all",
      type: "comments",
      username,
      limit,
    };

    if (!username) {
      // Contrary to other object `name` field returns the username and not the "fullname"
      username = (await this.getMe()).name;
    }

    let urls = [`${URL}/user/${username}/${type}.json?type=comments`];
    if (!type) {
      urls = [
        `${URL}/user/${username}/saved.json?type=comments`,
        `${URL}/user/${username}/upvoted.json?type=comments`,
        `${URL}/user/${username}/downvoted.json?type=comments`,
        `${URL}/user/${username}/hidden.json?type=comments`,
      ];
    }

    const comments = await Promise.all(
      urls.map(async (url) => {
        try {
          const comments = await this._call<Comment>(
            "GET",
            url as `${string}.json`,
            maxFetch,
            options,
            backdate
          );
          return comments;
        } catch (error) {
          logger.error("[Comment] " + error.message);
          return undefined;
        }
      })
    );

    const sol = comments.flat();
    if (sol.length === 1 && sol[0] === undefined) return undefined;
    return sol;
  }
}
