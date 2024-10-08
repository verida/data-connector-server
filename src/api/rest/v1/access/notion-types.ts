export type NotionTitleDatabaseProperty = {
  type: "title";
  title: {
    plain_text: string;
  }[];
};

export type NotionRichTextDatabaseProperty = {
  type: "rich_text";
  rich_text: {
    plain_text: string;
  }[];
};

export type NotionCheckboxDatabaseProperty = {
  type: "checkbox";
  checkbox: boolean;
};

export type NotionNumberDatabaseProperty = {
  type: "number";
  number: number;
};

export type NotionUrlDatabaseProperty = {
  type: "url";
  url: string;
};

export type NotionDatabaseProperty =
  | NotionTitleDatabaseProperty
  | NotionRichTextDatabaseProperty
  | NotionCheckboxDatabaseProperty
  | NotionNumberDatabaseProperty
  | NotionUrlDatabaseProperty;
