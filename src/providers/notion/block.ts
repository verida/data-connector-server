import CONFIG from "../../config";
import { BaseHandlerConfig, SyncItemsBreak, SyncItemsResult, SyncProviderLogEvent, SyncProviderLogLevel } from "../../interfaces";
import { Client } from "@notionhq/client";
import { ItemsRangeTracker } from "../../helpers/itemsRangeTracker";
import {
    SyncResponse,
    SyncHandlerStatus,
    ProviderHandlerOption,
    ConnectionOptionType,
} from "../../interfaces";
import { SchemaRecord } from "../../schemas";
import AccessDeniedError from "../AccessDeniedError";
import InvalidTokenError from "../InvalidTokenError";
import BaseSyncHandler from "../BaseSyncHandler";

const MAX_BATCH_SIZE = 500;

export interface SyncBlockItemsResult extends SyncItemsResult {
    items: any[];
}

export default class NotionBlockHandler extends BaseSyncHandler {
    protected config: BaseHandlerConfig;

    public getLabel(): string {
        return "Notion Blocks";
    }

    public getName(): string {
        return "notion_blocks";
    }

    public getSchemaUri(): string {
        return CONFIG.verida.schemas.BLOCK;
    }

    public getProviderApplicationUrl(): string {
        return "https://notion.so/";
    }

    public getNotionClient(): Client {
        return new Client({ auth: this.connection.accessToken });
    }

    public getOptions(): ProviderHandlerOption[] {
        return [
            {
                id: "syncDepth",
                label: "Sync Depth",
                type: ConnectionOptionType.ENUM,
                enumOptions: [
                    { value: "1-level", label: "1 Level" },
                    { value: "2-levels", label: "2 Levels" },
                    { value: "all", label: "All Levels" },
                ],
                defaultValue: "1-level",
            },
        ];
    }

    public async _sync(api: any, syncPosition: any): Promise<SyncResponse> {
        try {
            if (this.config.batchSize > MAX_BATCH_SIZE) {
                throw new Error(`Batch size (${this.config.batchSize}) exceeds max limit (${MAX_BATCH_SIZE})`);
            }

            const notion = this.getNotionClient();
            const rangeTracker = new ItemsRangeTracker(syncPosition.thisRef);
            let items: any[] = [];

            let currentRange = rangeTracker.nextRange();

            const pages = await this.getPageList();

            const page = await notion.pages.retrieve({
                page_id: pages[0].id
            })

            let query = { block_id: pages[0].id, start_cursor: currentRange.startId };

            const latestResponse = await notion.blocks.children.list(query);


            const latestResult = await this.buildResults(notion, latestResponse, currentRange.endId);

            items = latestResult.items;
            let nextPageCursor = latestResponse.next_cursor;

            if (items.length) {
                rangeTracker.completedRange({
                    startId: items[0].id,
                    endId: nextPageCursor,
                }, latestResult.breakHit === SyncItemsBreak.ID);
            } else {
                rangeTracker.completedRange({ startId: undefined, endId: undefined }, false);
            }

            if (!items.length) {
                syncPosition.syncMessage = "Stopping. No results found.";
                syncPosition.status = SyncHandlerStatus.ENABLED;
            } else {
                syncPosition.syncMessage = items.length !== this.config.batchSize && !nextPageCursor
                    ? `Processed ${items.length} items. Stopping. No more results.`
                    : `Batch complete (${this.config.batchSize}). More results pending.`;
            }

            syncPosition.thisRef = rangeTracker.export();

            return { results: items, position: syncPosition };
        } catch (err: any) {
            if (err.status === 403) throw new AccessDeniedError(err.message);
            if (err.status === 401) throw new InvalidTokenError(err.message);
            throw err;
        }


    }

    protected async buildResults(
        notion: Client,
        serverResponse: any,
        breakId: string
    ): Promise<SyncBlockItemsResult> {
        const results: any[] = [];
        let breakHit: SyncItemsBreak;

        for (const block of serverResponse.results) {
            if (block.id === breakId) {
                this.emit("log", { level: SyncProviderLogLevel.DEBUG, message: `Break ID hit (${breakId})` });
                breakHit = SyncItemsBreak.ID;
                break;
            }

            results.push({
                _id: this.buildItemId(block.id),
                type: block.type,
                sourceId: block.id,
                sourceApplication: this.getProviderApplicationUrl(),
                content: JSON.stringify(block),
                insertedAt: new Date().toISOString(),
            });
        }

        return { items: results, breakHit };
    }

    public async getPageList(): Promise<any[]> {
        try {
            const notion = await this.getNotionClient();
            const response = await notion.search({
                filter: { property: "object", value: "page" },
                sort: { direction: "ascending", timestamp: "last_edited_time" },
                page_size: 50 // Max is 100
            });

            return response.results;

        } catch (error) {
            console.error("Error fetching Notion pages:", error);
        }
    }

}
