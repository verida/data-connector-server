import { Listing, PrivateMessage, User, Subreddit } from "@devvit/public-api";
import { RedditApi } from "../../../src/providers/reddit/api";
import { z } from "zod";

// TODO Read from .env file
const clientId = "";
const reddit = new RedditApi(clientId);
const API_CALLS = [
  {
    endpoint: "chats",
    action: reddit.getChats,
    params: ["inbox", 100],
    expectedType: Listing<PrivateMessage>,
  },
  {
    endpoint: "me",
    action: reddit.getMe,
    expectedType: User,
  },
  {
    endpoint: "user",
    action: reddit.getUser,
    params: [""],
    expectedType: User,
  },
  {
    endpoint: "subreddits",
    action: reddit.getSubreddits,
    expectedType: Listing<Subreddit>,
  },
];

/**
 * @summary Test that API calls returns a result w/ the expected type
 */
describe("Reddit API test", async () => {
  it("should fetch valid data for each supported endpoint", async () => {
    await Promise.all(
      API_CALLS.map(async (apiCall) => {
        const { params, action } = apiCall;
        // @ts-expect-error Just for testing
        const resp = params ? action(...params) : action;
      })
    );
  });
});
