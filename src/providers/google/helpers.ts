import { gmail_v1, drive_v3 } from "googleapis";
import pdf from "pdf-parse";

export class GmailHelpers {
  static async getMessage(
    gmail: gmail_v1.Gmail,
    messageId: string
  ): Promise<gmail_v1.Schema$Message> {
    try {
      const res = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
      });
      return res.data;
    } catch (error) {
      console.error("Error getting message:", error);
      throw error;
    }
  }

  static getTextContent(
    payload: gmail_v1.Schema$MessagePart | undefined
  ): string {
    if (!payload) return "";

    let text = "";
    if (!payload.parts) {
      // If there are no parts, it means the payload is simple and can be accessed directly
      text = Buffer.from(payload.body?.data || "", "base64").toString("utf8");
    } else {
      // Recursively search for the plain text part
      for (const part of payload.parts) {
        if (part.mimeType === "text/plain") {
          text = Buffer.from(part.body?.data || "", "base64").toString("utf8");
        } else if (part.mimeType === "multipart/alternative") {
          text = this.getTextContent(part);
        }
      }
    }
    return text;
  }

  static getHtmlContent(
    payload: gmail_v1.Schema$MessagePart | undefined
  ): string {
    if (!payload) return "";

    let html = "";
    if (!payload.parts) {
      // If there are no parts, it means the payload is simple and can be accessed directly
      html = Buffer.from(payload.body?.data || "", "base64").toString("utf8");
    } else {
      // Recursively search for the HTML part
      for (const part of payload.parts) {
        if (part.mimeType === "text/html") {
          html = Buffer.from(part.body?.data || "", "base64").toString("utf8");
        } else if (part.mimeType === "multipart/alternative") {
          html = this.getHtmlContent(part);
        }
      }
    }
    return html;
  }

  static async getAttachment(
    gmail: gmail_v1.Gmail,
    messageId: string,
    attachmentId: string
  ): Promise<gmail_v1.Schema$MessagePartBody> {
    try {
      const res = await gmail.users.messages.attachments.get({
        userId: "me",
        messageId: messageId,
        id: attachmentId,
      });
      return res.data;
    } catch (error) {
      console.error("Error getting attachment:", error);
      throw error;
    }
  }

  static async getAttachments(
    gmail: gmail_v1.Gmail,
    message: gmail_v1.Schema$Message
  ): Promise<{ filename: string; id: string; textContent: string }[]> {
    const attachments: {
      filename: string;
      id: string;
      textContent: string;
    }[] = [];

    async function processParts(
      parts: gmail_v1.Schema$MessagePart[] | undefined
    ) {
      if (!parts) return;

      for (const part of parts) {
        if (part.filename && part.body && part.body.attachmentId) {
          const attachment = await GmailHelpers.getAttachment(
            gmail,
            message.id || "",
            part.body.attachmentId
          );

          // @todo: convert .txt, .pdf to text
          let textContent = "";
          if (part.filename.endsWith(".pdf")) {
            textContent = await GmailHelpers.parsePdfAttachment(
              attachment.data
            );
          }

          attachments.push({
            filename: part.filename,
            id: part.body.attachmentId,
            textContent,
            // data: attachment.data,
          });
        }

        if (part.parts) {
          await processParts(part.parts);
        }
      }
    }

    await processParts(message.payload?.parts);

    return attachments;
  }

  static async parsePdfAttachment(base64Data: string): Promise<string> {
    try {
      const pdfBuffer = Buffer.from(base64Data, "base64");
      const pdfData = await pdf(pdfBuffer);
      return pdfData.text;
    } catch (error) {
      console.error("Error parsing PDF:", error);
      return "";
    }
  }

  static getHeader(
    headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
    name: string
  ): string {
    if (!headers) return "";
    const header = headers.find(
      (h) => h.name?.toLowerCase() === name.toLowerCase()
    );
    return header?.value || "";
  }

  static parseEmail(emailHeader: string): {
    name: string;
    email: string;
  } {
    if (!emailHeader) {
      return { name: "", email: "" };
    }
    const emailRegex = /^(.*?)(?: <(.*?)>)?$/;
    const match = emailHeader.match(emailRegex);
    if (match) {
      return {
        name: match[1].trim(),
        email: match[2] || "",
      };
    }
    return { name: "", email: "" };
  }
}

export class GoogleDriveHelpers {
  
  static async getFile(
    drive: drive_v3.Drive,
    fileId: string
  ): Promise<drive_v3.Schema$File> {
    try {
      const res = await drive.files.get({
        fileId: fileId,
        fields: 'id, name, mimeType, webViewLink, createdTime, modifiedTime, thumbnailLink'
      });
      return res.data;
    } catch (error) {
      console.error("Error getting file:", error);
      throw error;
    }
  }

  static async downloadFile(
    drive: drive_v3.Drive,
    fileId: string
  ): Promise<Buffer> {
    try {
      const res = await drive.files.get(
        { fileId: fileId, alt: 'media' },
        { responseType: 'arraybuffer' }
      );
      return Buffer.from(res.data as ArrayBuffer);
    } catch (error) {
      console.error("Error downloading file:", error);
      throw error;
    }
  }

  static async extractTextContent(
    drive: drive_v3.Drive,
    fileId: string,
    mimeType: string
  ): Promise<string> {
    let textContent = '';

    if (mimeType === 'application/pdf') {
      const fileBuffer = await this.downloadFile(drive, fileId);
      textContent = await this.parsePdf(fileBuffer);
    } else if (mimeType === 'application/vnd.google-apps.document') {
      textContent = await this.extractGoogleDocsText(drive, fileId);
    } else if (mimeType === 'text/plain') {
      const fileBuffer = await this.downloadFile(drive, fileId);
      textContent = fileBuffer.toString('utf8');
    }
    
    // Add more MIME types as needed (e.g., spreadsheets, presentations, etc.)

    return textContent;
  }

  static async extractGoogleDocsText(
    drive: drive_v3.Drive,
    fileId: string
  ): Promise<string> {
    try {
      const res = await drive.files.export(
        { fileId: fileId, mimeType: 'text/plain' },
        { responseType: 'arraybuffer' }
      );
      return Buffer.from(res.data as ArrayBuffer).toString('utf8');
    } catch (error) {
      console.error("Error extracting text from Google Docs:", error);
      return "";
    }
  }

  static async parsePdf(pdfBuffer: Buffer): Promise<string> {
    try {
      const pdfData = await pdf(pdfBuffer);
      return pdfData.text;
    } catch (error) {
      console.error("Error parsing PDF:", error);
      return "";
    }
  }

  static getFileMetadata(
    file: drive_v3.Schema$File
  ): {
    id: string;
    name: string;
    mimeType: string;
    webViewLink: string;
    modifiedTime: string;
    thumbnailLink?: string;
  } {
    return {
      id: file.id || '',
      name: file.name || 'Untitled',
      mimeType: file.mimeType || 'Unknown',
      webViewLink: file.webViewLink || '',
      modifiedTime: file.modifiedTime || '',
      thumbnailLink: file.thumbnailLink,
    };
  }
}

