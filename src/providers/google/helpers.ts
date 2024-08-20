import { drive_v3, gmail_v1, google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import pdf from "pdf-parse";
import { DocumentType } from "../../schemas";

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
        fields: 'id, name, mimeType, size, webViewLink, createdTime, modifiedTime, thumbnailLink'
      });
      return res.data;
    } catch (error) {
      console.error("Error getting file:", error);
      throw error;
    }
  }

  static async getFileSize(
    drive: drive_v3.Drive,
    fileId: string
  ): Promise<number | undefined> {
    const file = await this.getFile(drive, fileId);

    if (file.size) {
      // For non-Google docs (like PDF, image)
      return parseInt(file.size);
    } else if (file.mimeType && file.mimeType.startsWith("application/vnd.google-apps.")) {
      // For Google Docs, export the file as plain text to estimate size
      const exportedFile = await drive.files.export(
        { fileId: fileId, mimeType: "text/plain" }, 
        { responseType: "arraybuffer" }
      );
      return Buffer.byteLength(exportedFile.data as ArrayBuffer);
    } else {
      return undefined;
    }
  }

  static async extractIndexableText(
    drive: drive_v3.Drive,
    fileId: string,
    mimeType: string,
    auth: OAuth2Client
  ): Promise<string> {
    let textContent = '';
  
    // 5MB limit (5 * 1024 * 1024)
    const sizeLimit = 5 * 1024 * 1024;
    const fileSize = await this.getFileSize(drive, fileId);
  
    if (fileSize !== undefined && fileSize <= sizeLimit) {
      if (mimeType === 'application/pdf') {
        const fileBuffer = await this.downloadFile(drive, fileId);
        textContent = await this.parsePdf(fileBuffer);
      } else if (mimeType === 'application/vnd.google-apps.document') {
        textContent = await this.extractGoogleDocsText(drive, fileId);
      } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
        textContent = await this.extractGoogleSheetsText(fileId, auth);
      } else if (mimeType === 'application/vnd.google-apps.presentation') {
        textContent = await this.extractGoogleSlidesText(fileId, auth);
      } else if (mimeType === 'text/plain') {
        const fileBuffer = await this.downloadFile(drive, fileId);
        textContent = fileBuffer.toString('utf8');
      } else if (mimeType === 'application/msword' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const fileBuffer = await this.downloadFile(drive, fileId);
        textContent = await this.parseDocx(fileBuffer);
      } else if (mimeType === 'application/vnd.ms-excel' || mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        const fileBuffer = await this.downloadFile(drive, fileId);
        textContent = await this.parseXlsx(fileBuffer);
      } else if (mimeType === 'application/vnd.ms-powerpoint' || mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
        const fileBuffer = await this.downloadFile(drive, fileId);
        textContent = await this.parsePptx(fileBuffer);
      }
    } else {
      console.warn('File size exceeds the limit or unsupported file type.');
    }
  
    return textContent;
  }
  
  static async parseDocx(docxBuffer: Buffer): Promise<string> {
    const mammoth = require('mammoth');
    try {
      const result = await mammoth.extractRawText({ buffer: docxBuffer });
      return result.value;
    } catch (error) {
      console.error("Error parsing DOCX file:", error);
      return "";
    }
  }
  
  static async parseXlsx(xlsxBuffer: Buffer): Promise<string> {
    const XLSX = require('xlsx');
    try {
      const workbook = XLSX.read(xlsxBuffer, { type: 'buffer' });
      const text = workbook.SheetNames.map((sheetName: string) => {
        const sheet = workbook.Sheets[sheetName];
        return XLSX.utils.sheet_to_csv(sheet);
      }).join('\n');
      return text;
    } catch (error) {
      console.error("Error parsing XLSX file:", error);
      return "";
    }
  }
  
  static async parsePptx(pptxBuffer: Buffer): Promise<string> {
    const PptxParser = require('pptx-parser');
    try {
      const result = await PptxParser(pptxBuffer);
      return result.text;
    } catch (error) {
      console.error("Error parsing PPTX file:", error);
      return "";
    }
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

  static async extractGoogleSheetsText(
    fileId: string,
    auth: OAuth2Client
  ): Promise<string> {
    try {
      const sheets = google.sheets({ version: 'v4', auth: auth });
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: fileId,
        range: 'A1:Z1000'  // You can adjust the range as needed
      });
      return res.data.values?.map(row => row.join('\t')).join('\n') || '';
    } catch (error) {
      console.error("Error extracting text from Google Sheets:", error);
      return "";
    }
  }

  static async extractGoogleSlidesText(
    fileId: string,
    auth: OAuth2Client
  ): Promise<string> {
    try {

      const slides = google.slides({ version: 'v1', auth: auth });
      const res = await slides.presentations.get({
        presentationId: fileId,
      });
      const slidesContent = res.data.slides || [];
      return slidesContent.map(slide =>
        slide.pageElements?.map(element =>
          element.shape?.text?.textElements?.map(te => te.textRun?.content).join('')
        ).join('\n')
      ).join('\n');
    } catch (error) {
      console.error("Error extracting text from Google Slides:", error);
      return "";
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

  static getDocumentTypeFromMimeType(mimeType: string): DocumentType {
    switch (mimeType) {
        case 'text/plain':
            return DocumentType.TXT;
        case 'application/pdf':
            return DocumentType.PDF;
        case 'application/msword':
            return DocumentType.DOC;
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
            return DocumentType.DOCX;
        case 'application/vnd.ms-excel':
            return DocumentType.XLS;
        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
            return DocumentType.XLSX;
        case 'application/vnd.ms-powerpoint':
            return DocumentType.PPT;
        case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
            return DocumentType.PPTX;
        default:
            return DocumentType.OTHER;
    }
  }
}
