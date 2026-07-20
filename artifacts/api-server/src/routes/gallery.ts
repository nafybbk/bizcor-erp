import { Router } from "express";
import jwt from "jsonwebtoken";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { createHash } from "crypto";
import { Readable } from "stream";
import { db } from "@workspace/db";
import { businessesTable, partiesTable, galleryImagesTable, gallerySharesTable, appSettingsTable } from "@workspace/db";
import { eq, and, inArray, desc, sql, isNull } from "drizzle-orm";
import { activatePendingPatches } from "../lib/modulePatches";

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

// Every route needs the resolved businessId — small shared helper so each
// handler stays a one-liner for this part. Gallery is a free-for-everyone
// feature for now (business decision, not a technical limitation) — the
// hasActiveModule/module_patches paywall gate below is deliberately NOT
// enforced here anymore; re-add `if (!(await hasActiveModule(...)))` when
// the future paid "order model" tier needs to gate it again. Free usage is
// still bounded by the image-count + compression limits in getGalleryFreeLimits().
async function requireGalleryBusiness(req: any, res: any): Promise<number | null> {
  const payload = verifyGalleryJwt(req.headers.authorization);
  const business = await resolveGalleryBusiness(payload, req.body?.businessCode || req.query?.businessCode);
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return null; }
  if (!business) { res.status(404).json({ error: "Business not found" }); return null; }
  try { await activatePendingPatches(business.id); } catch { /* non-critical */ }
  return business.id;
}

