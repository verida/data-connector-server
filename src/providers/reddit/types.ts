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

export type Subreddit = {
  user_flair_background_color: null;
  submit_text_html: null;
  restrict_posting: boolean;
  user_is_banned: boolean;
  free_form_reports: boolean;
  wiki_enabled: boolean;
  user_is_muted: boolean;
  user_can_flair_in_sr: null;
  display_name: string;
  header_img: null;
  title: string;
  allow_galleries: boolean;
  icon_size: [number, number];
  primary_color: string;
  active_user_count: null;
  icon_img: string;
  display_name_prefixed: string;
  accounts_active: null;
  public_traffic: boolean;
  subscribers: number;
  user_flair_richtext: [];
  videostream_links_count: number;
  name: `${SubredditPrefix}_${string}`;
  quarantine: boolean;
  hide_ads: boolean;
  prediction_leaderboard_entry_type: number;
  emojis_enabled: boolean;
  advertiser_category: string;
  public_description: string;
  comment_score_hide_mins: 0;
  allow_predictions: boolean;
  user_has_favorited: boolean;
  user_flair_template_id: null;
  community_icon: string;
  banner_background_image: string;
  original_content_tag_enabled: boolean;
  community_reviewed: boolean;
  submit_text: string;
  description_html: null;
  spoilers_enabled: boolean;
  comment_contribution_settings: {
    allowed_media_types: null;
  };
  allow_talks: boolean;
  header_size: null;
  is_default_banner: boolean;
  user_flair_position: "right";
  is_default_icon: [boolean];
  all_original_content: boolean;
  collections_enabled: boolean;
  is_enrolled_in_new_modmail: boolean;
  key_color: string;
  can_assign_user_flair: boolean;
  created: number;
  wls: null;
  show_media_preview: boolean;
  submission_type: "any";
  user_is_subscriber: boolean;
  allowed_media_in_comments: [];
  allow_videogifs: boolean;
  should_archive_posts: boolean;
  user_flair_type: "text";
  allow_polls: boolean;
  collapse_deleted_comments: boolean;
  coins: 0;
  emojis_custom_size: null;
  public_description_html: null;
  allow_videos: boolean;
  is_crosspostable_subreddit: boolean;
  notification_level: null;
  should_show_media_in_comments_setting: boolean;
  can_assign_link_flair: boolean;
  has_menu_widget: boolean;
  accounts_active_is_fuzzed: boolean;
  allow_prediction_contributors: boolean;
  submit_text_label: "";
  link_flair_position: "";
  user_sr_flair_enabled: null;
  user_flair_enabled_in_sr: boolean;
  allow_discovery: boolean;
  accept_followers: boolean;
  user_sr_theme_enabled: boolean;
  link_flair_enabled: boolean;
  disable_contributor_requests: boolean;
  subreddit_type: "user";
  suggested_comment_sort: "qa";
  banner_img: string;
  user_flair_text: null;
  banner_background_color: string;
  show_media: boolean;
  id: string;
  user_is_moderator: boolean;
  over18: boolean;
  header_title: string;
  description: string;
  submit_link_label: string;
  user_flair_text_color: null;
  restrict_commenting: boolean;
  user_flair_css_class: null;
  allow_images: boolean;
  lang: "en";
  url: string;
  created_utc: number;
  banner_size: null;
  mobile_banner_image: string;
  user_is_contributor: boolean;
  allow_predictions_tournament: boolean;
};

// These are messages like notifications
export type MessageAsAComment = {
  first_message: null;
  first_message_name: null;
  subreddit: string;
  likes: null;
  replies: string;
  author_fullname: `${AccountPrefix}_${string}`;
  id: string;
  subject: string;
  associated_awarding_id: null;
  score: number;
  author: string;
  num_comments: number;
  parent_id: `${EntityPrefixes}_${string}`;
  subreddit_name_prefixed: `r/${string}`;
  new: true;
  type: "comment_reply";
  body: string;
  link_title: string;
  dest: string;
  was_comment: true;
  body_html: string;
  //   NOTE This is a comment entity
  name: `${CommentPrefix}_${string}`;
  created: number;
  created_utc: number;
  context: string;
  distinguished: null;
};

// Reference: https://www.reddit.com/r/redditdev/comments/vuwhyp/fetch_private_messages_with_a_specific_reddit_user/
export type PrivateMessages = {
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
  created: number;
  created_utc: number;
  context: string;
  distinguished: null;
};

// Chat messages are not supported: https://www.reddit.com/r/redditdev/comments/17s83sf/chat_api/

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
