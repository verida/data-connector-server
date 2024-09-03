import CONFIG from "../../config";
import { SyncProviderLogEvent, SyncProviderLogLevel, SyncHandlerPosition, SyncItemsBreak, SyncResponse, SyncHandlerStatus, SyncItemsResult, ConnectionOptionType, ProviderHandlerOption } from '../../interfaces';
import { SchemaFile } from "../../schemas";
import { google, drive_v3 } from "googleapis";
import { GaxiosResponse } from "gaxios";
import { GoogleDriveHelpers } from "./helpers";
import { ItemsRangeTracker } from "../../helpers/itemsRangeTracker";
import GoogleHandler from "./GoogleHandler";

const _ = require("lodash");

const MAX_BATCH_SIZE = 1000;

export interface SyncDocumentItemsResult extends SyncItemsResult {
    items: SchemaFile[];
}

export default class GoogleDriveDocument extends GoogleHandler {

    public getLabel(): string {
        return "Google Drive Documents"
    }

    public getName(): string {
        return "google-drive-documents";
    }

    public getSchemaUri(): string {
        return CONFIG.verida.schemas.DOCUMENT;
    }

    public getProviderApplicationUrl(): string {
        return "https://drive.google.com";
    }

    public getGoogleDrive(): drive_v3.Drive {
        const auth = this.getGoogleAuth();
        return google.drive({ version: "v3", auth });
    }

    public getOptions(): ProviderHandlerOption[] {
        return [{
            name: 'backdate',
            label: 'Backdate history',
            type: ConnectionOptionType.ENUM,
            enumOptions: ['1 month', '3 months', '6 months', '12 months'],
            defaultValue: '3 months'
        }];
    }

    public async _sync(
        api: any,
        syncPosition: SyncHandlerPosition
    ): Promise<SyncResponse> {
        if (this.config.batchSize > MAX_BATCH_SIZE) {
            throw new Error(`Batch size (${this.config.batchSize}) is larger than permitted (${MAX_BATCH_SIZE})`);
        }
    
        const drive = this.getGoogleDrive();
        const rangeTracker = new ItemsRangeTracker(syncPosition.thisRef);
    
        let items: SchemaFile[] = [];
        let currentRange = rangeTracker.nextRange();
        let query: drive_v3.Params$Resource$Files$List = {
            pageSize: this.config.batchSize,
            fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, webViewLink, thumbnailLink)',
            q: "mimeType != 'application/vnd.google-apps.folder'", // Fetch all files without restricting mimeType
            orderBy: "modifiedTime desc", // Fetch files ordered by modifiedTime descending
        };
    
        if (currentRange.startId) {
            query.pageToken = currentRange.startId;
        }
    
        const latestResponse = await drive.files.list(query);
        const latestResult = await this.buildResults(
            drive,
            latestResponse,
            currentRange.endId,
            _.has(this.config, "breakTimestamp")
                ? this.config.breakTimestamp
                : undefined
        );
    
        items = latestResult.items;
        let nextPageToken = _.get(latestResponse, "data.nextPageToken");
    
        if (items.length) {
            rangeTracker.completedRange({
                startId: items[0].sourceId,
                endId: nextPageToken
            }, latestResult.breakHit === SyncItemsBreak.ID);
        } else {
            rangeTracker.completedRange({
                startId: undefined,
                endId: undefined
            }, false);
        }
    
        currentRange = rangeTracker.nextRange();
        if (items.length != this.config.batchSize && currentRange.startId) {
            query = {
                ...query,
                pageSize: this.config.batchSize - items.length,
                pageToken: currentRange.startId
            };
    
            const backfillResponse = await drive.files.list(query);
            const backfillResult = await this.buildResults(
                drive,
                backfillResponse,
                currentRange.endId,
                _.has(this.config, "breakTimestamp")
                    ? this.config.breakTimestamp
                    : undefined
            );
    
            items = items.concat(backfillResult.items);
            nextPageToken = _.get(backfillResponse, "data.nextPageToken");
    
            if (backfillResult.items.length) {
                rangeTracker.completedRange({
                    startId: backfillResult.items[0].sourceId,
                    endId: nextPageToken
                }, backfillResult.breakHit === SyncItemsBreak.ID);
            } else {
                rangeTracker.completedRange({
                    startId: undefined,
                    endId: undefined
                }, backfillResult.breakHit === SyncItemsBreak.ID);
            }
        }
    