// Free-tier limits — configurable from the tech panel (App Settings). Applies
// to every business until a paid Gallery tier exists; see comment above.
interface GalleryFreeLimits { maxImages: number; maxQuality: number; maxKb: number }
async function getGalleryFreeLimits(): Promise<GalleryFreeLimits> {
  const rows = await db.select().from(appSettingsTable);
  const settings: Record<string, string> = {};
  for (const row of rows) settings[row.key] = row.value || "";
  const num = (key: string, def: number) => {
    const n = Number(settings[key]);
    return Number.isFinite(n) && n > 0 ? n : def;
  };
  return {
    maxImages: num("galleryFreeMaxImages", 200),
    maxQuality: num("galleryFreeMaxQuality", 40),
    maxKb: num("galleryFreeMaxKb", 200),
  };
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

// GET /gallery/module-status — lets the ERP's Gallery button know it's
// available, plus the current free-tier limits + usage so the client can
// cap compression and show a "150/200 used" style indicator. Gallery is
// free for every business right now (see requireGalleryBusiness comment).
router.get("/gallery/module-status", async (req, res) => {
  try {
    const payload = verifyGalleryJwt(req.headers.authorization);
    const business = await resolveGalleryBusiness(payload, req.query?.businessCode as string | undefined);
    if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }
    if (!business) { res.status(404).json({ error: "Business not found" }); return; }
    try { await activatePendingPatches(business.id); } catch { /* non-critical */ }
    const limits = await getGalleryFreeLimits();
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(galleryImagesTable)
      .where(and(eq(galleryImagesTable.businessId, business.id), isNull(galleryImagesTable.archivedAt)));
    res.json({ active: true, premium: true, freeLimits: limits, imageCount: Number(count) || 0 });
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
// `originalSize` (pre-compression byte count) can only come from the client,
// since the server never sees the file before it's compressed; `uploadedSize`
// is trusted from the actual buffer we received, not the client's say-so.
router.post("/gallery/upload", upload.single("image"), async (req, res) => {
  try {
    const businessId = await requireGalleryBusiness(req, res);
    if (!businessId) return;
    const file = (req as any).file as { buffer: Buffer; originalname?: string } | undefined;
    if (!file) { res.status(400).json({ error: "image file required" }); return; }

    const hash = createHash("sha256").update(file.buffer).digest("hex");
    const [existing] = await db.select().from(galleryImagesTable)
      .where(and(eq(galleryImagesTable.businessId, businessId), eq(galleryImagesTable.contentHash, hash))).limit(1);
    if (existing) { res.json(existing); return; }

    // Free-tier limits — count-cap and a hard file-size ceiling (client
    // compresses towards this too, but a modified client shouldn't be able
    // to bypass it). 15% slack over the configured KB cap for JPEG variance.
    const limits = await getGalleryFreeLimits();
    if (file.buffer.length > limits.maxKb * 1024 * 1.15) {
      res.status(400).json({ error: `Image ${limits.maxKb}KB se zyada compressed hai — free tier limit hai` });
      return;
    }
    const [{ count: currentCount }] = await db.select({ count: sql<number>`count(*)` }).from(galleryImagesTable)
      .where(and(eq(galleryImagesTable.businessId, businessId), isNull(galleryImagesTable.archivedAt)));
    if (Number(currentCount) >= limits.maxImages) {
      res.status(400).json({ error: `Free tier mein maximum ${limits.maxImages} images ki limit hai` });
      return;
    }

    const { publicId, url, thumbnailUrl } = await uploadToCloudinary(file.buffer, `${businessId}_${hash.slice(0, 16)}`);
    const originalSizeRaw = Number(req.body?.originalSize);
    const [image] = await db.insert(galleryImagesTable).values({
      businessId, contentHash: hash, cloudinaryPublicId: publicId, url, thumbnailUrl,
      name: file.originalname || null,
      originalSize: Number.isFinite(originalSizeRaw) && originalSizeRaw > 0 ? originalSizeRaw : file.buffer.length,
      uploadedSize: file.buffer.length,
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
      .where(and(eq(galleryImagesTable.businessId, businessId), isNull(galleryImagesTable.archivedAt)))
      .orderBy(desc(galleryImagesTable.uploadedAt));
    res.json(images);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /gallery/images/:id — { name } — rename
router.patch("/gallery/images/:id", async (req, res) => {
  try {
    const businessId = await requireGalleryBusiness(req, res);
    if (!businessId) return;
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) { res.status(400).json({ error: "name required" }); return; }
    const [updated] = await db.update(galleryImagesTable)
      .set({ name })
      .where(and(eq(galleryImagesTable.id, Number(req.params.id)), eq(galleryImagesTable.businessId, businessId)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Stub — there's no Order/Invoice entity linking images yet (that's a future
// phase). Once it exists, wire this to a real lookup; until then nothing is
// ever "referenced" so deletes below are always hard deletes, never archived.
async function isImageReferencedInOrders(_imageId: number): Promise<boolean> {
  return false;
}

// POST /gallery/images/delete — { imageIds: number[] }. Works for a single
// image or a whole rubber-band selection alike. An image referenced by a real
// order/invoice is archived (kept, hidden) instead of destroyed so the audit
// trail survives; everything else is actually removed from Cloudinary.
router.post("/gallery/images/delete", async (req, res) => {
  try {
    const businessId = await requireGalleryBusiness(req, res);
    if (!businessId) return;
    const { imageIds } = req.body || {};
    if (!Array.isArray(imageIds) || !imageIds.length) {
      res.status(400).json({ error: "imageIds (non-empty array) required" });
      return;
    }
    const images = await db.select().from(galleryImagesTable)
      .where(and(eq(galleryImagesTable.businessId, businessId), inArray(galleryImagesTable.id, imageIds.map(Number))));

    let deleted = 0, archived = 0;
    for (const img of images) {
      if (await isImageReferencedInOrders(img.id)) {
        await db.update(galleryImagesTable).set({ archivedAt: new Date() }).where(eq(galleryImagesTable.id, img.id));
        archived++;
      } else {
        await db.delete(gallerySharesTable).where(eq(gallerySharesTable.imageId, img.id));
        await db.delete(galleryImagesTable).where(eq(galleryImagesTable.id, img.id));
        try { await cloudinary.uploader.destroy(img.cloudinaryPublicId); } catch { /* best-effort */ }
        deleted++;
      }
    }
    res.json({ ok: true, deleted, archived });
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

// GET /gallery/customer-parties — full customer list for the share picker.
// Cloud-scoped (like every other route here): the desktop app's regular
// /parties call hits its own LOCAL server, whose party IDs have no relation
// to this cloud business's Postgres party rows — sharing with an ID from
// the wrong DB silently matches nothing. This gives the picker cloud IDs
// that /gallery/share can actually resolve.
router.get("/gallery/customer-parties", async (req, res) => {
  try {
    const businessId = await requireGalleryBusiness(req, res);
    if (!businessId) return;
    const rows = await db.select({ id: partiesTable.id, name: partiesTable.name })
      .from(partiesTable)
      .where(and(
        eq(partiesTable.businessId, businessId),
        eq(partiesTable.isActive, true),
        inArray(partiesTable.type, ["customer", "both"]),
      ))
      .orderBy(partiesTable.name);
    res.json(rows);
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
      .where(and(
        eq(gallerySharesTable.businessId, businessId),
        eq(gallerySharesTable.partyId, partyId),
        isNull(galleryImagesTable.archivedAt),
      ))
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
