// import { Listing, PrivateMessage, User, Subreddit } from "@devvit/public-api";
import { Connection } from "../../../src/interfaces";
import { RedditApi } from "../../../src/providers/reddit/api";
import { CommonTests } from "../../common.tests";
import CommonUtils from "../../common.utils";
const assert = require("assert");
import ChatsHandler from "../../../src/providers/reddit/message";
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

  it("should fetch user", async () => {
    // TODO Fetch from config
    const user = await api.getUser(API_CONFIG.username);
    assert.notStrictEqual(user, null);
  });

  it("should fetch messages", async () => {
    // Get all the messages
    const allMessages = await api.getMessages();
    assert(allMessages.length > 0, "No messages fetched");

    const unreadMessages = await api.getMessages("unread");
    assert(
      allMessages.length >= unreadMessages.length,
      "All messages should contain unreadMessages"
    );

    // Get all private messages
    const privateMessages = await api.getMessages("private");
    assert(privateMessages.length > 0, "No messages fetched");
  });

  it("should fetch comments", async () => {
    // Should fetch comments created by owner
    const comments = await api.getCommentsCreatedByUser();
    assert(comments.length > 0, "No comments found");

    // Should fetch comments upvoted by a user
    const commentsByUser = await api.getComments(
      "upvoted",
      API_CONFIG.username
    );
    assert(commentsByUser.length > 0, "No comments found by user");

    // Should try to fetch comments upvoted by a random user and fail
    const error = await api.getComments("upvoted", API_CONFIG.randomUsername);
    assert(error === undefined, "Fetched upvoted comments without authority");

    // Should fetch all interacted comments created by user
    const interactedComments = await api.getComments();
    assert(interactedComments.length > 0, "No interacted comments found");
  });

  it("should fetch posts", async () => {
    // Should fetch comments created by owner
    const posts = await api.getPostsCreatedByUser();
    assert(posts.length > 0, "No posts found");

    // Should fetch posts saved by a user
    const postsByUser = await api.getPosts("saved", API_CONFIG.username);
    assert(postsByUser.length > 0, "No posts found by user");

    // Should try to fetch posts upvoted by a random user and fail
    const error = await api.getPosts("upvoted", API_CONFIG.randomUsername);
    assert(error === undefined, "Fetched upvoted posts without authority");

    // Should fetch all interacted posts created by user
    const interactedposts = await api.getPosts();
    assert(interactedposts.length > 0, "No interacted posts found");
  });

  it("should fetch subreddits", async () => {
    // Get all subreddits where the user is either a moderator, contributor or subscriber
    const allSubreddits = await api.getSubreddits();
    assert(allSubreddits.length > 0, "No subreddits found");

    // Get all subreddits where the owner is a contributor
    const contributorSubreddits = await api.getSubreddits("contributor");
    // assert(moderatedSubreddits.length > 0, "No moderated subreddits found");

    // All subreddits should contain a moderated subreddit
    const should = allSubreddits.find(
      (subreddit) => subreddit.name === contributorSubreddits[0].name
    );
    assert(!!should, "No moderated subreddits found");
  });
});
