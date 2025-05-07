import { BaseHandlerConfig } from "../../interfaces";

export enum RedditChatType {
  INBOX = "chatTypeInbox",
  UNREAD = "chatTypeUnread",
  SENT = "chatTypeSent",
}

type CommentPrefix = "t1";
type AccountPrefix = "t2";
type LinkPrefix = "t3";
type MessagePrefix = "t4";
type SubredditPrefix = "t5";
type AwardPrefix = "t6";

export type EntityPrefixes =
  | CommentPrefix
  | AccountPrefix
  | LinkPrefix
  | MessagePrefix
  | SubredditPrefix
  | AwardPrefix;

// See here: https://www.reddit.com/dev/api/#fullnames
export type EntityFullname = `${EntityPrefixes}_${string}`;

export interface RedditConfig extends BaseHandlerConfig {
  apiId: number;
  apiHash: string;
  maxSyncLoops: number;
  // What is the maximum number of days to backdate
  messageMaxAgeDays: number;
  // Maximum number of messages to process in a given batch
  messageBatchSize: number;
  useDbPos: boolean;
}

export type RedditBase = {
  id: string;
  name: `${EntityPrefixes}_${string}`;
  kind: EntityPrefixes | "Listing" | "more";
  data:
    | Listing
    | Account
    | Comment
    | Message
    | PrivateMessage
    | Post
    | Subreddit;
};

export type Listing = {
  before: string | null;
  after: string | null;
  modhash: string;
  children: RedditBase[];
};

type Created = {
  created: number;
  created_utc: number;
};

export type Account = {
  comment_karma: number;
  has_mail: boolean | null;
  has_mod_mail: boolean | null;
  has_verified_email: boolean;
  id: `${AccountPrefix}_${string}`;
  inbox_count: number;
  is_friend: boolean;
  is_gold: boolean;
  is_mod: boolean;
  link_karma: number;
  modhash: string;
  name: string;
  over_18: boolean;
} & Created;

export type Comment = {
  approved_by: string | null;
  author: string;
  author_flair_css_class: string;
  author_flair_text: string;
  banned_by: string | null;
  body: string;
  body_html: string;
  edited: boolean | number;
  gilded: number;
  likes: boolean;
  link_author: string;
  link_id: `${LinkPrefix}_${string}`;
  link_title: string;
  link_url: string;
  num_reports: number | null;
  parent_id: `${LinkPrefix | CommentPrefix}_${string}`;
  replies: RedditBase[];
  saved: boolean;
  score: number;
  score_hidden: boolean;
  subreddit: string;
  subreddit_id: `${SubredditPrefix}_${string}`;
  distinguished: null | string;
} & Created;

export type Subreddit = {
  accounts_active: number;
  comment_score_hide_mins: number;
  description: string;
  description_html: string;
  display_name: string;
  header_img: string;
  header_size: [number, number];
  header_title: string;
  over18: boolean;
  public_description: string;
  public_traffic: boolean;
  subscribers: number;
  submission_type: "any" | "link" | "self";
  submit_link_label: string;
  submit_text_label: string;
  subreddit_type: "public" | "private" | "restricted" | "gold_restricted";
  title: string;
  url: string;
  user_is_banned: boolean;
  user_is_contributor: boolean;
  user_is_moderato: boolean;
  user_is_subscribe: boolean;
} & Created;

// These are messages like notifications
export type Message = {
  author: string;
  body: string;
  body_html: string;
  context: `${string}?context=3`| ""
  first_message: null | string
  first_message_name: null | string
  likes: boolean;
  link_title: string;
  name: `${MessagePrefix}_${string}`
  new: string;
  parent_id: null | `${EntityPrefixes}_${string}`;
  replies: string | ""
  subject: string;
  subreddit: null | string
  was_comment: boolean;
} & Created;

// Reference: https://www.reddit.com/r/redditdev/comments/vuwhyp/fetch_private_messages_with_a_specific_reddit_user/
export type PrivateMessage = {
  first_message: null;
  first_message_name: null;
  subreddit: null;
  likes: null;
  replies: "";
  author_fullname: `${AccountPrefix}_${string}`;
  id: string;
  subject: string;
  associated_awarding_id: null;
  score: number;
  author: string;
  num_comments: null;
  parent_id: null;
  subreddit_name_prefixed: null;
  new: boolean;
  type: "unknown";
  body: string;
  dest: string;
  was_comment: boolean;
  body_html: string;
  name: `${CommentPrefix}_${string}`;
  context: string;
  distinguished: null;
} & Created;

// See: https://github.com/reddit-archive/reddit/wiki/JSON#link-implements-votable--created
export type Post = {
  author: string;
  author_flair_css_class: string;
  author_flair_text: string;
  hidden: boolean;
  is_self: boolean;
  likes: boolean | true;
  locked: boolean;
  num_comments: number;
  over_18: boolean;
  permalink: string;
  saved: boolean;
  score: number;
  selftext: string;
  selftext_html: string;
  subreddit: string;
  subreddit_id: `${SubredditPrefix}_${string}`;
  thumbnail: string;
  title: string;
  url: string;
  edited: boolean;
  distinguished: boolean | null;
  stickied: boolean;
} & Created;

export type BaseRequestConfig = {
  count: number;
  max_replies?: number;
  pagination?: PaginationParams;
};

export type PaginationParams = {
  before?: EntityFullname;
  after?: EntityFullname;
  afterData?: number;
  beforeData?: number;
};

export type UserWhereConfig = {
  // an integer between 2 and 10
  // context: ?
  sort: "hot" | "new" | "top" | "controversial";
  t: "hour" | " day" | " week" | " month" | " year" | " all";
  type: "links" | "comments";
  // Expand subreddits
  sr_details: boolean;
} & BaseRequestConfig;
