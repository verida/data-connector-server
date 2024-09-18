import { WebClient } from "@slack/web-api";
import CONFIG from "../../config";
import {
  SyncItemsBreak,
  SyncItemsResult,
  SyncProviderLogEvent,
  SyncProviderLogLevel,
} from "../../interfaces";
import { ItemsRangeTracker } from "../../helpers/itemsRangeTracker";
import {
  SyncResponse,
  SyncHandlerStatus,
  ProviderHandlerOption,
  ConnectionOptionType,
} from "../../interfaces";
import { SchemaSocialChatGroup } from "../../schemas";
import { SlackChatGroupType, SlackProviderConfig } from "./interfaces";
import BaseSyncHandler from "../BaseSyncHandler";

const _ = require("lodash");

const MAX_BATCH_SIZE = 200; // Slack's API often has lower rate limits

export interface SyncSlackGroupsResult extends SyncItemsResult {
  response_metadata: any;
  items: SchemaSocialChatGroup[];
}

export default class SlackChatGroupHandler extends BaseSyncHandler {

  public getLabel(): string {
    return "Slack Groups";
  }

  public getName(): string {
    return "slack-groups";
  }

  public getSchemaUri(): string {
    return CONFIG.verida.schemas.CHAT_GROUP;
  }

  public getProviderApplicationUrl() {
    return "https://slack.com/";
  }

  public getSlackClient(): WebClient {
    const token = this.connection.accessToken;
    return new WebClient(token);
  }

  public getOptions(): ProviderHandlerOption[] {
    return [
      {
        id: "groupTypes",
        label: "Group types",
        type: ConnectionOptionType.ENUM_MULTI,
        enumOptions: [
          { label: "Public Channel", value: SlackChatGroupType.CHANNEL },
          { label: "Private Channel", value: SlackChatGroupType.GROUP },
          { label: "IM", value: SlackChatGroupType.IM },
          { label: "MPIM", value: SlackChatGroupType.MPIM },
        ],
        defaultValue: [
          SlackChatGroupType.CHANNEL,
          SlackChatGroupType.GROUP,
          SlackChatGroupType.IM,
          SlackChatGroupType.MPIM,
        ].join(","),
      },
    ];
  }

  public async _sync(
    api: any,
    syncPosition: any // Define a more specific Slack sync schema interface
  ): Promise<SyncResponse> {
    if (this.config.batchSize > MAX_BATCH_SIZE) {
      throw new Error(
        `Batch size (${this.config.batchSize}) is larger than permitted (${MAX_BATCH_SIZE})`
      );
    }

    const slack = this.getSlackClient();
    const rangeTracker = new ItemsRangeTracker(syncPosition.thisRef);
    let items: SchemaSocialChatGroup[] = [];

    let currentRange = rangeTracker.nextRange();
    let latestGroups = await this.fetchGroups(slack, currentRange.startId);

    items = latestGroups.items;

    let nextCursor = _.has(latestGroups, "response_metadata.next_cursor")
      ? latestGroups.response_metadata.next_cursor
      : undefined;

    if (items.length) {
      rangeTracker.completedRange(
        {
          startId: items[0].sourceId,
          endId: nextCursor,
        },
        latestGroups.breakHit === SyncItemsBreak.ID
      );
    } else {
      rangeTracker.completedRange(
        {
          startId: undefined,
          endId: undefined,
        },
        false
      );
    }

    if (!items.length) {
      syncPosition.syncMessage = `Stopping. No results found.`;
      syncPosition.status = SyncHandlerStatus.ENABLED;
    } else {
      if (items.length != this.config.batchSize && !nextCursor) {
        syncPosition.syncMessage = `Processed ${items.length} items. Stopping. No more results.`;
        syncPosition.status = SyncHandlerStatus.ENABLED;
      } else {
        syncPosition.syncMessage = `Batch complete (${this.config.batchSize}). More results pending.`;
      }
    }

    syncPosition.thisRef = rangeTracker.export();

    return {
      results: items,
      position: syncPosition,
    };
  }

  protected async fetchGroups(
    slack: WebClient,
    cursor?: string
  ): Promise<SyncSlackGroupsResult> {
    const types = this.config.groupTypes || "public_channel,private_channel,im,mpim";
    const result = await slack.conversations.list({
      limit: this.config.batchSize,
      cursor,
      types,
    });

    return this.buildResults(result);
  }

  protected async buildResults(
    slackResponse: any
  ): Promise<SyncSlackGroupsResult> {
    const groups = slackResponse.channels;
    const results: SchemaSocialChatGroup[] = [];
    let breakHit: SyncItemsBreak;

    for (const rawGroup of groups) {
      const groupId = rawGroup.id;
      const groupName = rawGroup.name;
      const groupType = this.mapGroupType(rawGroup);

      const group: SchemaSocialChatGroup = {
        _id: this.buildItemId(rawGroup.id),
        name: groupName ?? "Unkown",
        type: groupType,
        sourceApplication: this.getProviderApplicationUrl(),
        sourceId: groupId,
        sourceData: rawGroup,
        insertedAt: new Date().toISOString(),
      };

      results.push(group);
    }

    return {
      items: results,
      response_metadata: groups.response_metadata,
      breakHit,
    };
  }

  protected mapGroupType(rawGroup: any): string {
    if (rawGroup.is_channel && !rawGroup.is_private) return SlackChatGroupType.CHANNEL;
    if (rawGroup.is_channel && rawGroup.is_private) return SlackChatGroupType.GROUP;
    if (rawGroup.is_im) return SlackChatGroupType.IM;
    if (rawGroup.is_mpim) return SlackChatGroupType.MPIM;
    return "unknown";
  }
}
