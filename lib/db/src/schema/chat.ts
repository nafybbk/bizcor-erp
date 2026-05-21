import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { businessesTable } from "./businesses";
import { usersTable } from "./users";

export const chatMessagesTable = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businessesTable.id),
  fromUserId: integer("from_user_id").notNull().references(() => usersTable.id),
  fromUserName: text("from_user_name").notNull(),
  message: text("message"),
  filePath: text("file_path"),
  fileName: text("file_name"),
  fileMimeType: text("file_mime_type"),
  fileSize: integer("file_size"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
