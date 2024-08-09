import BaseSyncHandler from "../BaseSyncHandler";
import CONFIG from "../../config";

import {
    SyncResponse,
    SyncHandlerPosition,
    SyncHandlerStatus,
} from "../../interfaces";
import { DocumentType, SchemaDocument } from "../../schemas";
import { google, drive_v3 } from "googleapis";
import { GaxiosResponse } from "gaxios";
import { GoogleDriveHelpers } from "./helpers";

const _ = require("lodash");

export default class GoogleDriveDocument extends BaseSyncHandler {

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
        const TOKEN = {
            access_token: this.connection.accessToken,
            refresh_token: this.connection.refreshToken,
            scope: "https://www.googleapis.com/auth/drive.readonly",
            token_type: "Bearer",
        };

        const redirectUrl = "";

        const oAuth2Client = new google.auth.OAuth2(
            this.config.clientId,
            this.config.clientSecret,
            redirectUrl
        );

        oAuth2Client.setCredentials(TOKEN);

        const drive = google.drive({ version: "v3", auth: oAuth2Client });
        return drive;
    }

    public async _sync(
        api: any,
        syncPosition: SyncHandlerPosition
    ): Promise<SyncResponse> {
        const drive = this.getGoogleDrive();

        const query: drive_v3.Params$Resource$Files$List = {
            pageSize: this.config.batchSize,
            fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, webViewLink, thumbnailLink)',
            q: "mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.google-apps.presentation' or mimeType='application/pdf' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document'"
        };

        if (syncPosition.thisRef) {
            query.pageToken = syncPosition.thisRef;
        }

        const serverResponse = await drive.files.list(query);

        if (
            !_.has(serverResponse, "data.files") ||
            !serverResponse.data.files.length
        ) {
            // No results found, so stop sync
            syncPosition = this.stopSync(syncPosition);

            return {
                position: syncPosition,
                results: [],
            };
        }

        const results = await this.buildResults(
            drive,
            serverResponse,
            syncPosition.breakId,
            _.has(this.config, "metadata.breakTimestamp")
                ? this.config.metadata.breakTimestamp
                : undefined
        );

        syncPosition = this.setNextPosition(syncPosition, serverResponse);

        if (results.length != this.config.batchSize) {
            // Not a full page of results, so stop sync
            syncPosition = this.stopSync(syncPosition);
        }

        return {
            results,
            position: syncPosition,
        };
    }

    protected stopSync(syncPosition: SyncHandlerPosition): SyncHandlerPosition {
        if (syncPosition.status == SyncHandlerStatus.STOPPED) {
            return syncPosition;
        }

        syncPosition.status = SyncHandlerStatus.STOPPED;
        syncPosition.thisRef = undefined;
        syncPosition.breakId = syncPosition.futureBreakId;
        syncPosition.futureBreakId = undefined;

        return syncPosition;
    }

    protected setNextPosition(
        syncPosition: SyncHandlerPosition,
        serverResponse: GaxiosResponse<drive_v3.Schema$FileList>
    ): SyncHandlerPosition {
        if (!syncPosition.futureBreakId && serverResponse.data.files.length) {
            syncPosition.futureBreakId = `${this.connection.profile.id}-${serverResponse.data.files[0].id}`;
        }

        if (_.has(serverResponse, "data.nextPageToken")) {
            // Have more results, so set the next page ready for the next request
            syncPosition.thisRef = serverResponse.data.nextPageToken;
        } else {
            syncPosition = this.stopSync(syncPosition);
        }

        return syncPosition;
    }

    protected async buildResults(
        drive: drive_v3.Drive,
        serverResponse: GaxiosResponse<drive_v3.Schema$FileList>,
        breakId: string,
        breakTimestamp?: string
    ): Promise<SchemaDocument[]> {
        const results: SchemaDocument[] = [];
        for (const file of serverResponse.data.files) {
            const fileId = `${this.connection.profile.id}-${file.id}`;

            if (fileId == breakId) {
                break;
            }

            const modifiedTime = file.modifiedTime || "Unknown";
            
            if (breakTimestamp && modifiedTime < breakTimestamp) {
                break;
            }

            const title = file.name || "No title";
            const link = file.webViewLink || "No link";
            const mimeType = file.mimeType || "Unknown";
            const thumbnail = file.thumbnailLink || "No thumbnail";

            const textContent = await GoogleDriveHelpers.extractTextContent(drive, fileId, mimeType);

            results.push({
                _id: `drive-${fileId}`,
                name: title,
                documentType: mimeType as DocumentType,
                uri: link,
                thumbnail,
                content: textContent,
                sourceData: file,
                sourceAccountId: this.provider.getProviderId(),
                sourceApplication: this.getProviderApplicationUrl(),
                modifiedTimestamp: modifiedTime,
                insertedAt: modifiedTime,
            });
        }

        return results;
    }

    private async getDocumentText(drive: drive_v3.Drive, file: drive_v3.Schema$File): Promise<string> {
        // Implement the logic to retrieve text content based on file type (Google Docs, PDF, etc.)
        // Example: Download the file content and convert to text
        let content = "Text content extraction logic goes here";
        return content;
    }
}
