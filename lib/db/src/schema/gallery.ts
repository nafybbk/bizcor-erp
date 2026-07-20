import { pgTable, serial, text, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { businessesTable } from "./businesses";
import { partiesTable } from "./masters";

// BizCor Gallery — cloud-only, same rationale as the mini-app tables: images
// must be reachable from the customer's phone from anywhere, so even a LAN/
// desktop business's Gallery window talks to this API directly over the
// internet rather than through its own local server.

// One physical image per (business, content hash) — re-uploading identical
// bytes (e.g. the same photo re-shared or forwarded down a chain in a later
// phase) must never create a second Cloudinary asset, only a new share record.
export const galleryImagesTable = pgTable("gallery_images", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businessesTable.id),
  contentHash: text("content_hash").notNull(),
  cloudinaryPublicId: text("cloudinary_public_id").notNull(),
  url: text("url").notNull(),
  thumbnailUrl: text("thumbnail_url").notNull(),
  name: text("name"),
  originalSize: integer("original_size"),
  uploadedSize: integer("uploaded_size"),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  // Soft-delete: an image tied to a real order/invoice (future feature) gets
  // archived instead of hard-deleted so the audit trail survives; everything
  // else is actually removed. Null = active/visible everywhere.
  archivedAt: timestamp("archived_at"),
}, (t) => [
  uniqueIndex("gallery_images_biz_hash_idx").on(t.businessId, t.contentHash),
]);

// A share is a reference, not a copy — links one image to one party. The
// three nullable timestamps are the WhatsApp-style tick trail: sharedAt only
// (single tick) -> deliveredAt set once the customer's app has fetched the
// thumbnail (double tick) -> viewedAt set once they've pulled the full image
// (blue tick). Also doubles as the data future Connect-analytics work needs.
export const gallerySharesTable = pgTable("gallery_shares", {
  id: serial("id").primaryKey(),
  imageId: integer("image_id").notNull().references(() => galleryImagesTable.id),
  businessId: integer("business_id").notNull().references(() => businessesTable.id),
  partyId: integer("party_id").notNull().references(() => partiesTable.id),
  sharedAt: timestamp("shared_at").notNull().defaultNow(),
  deliveredAt: timestamp("delivered_at"),
  viewedAt: timestamp("viewed_at"),
}, (t) => [
  uniqueIndex("gallery_shares_image_party_idx").on(t.imageId, t.partyId),
]);

export type GalleryImage = typeof galleryImagesTable.$inferSelect;
export type GalleryShare = typeof gallerySharesTable.$inferSelect;
