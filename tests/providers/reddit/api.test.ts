// import { Listing, PrivateMessage, User, Subreddit } from "@devvit/public-api";
import { Connection } from "../../../src/interfaces";
import { RedditApi } from "../../../src/providers/reddit/api";
import { CommonTests } from "../../common.tests";
import CommonUtils from "../../common.utils";
const assert = require("assert");
import ChatsHandler from "../../../src/providers/reddit/chat";
import { before } from "mocha/lib/mocha";
import { API_CONFIG } from "./config";

let connection: Connection;
let api;

const d = new Date();
const twoMonthsAgo = d.setMonth(d.getMonth() - 2);

describe("Reddit API test", async () => {
  before(async () => {
    connection = await CommonUtils.getConnection("reddit");

    const objects = await CommonTests.buildTestObjects(
      "reddit",
      ChatsHandler,
      {},
      connection
    );
    api = objects.api;
  });

  it("should fetch me", async () => {
    const me = await api.getMe();
    assert.notStrictEqual(me, null);
  });

  it.skip("should fetch user", async () => {
    // TODO Fetch from config
    const user = await api.getUser(API_CONFIG.username);
    assert.notStrictEqual(user, null);
  });

  it("should fetch privates messages", async () => {
    // Get all the messages
    const allMessages = await api.getMessages();
    assert(allMessages > 0, "No messages fetched");

    const unreadMessages = await api.getMessages("unread");
    assert(
      allMessages > unreadMessages,
      "All messages should contain unreadMessages"
    );
  });

  it("should fetch privates messages", async () => {
    // Get all the messages
    const privateMessages = await api.getMessages("private");
    assert(privateMessages > 0, "No messages fetched");

    // Fetch messages in the last 2 months
    const privateMessagesLast2Months = await api.getMessages("private", {
      untilDate: twoMonthsAgo,
    });

    // There should be more messages in the last 3 months than last 2 months
    assert(
      privateMessages <= privateMessagesLast2Months,
      "No messages fetched"
    );
  });

  it("should fetch comments", async () => {
    const comments = await api.getComments();

    assert(comments.length > 0, "No comments found");
  });

  it("should fetch subreddits", async () => {
    const allSubreddits = await api.getSubreddits();
    assert(allSubreddits.length > 0, "No subreddits found");

    const moderatedSubreddits = await api.getSubreddits("moderator");
    assert(moderatedSubreddits.length > 0, "No moderated subreddits found");
  });
});
