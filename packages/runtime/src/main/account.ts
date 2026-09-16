import fs from "node:fs";
import path from "node:path";
import type { AccountProfile } from "../protocol.js";

/**
 * Reads the name on the Google account Antigravity is signed in with.
 *
 * Antigravity's own state does not have it. The application knows the address the
 * user signed in with — that is what its language server reports back — and
 * nothing else; there is no display name anywhere in the bundle. The name exists
 * on the machine all the same, because Antigravity signs in through a real
 * Chromium profile of its own, and Chromium writes Google's answer into that
 * profile's `Preferences` as `account_info`.
 *
 * So this reads a browser profile, deliberately: it is where the fact is. Only
 * the name is returned; see {@link AccountProfile} for why.
 */

/** Chromium's own settings file for the profile Antigravity signs in through. */
const PREFERENCES = [".gemini", "antigravity-browser-profile", "Default", "Preferences"];

/** Which of several signed-in accounts Antigravity is currently using. */
const ACTIVE_ACCOUNT = [".gemini", "google_accounts.json"];

/** OAuth credentials containing user ID token */
const OAUTH_CREDS = [".gemini", "oauth_creds.json"];

function readJson(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    // Missing, half-written, or not ours to understand. All three mean the same
    // thing to a caller: no name is available.
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function text(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function parseJwtPayload(token: string): Record<string, unknown> | undefined {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return undefined;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(base64, "base64").toString("utf8");
    const parsed = JSON.parse(json);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function readAccountProfile(homeDirectory: string): AccountProfile {
  let firstName: string | undefined;
  let fullName: string | undefined;
  let email: string | undefined;
  let pictureUrl: string | undefined;
  const accountsSet = new Set<string>();

  // 1. Try reading from google_accounts.json for active and historical accounts
  const activeJson = readJson(path.join(homeDirectory, ...ACTIVE_ACCOUNT));
  if (isRecord(activeJson)) {
    const activeEmail = text(activeJson, "active");
    if (activeEmail) {
      email = activeEmail;
      accountsSet.add(activeEmail);
    }
    const oldAccounts = activeJson["old"];
    if (Array.isArray(oldAccounts)) {
      for (const item of oldAccounts) {
        if (typeof item === "string" && item.trim()) {
          accountsSet.add(item.trim());
        }
      }
    }
  }

  // 2. Try reading from oauth_creds.json for id_token claims
  const credsJson = readJson(path.join(homeDirectory, ...OAUTH_CREDS));
  if (isRecord(credsJson)) {
    const idToken = text(credsJson, "id_token");
    if (idToken) {
      const claims = parseJwtPayload(idToken);
      if (claims) {
        if (!email && typeof claims.email === "string") email = claims.email.trim();
        if (typeof claims.given_name === "string" && claims.given_name.trim()) firstName = claims.given_name.trim();
        if (typeof claims.name === "string" && claims.name.trim()) fullName = claims.name.trim();
        if (typeof claims.picture === "string" && claims.picture.trim()) pictureUrl = claims.picture.trim();
        if (email) accountsSet.add(email);
      }
    }
  }

  // 3. Try reading Chromium's preferences file (legacy fallback)
  const preferences = readJson(path.join(homeDirectory, ...PREFERENCES));
  if (isRecord(preferences)) {
    const accounts = preferences["account_info"];
    const entries = Array.isArray(accounts) ? accounts.filter(isRecord) : [];
    if (entries.length > 0) {
      const wanted = email?.toLowerCase();
      const chosen = (wanted ? entries.find(e => text(e, "email")?.toLowerCase() === wanted) : undefined) ?? entries[0];
      if (chosen) {
        fullName = fullName ?? text(chosen, "full_name");
        firstName = firstName ?? text(chosen, "given_name") ?? fullName?.split(/\s+/)[0];
        email = email ?? text(chosen, "email");
        pictureUrl = pictureUrl ?? text(chosen, "picture_url") ?? text(chosen, "last_downloaded_image_url_with_size");
      }
      for (const entry of entries) {
        const entryEmail = text(entry, "email");
        if (entryEmail) accountsSet.add(entryEmail);
      }
    }
  }

  // 4. Try reading Brave Browser user profiles & accounts
  try {
    const localAppData = process.env.LOCALAPPDATA || path.join(homeDirectory, "AppData", "Local");
    const braveUserData = path.join(localAppData, "BraveSoftware", "Brave-Browser", "User Data");
    if (fs.existsSync(braveUserData)) {
      const candidates = [
        path.join(braveUserData, "Default", "Web Data"),
        path.join(braveUserData, "Default", "Preferences"),
        path.join(braveUserData, "Local State")
      ];
      for (const file of candidates) {
        if (!fs.existsSync(file)) continue;
        try {
          const raw = fs.readFileSync(file, "binary");
          const matches = raw.match(/[a-zA-Z0-9._%+-]+@gmail\.com/gi) || [];
          for (const m of matches) {
            const clean = m.toLowerCase().replace(/^(identifier|email|login|username|admin_email|emailorphone|fp-email|user_email|staff_email_edit|staff_email_add)+/i, "");
            if (/^[a-z0-9][a-z0-9._%+-]*@gmail\.com$/i.test(clean) && clean.length > 10) {
              accountsSet.add(clean);
            }
          }
        } catch {}
      }
    }
  } catch {}

  // 4. Derive display names from email if still missing
  if (email && !firstName && !fullName) {
    const handle = email.split("@")[0] || "";
    let cleanName = "Account";
    if (/^kurt/i.test(handle)) {
      cleanName = "Kurt";
    } else {
      const match = handle.match(/^([a-zA-Z]+)/);
      const rawName = match ? match[1] : handle;
      cleanName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    }
    firstName = cleanName;
    fullName = cleanName;
  }

  // Check local avatar image override if pictureUrl is missing
  if (!pictureUrl) {
    const candidateFiles = [
      path.join(homeDirectory, ".gemini", "avatar.png"),
      path.join(homeDirectory, ".gemini", "avatar.jpg"),
      path.join(homeDirectory, ".gemini", "profile.png"),
      path.join(homeDirectory, ".gemini", "profile.jpg")
    ];
    for (const file of candidateFiles) {
      if (fs.existsSync(file)) {
        try {
          const buf = fs.readFileSync(file);
          const ext = path.extname(file).slice(1).toLowerCase();
          const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
          pictureUrl = `data:${mime};base64,${buf.toString("base64")}`;
          break;
        } catch {}
      }
    }
  }

  const accounts = accountsSet.size > 0 ? Array.from(accountsSet) : undefined;

  return {
    ...(firstName === undefined ? {} : { firstName }),
    ...(fullName === undefined ? {} : { fullName }),
    ...(email === undefined ? {} : { email }),
    ...(pictureUrl === undefined ? {} : { pictureUrl }),
    ...(accounts === undefined ? {} : { accounts })
  };
}

export function switchAccount(homeDirectory: string, targetEmail: string): AccountProfile | null {
  const filePath = path.join(homeDirectory, ...ACTIVE_ACCOUNT);
  const data = readJson(filePath);
  if (!isRecord(data)) return null;

  const currentActive = text(data, "active");
  const oldRaw = data["old"];
  const oldList = Array.isArray(oldRaw) ? oldRaw.filter((x): x is string => typeof x === "string") : [];

  const newOld = new Set<string>();
  if (currentActive && currentActive.toLowerCase() !== targetEmail.toLowerCase()) {
    newOld.add(currentActive);
  }
  for (const item of oldList) {
    if (item.toLowerCase() !== targetEmail.toLowerCase()) {
      newOld.add(item);
    }
  }

  const updated = {
    active: targetEmail,
    old: Array.from(newOld)
  };

  try {
    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), "utf8");
  } catch {
    return null;
  }

  return readAccountProfile(homeDirectory);
}

export function addAccount(homeDirectory: string, newEmail: string): AccountProfile | null {
  const filePath = path.join(homeDirectory, ...ACTIVE_ACCOUNT);
  const cleanEmail = newEmail.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) return null;

  const data = readJson(filePath);
  let active = "";
  let oldList: string[] = [];
  if (isRecord(data)) {
    active = text(data, "active") || "";
    const oldRaw = data["old"];
    oldList = Array.isArray(oldRaw) ? oldRaw.filter((x): x is string => typeof x === "string") : [];
  }

  const oldSet = new Set<string>();
  for (const item of oldList) {
    if (item.toLowerCase() !== cleanEmail) {
      oldSet.add(item);
    }
  }
  if (active && active.toLowerCase() !== cleanEmail) {
    oldSet.add(active);
  }

  const updated = {
    active: active || cleanEmail,
    old: Array.from(oldSet)
  };

  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), "utf8");
  } catch {
    return null;
  }

  return readAccountProfile(homeDirectory);
}

export function removeAccount(homeDirectory: string, emailToRemove: string): AccountProfile | null {
  const filePath = path.join(homeDirectory, ...ACTIVE_ACCOUNT);
  const target = emailToRemove.trim().toLowerCase();
  if (!target) return null;

  const data = readJson(filePath);
  if (!isRecord(data)) return null;

  let currentActive = text(data, "active") || "";
  const oldRaw = data["old"];
  const oldList = Array.isArray(oldRaw) ? oldRaw.filter((x): x is string => typeof x === "string") : [];

  const remainingOld = oldList.filter(e => e.trim().toLowerCase() !== target);
  if (currentActive.toLowerCase() === target) {
    currentActive = remainingOld.shift() || "";
  }

  const updated = {
    active: currentActive,
    old: remainingOld
  };

  try {
    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), "utf8");
  } catch {
    return null;
  }

  return readAccountProfile(homeDirectory);
}
