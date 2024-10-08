import { NotionError } from "./notion-error";
import { NotionDatabaseProperty } from "./notion-types";

export function getValueFromNotionCheckboxProperty(
  property: NotionDatabaseProperty
): boolean {
  if (property.type !== "checkbox") {
    throw new NotionError(undefined, "Invalid property type");
  }
  return property.checkbox;
}

export function getValueFromNotionNumberProperty(
  property: NotionDatabaseProperty
): number | null {
  if (property.type !== "number") {
    throw new NotionError(undefined, "Invalid property type");
  }
  return property.number ?? null;
}

export function getValueFromNotionRichTextProperty(
  property: NotionDatabaseProperty
): string | null {
  if (property.type !== "rich_text") {
    throw new NotionError(undefined, "Invalid property type");
  }

  if (property.rich_text.length === 0) {
    return null;
  }

  return property.rich_text[0].plain_text;
}

export function getValueFromNotionTitleProperty(
  property: NotionDatabaseProperty
): string {
  if (property.type !== "title") {
    throw new NotionError(undefined, "Invalid property type");
  }

  if (property.title.length === 0) {
    return "";
  }

  return property.title[0].plain_text;
}

export function getValueFromNotionUrlProperty(
  property: NotionDatabaseProperty
): string | null {
  if (property.type !== "url") {
    throw new NotionError(undefined, "Invalid property type");
  }
  return property.url || null;
}
