import { Router } from "express";
import jwt from "jsonwebtoken";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { createHash } from "crypto";
import { Readable } from "stream";
import { db } from "@workspace/db";
import { businessesTable, partiesTable, galleryImagesTable, gallerySharesTable } from "@workspace/db";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import { hasActiveModule, activatePendingPatches } from "../lib/modulePatches";

// BizCor Gallery — supplier-side management (upload, share, per-party view).
// Cloud-only, same reasoning as the mini-app tables: images must be reachable
// from a customer's phone from anywhere, so a LAN/desktop business's Gallery
// window talks to this API directly over the internet, never through its own
// local server. That means this router can't rely on requireBusiness (which
// only trusts req.user.businessId — correct for a pure-cloud session, wrong
// for a LAN session whose local businessId has no relation to the cloud id).
// Mirrors the same JWT/businessCode resolution built for lan-sync.

const router = Router();
const JWT_SECRET = process.env.SESSION_SECRET || "erp-secret-key";
const LAN_DESKTOP_SECRET = "BizCorDesktop2025!SecretKey#LAN";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const CLOUDINARY_FOLDER = "bizcor-gallery";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per image
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE } });

interface GalleryJwtPayload {
  id?: number;
  businessId?: number;
  businessCode?: string;
  role?: string;
}

function verifyGalleryJwt(authHeader: string | undefined): GalleryJwtPayload | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  for (const secret of [JWT_SECRET, LAN_DESKTOP_SECRET]) {
    try { return jwt.verify(token, secret) as GalleryJwtPayload; } catch { /* try next secret */ }
  }
  return null;
}

async function resolveGalleryBusiness(payload: GalleryJwtPayload | null, bodyBusinessCode?: string): Promise<{ id: number } | null> {
  if (!payload) return null;
  const code = bodyBusinessCode || payload.businessCode;
  if (code) {
    const [business] = await db.select({ id: businessesTable.id })
      .from(businessesTable).where(eq(businessesTable.businessCode, code.toUpperCase())).limit(1);
    return business || null;
  }
  if (payload.businessId) {
    const [business] = await db.select({ id: businessesTable.id })
      .from(businessesTable).where(eq(businessesTable.id, payload.businessId)).limit(1);
    return business || null;
  }
  return null;
}

// Every route needs the resolved businessId + the gallery module gate —
// small shared helper so each handler stays a one-liner for this part.
async function requireGalleryBusiness(req: any, res: any): Promise<number | null> {
  const payload = verifyGalleryJwt(req.headers.authorization);
  const business = await resolveGalleryBusiness(payload, req.body?.businessCode || req.query?.businessCode);
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return null; }
  if (!business) { res.status(404).json({ error: "Business not found" }); return null; }
  try { await activatePendingPatches(business.id); } catch { /* non-critical */ }
  if (!(await hasActiveModule(business.id, "gallery"))) {
    res.status(403).json({ error: "Gallery abhi is business ke liye available nahi hai" });
    return null;
  }
  return business.id;
}

function uploadToCloudinary(buffer: Buffer, publicIdSeed: string): Promise<{ publicId: string; url: string; thumbnailUrl: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: CLOUDINARY_FOLDER, resource_type: "image", public_id: publicIdSeed, use_filename: false, unique_filename: false },
      (err, result) => {
        if (err || !result) return reject(err || new Error("Cloudinary upload failed"));
        const thumbnailUrl = result.secure_url.replace("/upload/", "/upload/c_fill,w_300,h_300,q_auto/");
        resolve({ publicId: result.public_id, url: result.secure_url, thumbnailUrl });
      }
    );
    Readable.from(buffer).pipe(stream);
  });
}

