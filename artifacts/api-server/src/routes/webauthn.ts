import { Router } from "express";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/types";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireSuperAdmin } from "../middlewares/auth";

const router = Router();

const challenges = new Map<string, { challenge: string; expires: number }>();

function getRpInfo(req: any): { rpID: string; origin: string } {
  const originHeader = (req.headers["origin"] as string) || "";
  const hostHeader = (req.headers["host"] as string) || "erp.naewtgroup.com";
  const origin = originHeader || `https://${hostHeader}`;
  let rpID: string;
  try {
    rpID = new URL(origin).hostname;
  } catch {
    rpID = "erp.naewtgroup.com";
  }
  return { rpID, origin };
}

async function ensureTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS webauthn_credentials (
      id SERIAL PRIMARY KEY,
      credential_id TEXT NOT NULL UNIQUE,
      public_key TEXT NOT NULL,
      counter INTEGER NOT NULL DEFAULT 0,
      super_admin_id INTEGER NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
}

// ── Register options (logged-in super admin) ──────────────────────────────────

router.post("/register-options", requireSuperAdmin, async (req, res) => {
  try {
    await ensureTable();
    const adminId = req.user!.id;
    const { rpID, origin } = getRpInfo(req);

    const existing = await db.execute(
      sql`SELECT credential_id FROM webauthn_credentials WHERE super_admin_id = ${adminId}`
    );

    const options = await generateRegistrationOptions({
      rpName: "BizCor ERP",
      rpID,
      userID: new TextEncoder().encode(String(adminId)),
      userName: req.user!.email || req.user!.name || "admin",
      userDisplayName: req.user!.name || "Admin",
      attestationType: "none",
      excludeCredentials: (existing.rows as any[]).map((c) => ({
        id: c.credential_id as string,
        transports: ["internal", "hybrid"] as AuthenticatorTransportFuture[],
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
        authenticatorAttachment: "platform",
      },
    });

    challenges.set(`reg_${adminId}`, {
      challenge: options.challenge,
      expires: Date.now() + 5 * 60 * 1000,
    });
    res.json(options);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ── Register verify ───────────────────────────────────────────────────────────

router.post("/register-verify", requireSuperAdmin, async (req, res) => {
  try {
    await ensureTable();
    const adminId = req.user!.id;
    const { rpID, origin } = getRpInfo(req);
    const stored = challenges.get(`reg_${adminId}`);

    if (!stored || stored.expires < Date.now()) {
      res.status(400).json({ error: "Challenge expire ho gaya, dobara try karo" });
      return;
    }
    challenges.delete(`reg_${adminId}`);

    const verification = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge: stored.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      res.status(400).json({ error: "Fingerprint verify nahi ho saka" });
      return;
    }

    const { credential } = verification.registrationInfo;
    const credId = Buffer.from(credential.id).toString("base64url");
    const pubKey = Buffer.from(credential.publicKey).toString("base64url");

    await db.execute(sql`
      INSERT INTO webauthn_credentials (credential_id, public_key, counter, super_admin_id)
      VALUES (${credId}, ${pubKey}, ${credential.counter}, ${adminId})
      ON CONFLICT (credential_id) DO UPDATE SET counter = EXCLUDED.counter
    `);

    res.json({ success: true, message: "Fingerprint register ho gaya!" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ── Auth options (public — for login page) ────────────────────────────────────

router.post("/auth-options", async (req, res) => {
  try {
    await ensureTable();
    const { rpID } = getRpInfo(req);

    const allCreds = await db.execute(
      sql`SELECT credential_id FROM webauthn_credentials`
    );

    if ((allCreds.rows as any[]).length === 0) {
      res.status(404).json({ error: "Koi fingerprint register nahi hai" });
      return;
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: (allCreds.rows as any[]).map((c) => ({
        id: c.credential_id as string,
        transports: ["internal", "hybrid"] as AuthenticatorTransportFuture[],
      })),
      userVerification: "required",
    });

    challenges.set("auth_global", {
      challenge: options.challenge,
      expires: Date.now() + 5 * 60 * 1000,
    });
    res.json(options);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ── Auth verify → returns password list ──────────────────────────────────────

router.post("/auth-verify", async (req, res) => {
  try {
    await ensureTable();
    const { rpID, origin } = getRpInfo(req);
    const stored = challenges.get("auth_global");

    if (!stored || stored.expires < Date.now()) {
      res.status(400).json({ error: "Challenge expire ho gaya, dobara try karo" });
      return;
    }

    const credId = req.body.id as string;
    const credRow = await db.execute(
      sql`SELECT * FROM webauthn_credentials WHERE credential_id = ${credId} LIMIT 1`
    );

    if (!credRow.rows.length) {
      res.status(404).json({ error: "Credential nahi mila" });
      return;
    }

    const cred = credRow.rows[0] as any;

    const verification = await verifyAuthenticationResponse({
      response: req.body,
      expectedChallenge: stored.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: cred.credential_id as string,
        publicKey: Buffer.from(cred.public_key as string, "base64url"),
        counter: cred.counter as number,
        transports: ["internal", "hybrid"] as AuthenticatorTransportFuture[],
      },
    });

    if (!verification.verified) {
      res.status(401).json({ error: "Fingerprint verify nahi ho saka" });
      return;
    }

    challenges.delete("auth_global");

    await db.execute(sql`
      UPDATE webauthn_credentials SET counter = ${verification.authenticationInfo.newCounter}
      WHERE credential_id = ${credId}
    `);

    const superAdmins = await db.execute(sql`
      SELECT id, name, email, phone, plain_password
      FROM super_admins WHERE is_active = true ORDER BY id
    `);

    const users = await db.execute(sql`
      SELECT u.id, u.name, u.email, u.role, u.is_active,
             b.name AS business_name, b.business_code, u.plain_password
      FROM users u
      LEFT JOIN businesses b ON b.id = u.business_id
      ORDER BY b.name, u.name
    `);

    res.json({
      success: true,
      superAdmins: superAdmins.rows,
      users: users.rows,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
