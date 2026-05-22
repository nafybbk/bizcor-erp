import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const NOW = sql`(datetime('now'))`;

export const chatMessagesTable = sqliteTable("chat_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id").notNull(),
  fromUserId: integer("from_user_id").notNull(),
  fromUserName: text("from_user_name").notNull(),
  message: text("message"),
  filePath: text("file_path"),
  fileName: text("file_name"),
  fileMimeType: text("file_mime_type"),
  fileSize: integer("file_size"),
  createdAt: text("created_at").notNull().default(NOW),
});