// GET /gallery/module-status — lets the ERP's Gallery button know whether to
// show "Coming Soon" or the real thing, without erroring when it's inactive
// (unlike the other routes here, which 403 — this one IS the status check).
router.get("/gallery/module-status", async (req, res) => {
  try {
    const payload = verifyGalleryJwt(req.headers.authorization);
    const business = await resolveGalleryBusiness(payload, req.query?.businessCode as string | undefined);
    if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }
    if (!business) { res.status(404).json({ error: "Business not found" }); return; }
    try { await activatePendingPatches(business.id); } catch { /* non-critical */ }
    const active = await hasActiveModule(business.id, "gallery");
    res.json({ active });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /gallery/check-hash — ask before uploading; lets the client skip
// re-sending bytes for an image the business already has in its gallery.
router.post("/gallery/check-hash", async (req, res) => {
  try {
    const businessId = await requireGalleryBusiness(req, res);
    if (!businessId) return;
    const { hash } = req.body || {};
    if (!hash) { res.status(400).json({ error: "hash required" }); return; }
    const [existing] = await db.select().from(galleryImagesTable)
      .where(and(eq(galleryImagesTable.businessId, businessId), eq(galleryImagesTable.contentHash, hash))).limit(1);
    res.json({ exists: !!existing, image: existing || null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /gallery/upload — multipart image + businessCode field. Dedupes by
// content hash server-side too (defensive — check-hash is only advisory).
router.post("/gallery/upload", upload.single("image"), async (req, res) => {
  try {
    const businessId = await requireGalleryBusiness(req, res);
    if (!businessId) return;
    const file = (req as any).file as { buffer: Buffer } | undefined;
    if (!file) { res.status(400).json({ error: "image file required" }); return; }

    const hash = createHash("sha256").update(file.buffer).digest("hex");
    const [existing] = await db.select().from(galleryImagesTable)
      .where(and(eq(galleryImagesTable.businessId, businessId), eq(galleryImagesTable.contentHash, hash))).limit(1);
    if (existing) { res.json(existing); return; }

    const { publicId, url, thumbnailUrl } = await uploadToCloudinary(file.buffer, `${businessId}_${hash.slice(0, 16)}`);
    const [image] = await db.insert(galleryImagesTable).values({
      businessId, contentHash: hash, cloudinaryPublicId: publicId, url, thumbnailUrl,
    }).returning();
    res.status(201).json(image);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /gallery/images — the business's common gallery pool
router.get("/gallery/images", async (req, res) => {
  try {
    const businessId = await requireGalleryBusiness(req, res);
    if (!businessId) return;
    const images = await db.select().from(galleryImagesTable)
      .where(eq(galleryImagesTable.businessId, businessId))
      .orderBy(desc(galleryImagesTable.uploadedAt));
    res.json(images);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /gallery/share — { imageIds: number[], partyIds: number[] }
router.post("/gallery/share", async (req, res) => {
  try {
    const businessId = await requireGalleryBusiness(req, res);
    if (!businessId) return;
    const { imageIds, partyIds } = req.body || {};
    if (!Array.isArray(imageIds) || !imageIds.length || !Array.isArray(partyIds) || !partyIds.length) {
      res.status(400).json({ error: "imageIds and partyIds (non-empty arrays) required" });
      return;
    }

    // Scope check — every image/party must actually belong to this business
    const images = await db.select({ id: galleryImagesTable.id }).from(galleryImagesTable)
      .where(and(eq(galleryImagesTable.businessId, businessId), inArray(galleryImagesTable.id, imageIds.map(Number))));
    const parties = await db.select({ id: partiesTable.id }).from(partiesTable)
      .where(and(eq(partiesTable.businessId, businessId), inArray(partiesTable.id, partyIds.map(Number))));

    let created = 0;
    for (const img of images) {
      for (const party of parties) {
        const [existing] = await db.select({ id: gallerySharesTable.id }).from(gallerySharesTable)
          .where(and(eq(gallerySharesTable.imageId, img.id), eq(gallerySharesTable.partyId, party.id))).limit(1);
        if (existing) continue;
        await db.insert(gallerySharesTable).values({ imageId: img.id, businessId, partyId: party.id });
        created++;
      }
    }
    res.json({ ok: true, sharesCreated: created });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /gallery/parties — per-party folders (only parties with >=1 share)
router.get("/gallery/parties", async (req, res) => {
  try {
    const businessId = await requireGalleryBusiness(req, res);
    if (!businessId) return;
    const rows = await db.select({
      partyId: gallerySharesTable.partyId,
      partyName: partiesTable.name,
      imageCount: sql<number>`count(*)`,
      lastSharedAt: sql<string>`max(${gallerySharesTable.sharedAt})`,
      unseenCount: sql<number>`count(*) filter (where ${gallerySharesTable.viewedAt} is null)`,
    }).from(gallerySharesTable)
      .innerJoin(partiesTable, eq(gallerySharesTable.partyId, partiesTable.id))
      .where(eq(gallerySharesTable.businessId, businessId))
      .groupBy(gallerySharesTable.partyId, partiesTable.name)
      .orderBy(desc(sql`max(${gallerySharesTable.sharedAt})`));
    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /gallery/parties/:partyId/images — a specific party's folder, with ticks
router.get("/gallery/parties/:partyId/images", async (req, res) => {
  try {
    const businessId = await requireGalleryBusiness(req, res);
    if (!businessId) return;
    const partyId = Number(req.params.partyId);
    const rows = await db.select({
      shareId: gallerySharesTable.id,
      imageId: galleryImagesTable.id,
      url: galleryImagesTable.url,
      thumbnailUrl: galleryImagesTable.thumbnailUrl,
      sharedAt: gallerySharesTable.sharedAt,
      deliveredAt: gallerySharesTable.deliveredAt,
      viewedAt: gallerySharesTable.viewedAt,
    }).from(gallerySharesTable)
      .innerJoin(galleryImagesTable, eq(gallerySharesTable.imageId, galleryImagesTable.id))
      .where(and(eq(gallerySharesTable.businessId, businessId), eq(gallerySharesTable.partyId, partyId)))
      .orderBy(desc(gallerySharesTable.sharedAt));
    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /gallery/shares/:id — unshare a single image from a party
router.delete("/gallery/shares/:id", async (req, res) => {
  try {
    const businessId = await requireGalleryBusiness(req, res);
    if (!businessId) return;
    const [deleted] = await db.delete(gallerySharesTable)
      .where(and(eq(gallerySharesTable.id, Number(req.params.id)), eq(gallerySharesTable.businessId, businessId)))
      .returning();
    if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