        if (!items.length) {
            syncPosition.syncMessage = `Stopping. No results found.`;
            syncPosition.status = SyncHandlerStatus.ENABLED;
        } else {
            syncPosition.syncMessage = items.length != this.config.batchSize && !nextPageToken
                ? `Processed ${items.length} items. Stopping. No more results.`
                : `Batch complete (${this.config.batchSize}). More results pending.`;
        }
    
        syncPosition.thisRef = rangeTracker.export();
    
        return {
            results: items,
            position: syncPosition,
        };
    }
   
    protected async buildResults(
        drive: drive_v3.Drive,
        serverResponse: GaxiosResponse<drive_v3.Schema$FileList>,
        breakId: string,
        breakTimestamp?: string
    ): Promise<SyncDocumentItemsResult> {
        const results: SchemaFile[] = [];
        let breakHit: SyncItemsBreak;
    
        for (const file of serverResponse.data.files ?? []) {
            
            const fileId = file.id;
            if (!fileId) {
                const logEvent: SyncProviderLogEvent = {
                    level: SyncProviderLogLevel.DEBUG,
                    message: `Invalid ID for file ${fileId}. Ignoring this file.`,
                };
                this.emit('log', logEvent);
                continue;
            }
            
            if (fileId === breakId) {
                const logEvent: SyncProviderLogEvent = {
                    level: SyncProviderLogLevel.DEBUG,
                    message: `Break ID hit (${breakId})`,
                };
                this.emit('log', logEvent);
                breakHit = SyncItemsBreak.ID;
                break;
            }
    
            const createdTime = file.createdTime ?? new Date().toISOString();
            const modifiedTime = file.modifiedTime ?? new Date().toISOString();
    
            if (breakTimestamp && modifiedTime < breakTimestamp) {
                const logEvent: SyncProviderLogEvent = {
                    level: SyncProviderLogLevel.DEBUG,
                    message: `Break timestamp hit (${breakTimestamp})`,
                };
                this.emit('log', logEvent);
                breakHit = SyncItemsBreak.TIMESTAMP;
                break;
            }
    
            const title = file.name ?? 'No title';
            const link = file.webViewLink;
            if (!link) {
                const logEvent: SyncProviderLogEvent = {
                    level: SyncProviderLogLevel.DEBUG,
                    message: `No link available for file ${fileId}. Ignoring this file.`,
                };
                this.emit('log', logEvent);
                continue;
            }
    
            const mimeType = file.mimeType;
            if (!mimeType) {
                const logEvent: SyncProviderLogEvent = {
                    level: SyncProviderLogLevel.DEBUG,
                    message: `No mimeType available for file ${fileId}. Ignoring this file.`,
                };
                this.emit('log', logEvent);
                continue;
            }
    
            const extension = await GoogleDriveHelpers.getFileExtension(this.getGoogleDrive(), fileId);
            const thumbnail = file.thumbnailLink ?? '';
            const size = await GoogleDriveHelpers.getFileSize(drive, fileId);
            if (!size) {
                const logEvent: SyncProviderLogEvent = {
                    level: SyncProviderLogLevel.DEBUG,
                    message: `No size for file ${fileId}. Ignoring this file.`,
                };
                this.emit('log', logEvent);
                continue;
            }

            const sizeLimit = this.config.sizeLimit * 1024 * 1024;
            const textContent = await GoogleDriveHelpers.extractTextContent(drive, fileId, mimeType, sizeLimit, this.getGoogleAuth());
    
            results.push({
                _id: this.buildItemId(fileId),
                schema: CONFIG.verida.schemas.FILE,
                name: title,
                mimeType: mimeType,
                extension: extension,
                size: size,
                uri: link,
                icon: thumbnail,
                contentText: textContent,
                fileDataId: undefined,
                sourceId: fileId,
                sourceData: file,
                sourceAccountId: this.provider.getProviderId(),
                sourceApplication: this.getProviderApplicationUrl(),
                insertedAt: createdTime,
                modifiedAt: modifiedTime,
            });
        }
    
        return {
            items: results,
            breakHit,
        };
    }
    
}
