import { pgTable, serial, text, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const supportMessageStatusEnum = pgEnum("support_message_status", ["new", "read", "replied"]);
export const supportMessageSenderEnum = pgEnum("support_message_sender", ["user", "admin"]);

export const supportMessagesTable = pgTable("support_messages", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  senderType: supportMessageSenderEnum("sender_type").notNull().default("user"),
  name: text("name"),
  phone: text("phone"),
  email: text("email"),
  message: text("message").notNull(),
  status: supportMessageStatusEnum("status").notNull().default("new"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
