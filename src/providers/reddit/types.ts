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

// 'Account' is name of the type, but 'User' is the name of the entity
export type Account = {
  verified: boolean;
  is_blocked: boolean;
  coins: number;
  id: string;
  over_18: boolean;
  is_gold: boolean;
  is_mod: boolean;
  is_suspended: boolean;
  has_stripe_subscription: boolean;
  has_android_subscription: boolean;
  awarder_karma: number;
  awardee_karma: number;
  suspension_expiration_utc: number;
  icon_img: string;
  pref_nightmode: boolean;
  hide_from_robots: boolean;
  modhash: string;
  link_karma: number;
  force_password_reset: boolean;
  total_karma: number;
  inbox_count: number;
  pref_top_karma_subreddits: boolean;
  has_mail: boolean;
  name: string;
  created: number;
  has_verified_email: boolean;
  gold_creddits: number;
  created_utc: number;
  has_ios_subscription: boolean;
  pref_show_twitter: boolean;
  comment_karma: number;
  accept_followers: boolean;
  has_subscribed: boolean;
};

export type Comment = {
  subreddit_id: string;
  approved_at_utc: boolean;
  author_is_blocked: boolean;
  link_title: string;
  mod_reason_by: null;
  banned_by: null;
  ups: number;
  num_reports: null;
  author_flair_type: "richtext";
  total_awards_received: number;
  subreddit: string;
  link_author: string;
  likes: boolean;
  replies: string;
  user_reports: [];
  saved: boolean;
  id: string;
  banned_at_utc: number | null;
  mod_reason_title: string | null;
  gilded: number;
  archived: boolean;
  no_follow: boolean;
  author: string;
  num_comments: number;
  parent_id: string;
  score: number;
  author_fullname: string; // "t2_wqn83kvnz";
  over_18: boolean;
  report_reasons: string | null;
  removal_reason: string | null;
  approved_by: string | null;
  controversiality: number;
  body: string;
  edited: boolean;
  top_awarded_type: null;
  downs: number;
  author_flair_css_class: null;
  is_submitter: boolean;
  collapsed: boolean;
  author_flair_richtext: {
    e: "text";
    t: string;
  }[];
  author_patreon_flair: boolean;
  body_html: string;
  gildings: {};
  collapsed_reason: string | null;
  distinguished: string | null;
  associated_award: string | null;
  stickied: boolean;
  author_premium: boolean;
  can_gild: boolean;
  // TODO do this for other _id
  link_id: `t${number}_${string}`;
  unrepliable_reason: string | null;
  author_flair_text_color: string;
  score_hidden: boolean;
  permalink: "/r/${string}/comments/${string}/_/${string}/";
  subreddit_type: "public";
  link_permalink: "https://www.reddit.com/r/${string}/comments/${string}/_/";
  name: "t${number}_${number}";
  created: number;
  subreddit_name_prefixed: "r/${string}";
  author_flair_text: string;
  treatment_tags: [];
  rte_mode: "richtext";
  created_utc: number;
  awarders: [];
  all_awardings: [];
  locked: boolean;
  author_flair_background_color: "";
  collapsed_because_crowd_control: null;
  mod_reports: [];
  quarantine: boolean;
  mod_note: null;
  link_url: "https://v.redd.it/${reddit}";
  author_flair_template_id: null;
};

// API types
export interface ListingType<Type> {
  after: EntityFullname;
  dist: number;
  children: { kind: EntityPrefixes; data: Type }[];
}

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
