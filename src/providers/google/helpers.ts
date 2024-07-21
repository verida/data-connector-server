import { gmail_v1 } from "googleapis";
import pdf from 'pdf-parse';

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
    console.log('getAttachments()')
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
          let textContent = ''
          if (part.filename.endsWith('.pdf')) {
            textContent = await GmailHelpers.parsePdfAttachment(attachment.data);
          }

          console.log('adding', part.filename)
          attachments.push({
            filename: part.filename,
            id: part.body.attachmentId,
            textContent
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
        const pdfBuffer = Buffer.from(base64Data, 'base64');
        const pdfData = await pdf(pdfBuffer);
        return pdfData.text;
    } catch (error) {
        console.error('Error parsing PDF:', error);
        return '';
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
