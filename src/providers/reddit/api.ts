import axios, { Axios, AxiosResponse } from "axios";
import {
  EntityFullname,
  EntityPrefixes,
  ListingType,
  Account,
  BaseRequestConfig,
  PaginationParams,
  Subreddit,
  Message,
  PrivateMessage,
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
    // this.clientId = clientId;
    this.clientId =
      "eyJhbGciOiJSUzI1NiIsImtpZCI6IlNIQTI1NjpzS3dsMnlsV0VtMjVmcXhwTU40cWY4MXE2OWFFdWFyMnpLMUdhVGxjdWNZIiwidHlwIjoiSldUIn0.eyJzdWIiOiJ1c2VyIiwiZXhwIjoxNzQ2NjIwNzQxLjEwMjEzNSwiaWF0IjoxNzQ2NTM0MzQxLjEwMjEzNSwianRpIjoiSEp3bEpCaC1PYjBNM1g5N1JzUnZNZ1lwVnBmczlBIiwiY2lkIjoiMFItV0FNaHVvby1NeVEiLCJsaWQiOiJ0Ml93cW44M2t2bnoiLCJhaWQiOiJ0Ml93cW44M2t2bnoiLCJsY2EiOjE3MTExNDI1MjI4MzgsInNjcCI6ImVKeGtrZEdPdERBSWhkLUZhNV9nZjVVX20wMXRjWWFzTFFhb2szbjdEVm9jazcwN2NENHBIUDlES29xRkRDWlhncW5BQkZnVHJUREJSdVQ5bkxtM2cyaU5lOHRZc1puQ0JGbXdGRHJrbUxHc2lRUW1lSklheXhzbW9JTE55Rnl1dEdOTkxUMFFKcWhjTXJlRkhwYzJvYmtiaTU2ZEdGVzVyRHlvc1ZmbDB0akdGTFlueGpjYnF3MnB1QzZuTWtuTFF2a3NYdlRqTjlXMzl2bXpfU2EwSjhPS3F1bUIzaGxKQ0c0c2ZwaW0zZDlUazU2dEN4YTE5M3FRMnVkNjNLNTkxaXcwTzdlZjZfbHJJeG1YWTJoLUp2dDMxeS1oQTQ4OEx6UHFBRWFzNFVjWmRtUWRfbFVIVUxtZ0pHTUo0dE1JNU1ybDIzOEp0bXZUdjhidEV6OThNLUttTl96V0ROUnpDZUxRcF9IMUd3QUFfXzhRMWVUUiIsInJjaWQiOiJqeV9hQVlHQkF6TWVCdDBXLTl2R2F0Um4wUy1xU3RSSFRJRzVwZElaWDkwIiwiZmxvIjoyfQ.nerEP5TRIA2ISLM-_gGKf6fGxLbIcKLLICzK1zKDg2h566uTzTQzsbhDBgjeM0u4ncuTBi_XsAH8OjZnpSJTeOqxEPls9O1hzeIPrlepOlZn1zrLoH49SWouBHJxqUXP4K-vSS9f8Ail9MdIcVbVm79NCfBwxZBIsumTRr4CdSQn3rDINQ-ERG7jrFbTLhWHka9QOMjHR32_VvYWEJ0YKRLIvZs4R-DBQ48zVUkfR7S3b71T4bQsj9qaJE5tNdevsiwsSAn2OhpkXVrs1sL5nzs1f2KB0WW6zXBdgeQo1riJEv-BGFL7Q4PM3WJidj_kaB5i0_0uACiCH1sCAlQv0w";
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
        data: Type | ListingType<Type>;
        terminationCriteriaMet: boolean;
        pagination: PaginationParams;
      }>(`${url}`, {
        params: {
          ...config,
          ...pagination,
        },
      });

      // Single entities get returned
      if (resp.data.kind !== "Listing") {
        return [resp.data.data as Type];
      }

      data.push(
        // Only keep the data, without the prefix
        ...(resp.data.data as ListingType<Type>).children.map(
          (withPrefix) => withPrefix.data
        )
      );
      terminationCriteriaMet = resp.data.terminationCriteriaMet;
      pagination = resp.data.pagination;
    }

    if (myInterceptor) this.client.interceptors.request.eject(myInterceptor);

    return data;
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
    type?: "inbox" | "unread" | "sent" | "all"
  ): Promise<PrivateMessage[] | Message[]> {
    let endpoints: `${string}.json`[] = [
      "/message/inbox.json",
      "/message/unread.json",
      "/message/sent.json",
    ];

    if (type && type !== "all") {
      endpoints = [`/message/${type}.json`];
    } else {
      endpoints = ["/message/messages.json"];
    }

    const allMessages = await Promise.all(
      endpoints.map(async (endpoint) => {
        const messages = await this._call<Message>("GET", endpoint, {
          count: 0,
        });

        if (type && type === "all") {
          return messages as unknown as PrivateMessage[];
        }
      })
    );

    return allMessages.flat();
  }

  /**
   *
   * @summary Get the profile of auth token owner
   * @returns
   */
  public async getMe(): Promise<Account> {
    // TODO Check if getAppUser returns the same
    try {
      const url = `${URL}/api/v1/me.json`;
      const user = await this._call<Account>("GET", url);

      return user[0];
    } catch (error) {
      console.log(error.message);
    }
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
   *
   * @summary This method is implemented by making api calls since no such Devvit method exists (v.0.11)
   * @summary Get subreddits where the user is subcribed to, a contributor or a moderator
   * @see https://www.reddit.com/dev/api#GET_subreddits_mine_{where}
   * @returns
   */
  public async getSubreddits(): Promise<Subreddit[] | undefined> {
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
  public async getComments(
    username: string,
    pageSize: number,
    limit: number,
    timeframe: "all" = "all",
    sort: "new" = "new",
    before?: string,
    after?: string
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
}
