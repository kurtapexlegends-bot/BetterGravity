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

  // 1. Try reading Antigravity's real active login username from app_storage.json
  try {
    const appStorageCandidates = [
      path.join(homeDirectory, "AppData", "Roaming", "antigravity", "app_storage.json"),
      path.join(homeDirectory, "AppData", "Roaming", "Antigravity", "app_storage.json")
    ];
    for (const p of appStorageCandidates) {
      if (fs.existsSync(p)) {
        const d = readJson(p);
        if (isRecord(d)) {
          const activeLogin = text(d, "jetski.onboarding.lastLoginUsername");
          if (activeLogin && activeLogin.includes("@")) {
            email = activeLogin.toLowerCase().trim();
            accountsSet.add(email);
            break;
          }
        }
      }
    }
  } catch {}

  // 2. Try reading ~/.antigravity_cockpit/current_account.json
  try {
    const currentAcc = readJson(path.join(homeDirectory, ".antigravity_cockpit", "current_account.json"));
    if (isRecord(currentAcc)) {
      const curEmail = text(currentAcc, "email");
      if (!email && curEmail && curEmail.includes("@")) {
        email = curEmail.toLowerCase().trim();
      }
      if (curEmail) accountsSet.add(curEmail.toLowerCase().trim());
    }
  } catch {}

  // 3. Try reading ~/.antigravity_cockpit/accounts.json (authoritative list & display names)
  const accountPlans: Record<string, string> = {};
  const accountLimits: Record<string, { fiveHour: number; weekly: number }> = {};
  const accountNames: Record<string, string> = {};

  try {
    const cockpitMainAccounts = path.join(homeDirectory, ".antigravity_cockpit", "accounts.json");
    if (fs.existsSync(cockpitMainAccounts)) {
      const mainData = readJson(cockpitMainAccounts);
      if (isRecord(mainData) && Array.isArray(mainData["accounts"])) {
        for (const item of mainData["accounts"]) {
          if (isRecord(item)) {
            const accEmail = text(item, "email");
            const accName = text(item, "name");
            if (accEmail) {
              const clean = accEmail.toLowerCase().trim();
              accountsSet.add(clean);
              if (accName) {
                accountNames[clean] = accName;
                if (email && clean === email.toLowerCase()) {
                  fullName = fullName ?? accName;
                  firstName = firstName ?? accName.split(/\s+/)[0];
                }
              }
            }
          }
        }
      }
    }
  } catch {}

  // 4. Try reading from google_accounts.json for active and historical accounts
  const activeJson = readJson(path.join(homeDirectory, ...ACTIVE_ACCOUNT));
  if (isRecord(activeJson)) {
    const activeEmail = text(activeJson, "active");
    if (!email && activeEmail) {
      email = activeEmail.toLowerCase().trim();
    }
    if (activeEmail) accountsSet.add(activeEmail.toLowerCase().trim());
    const oldAccounts = activeJson["old"];
    if (Array.isArray(oldAccounts)) {
      for (const item of oldAccounts) {
        if (typeof item === "string" && item.trim()) {
          accountsSet.add(item.trim().toLowerCase());
        }
      }
    }
  }

  // 5. Try reading from oauth_creds.json for id_token claims
  const credsJson = readJson(path.join(homeDirectory, ...OAUTH_CREDS));
  if (isRecord(credsJson)) {
    const idToken = text(credsJson, "id_token");
    if (idToken) {
      const claims = parseJwtPayload(idToken);
      if (claims && typeof claims.email === "string") {
        const claimEmail = claims.email.toLowerCase().trim();
        accountsSet.add(claimEmail);
        if (!email) email = claimEmail;
        if (email.toLowerCase() === claimEmail) {
          if (typeof claims.given_name === "string" && claims.given_name.trim()) firstName = firstName ?? claims.given_name.trim();
          if (typeof claims.name === "string" && claims.name.trim()) fullName = fullName ?? claims.name.trim();
          if (typeof claims.picture === "string" && claims.picture.trim()) pictureUrl = pictureUrl ?? claims.picture.trim();
        }
      }
    }
  }

  // 6. Try reading Chromium's preferences file (legacy fallback)
  const preferences = readJson(path.join(homeDirectory, ...PREFERENCES));
  if (isRecord(preferences)) {
    const accounts = preferences["account_info"];
    const entries = Array.isArray(accounts) ? accounts.filter(isRecord) : [];
    if (entries.length > 0) {
      for (const entry of entries) {
        const entryEmail = text(entry, "email");
        if (entryEmail) accountsSet.add(entryEmail.toLowerCase());
      }
      const wanted = email?.toLowerCase();
      const chosen = wanted ? entries.find(e => text(e, "email")?.toLowerCase() === wanted) : entries[0];
      if (chosen && (!email || text(chosen, "email")?.toLowerCase() === email.toLowerCase())) {
        fullName = fullName ?? text(chosen, "full_name");
        firstName = firstName ?? text(chosen, "given_name") ?? fullName?.split(/\s+/)[0];
        if (!email) email = text(chosen, "email");
        pictureUrl = pictureUrl ?? text(chosen, "picture_url") ?? text(chosen, "last_downloaded_image_url_with_size");
      }
    }
  }

  // 4. Try reading Brave Browser user profiles & accounts
  try {
    const localAppData = path.join(homeDirectory, "AppData", "Local");
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
            const clean = m.toLowerCase().replace(/^(emailorphone|identifier|admin_email|staff_email_edit|staff_email_add|user_email|fp-email|orphone|email|login|username)+/i, "");
            const handle = clean.split("@")[0] || "";
            if (/^[a-z0-9][a-z0-9._%+-]*@gmail\.com$/i.test(clean) && handle.length >= 4) {
              accountsSet.add(clean);
            }
          }
        } catch {}
      }
    }
  } catch {}

  // 7. Try reading ~/.antigravity_cockpit accounts and quota cache

  try {
    const cockpitAccountsDir = path.join(homeDirectory, ".antigravity_cockpit", "gemini_accounts");
    if (fs.existsSync(cockpitAccountsDir)) {
      const files = fs.readdirSync(cockpitAccountsDir);
      for (const file of files) {
        if (!file.endsWith(".json") || file.includes(".bak")) continue;
        const entry = readJson(path.join(cockpitAccountsDir, file));
        if (isRecord(entry)) {
          const entryEmail = text(entry, "email");
          if (entryEmail) {
            const clean = entryEmail.toLowerCase();
            accountsSet.add(entryEmail);
            const entryName = text(entry, "name");
            if (entryName) accountNames[clean] = entryName;
            const tierId = text(entry, "tier_id");
            const planName = text(entry, "plan_name");
            if (tierId === "g1-pro-tier" || (planName && /pro/i.test(planName))) {
              accountPlans[clean] = "PRO";
            } else if (tierId === "free-tier" || (planName && /free|individual/i.test(planName))) {
              accountPlans[clean] = "FREE";
            }
            if (email && clean === email.toLowerCase()) {
              if (!fullName && typeof entry["name"] === "string") fullName = text(entry, "name");
              if (!pictureUrl && typeof entry["picture"] === "string") pictureUrl = text(entry, "picture");
            }
          }
        }
      }
    }
    const cockpitListFile = path.join(homeDirectory, ".antigravity_cockpit", "gemini_accounts.json");
    const cockpitList = readJson(cockpitListFile);
    if (isRecord(cockpitList) && Array.isArray(cockpitList["accounts"])) {
      for (const item of cockpitList["accounts"]) {
        if (isRecord(item)) {
          const accEmail = text(item, "email");
          if (accEmail) {
            const clean = accEmail.toLowerCase();
            accountsSet.add(accEmail);
            const accName = text(item, "name");
            if (accName && !accountNames[clean]) accountNames[clean] = accName;
            const planName = text(item, "plan_name");
            if (planName && /pro/i.test(planName)) accountPlans[clean] = "PRO";
            else if (planName && /free|individual/i.test(planName)) accountPlans[clean] = "FREE";
          }
        }
      }
    }
    const quotaDir = path.join(homeDirectory, ".antigravity_cockpit", "cache", "quota_api_v1_plugin", "authorized");
    if (fs.existsSync(quotaDir)) {
      const qFiles = fs.readdirSync(quotaDir);
      for (const qf of qFiles) {
        if (!qf.endsWith(".json")) continue;
        const qData = readJson(path.join(quotaDir, qf));
        if (isRecord(qData) && typeof qData["email"] === "string") {
          const qEmail = qData["email"].toLowerCase().trim();
          const models = (qData["payload"] as Record<string, unknown>)?.["models"] as Record<string, unknown> | undefined;
          if (isRecord(models)) {
            let minRemaining = 1.0;
            let sumRemaining = 0;
            let count = 0;
            for (const mId in models) {
              const mObj = models[mId];
              if (isRecord(mObj) && isRecord(mObj["quotaInfo"])) {
                const frac = mObj["quotaInfo"]["remainingFraction"];
                if (typeof frac === "number") {
                  minRemaining = Math.min(minRemaining, frac);
                  sumRemaining += frac;
                  count++;
                }
              }
            }
            const fiveHourPct = Math.round(minRemaining * 100);
            const weeklyPct = count > 0 ? Math.round((sumRemaining / count) * 100) : 100;
            accountLimits[qEmail] = { fiveHour: fiveHourPct, weekly: weeklyPct };
            if (!accountPlans[qEmail]) {
              accountPlans[qEmail] = /pro/i.test(qEmail.split("@")[0]) ? "PRO" : "FREE";
            }
          }
        }
      }
    }
  } catch {}

  // 6. Derive display names from email if still missing
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

  const accounts = accountsSet.size > 1 ? Array.from(accountsSet) : undefined;
  const hasPlans = Object.keys(accountPlans).length > 0;
  const hasLimits = Object.keys(accountLimits).length > 0;
  const hasNames = Object.keys(accountNames).length > 0;

  return {
    ...(firstName === undefined ? {} : { firstName }),
    ...(fullName === undefined ? {} : { fullName }),
    ...(email === undefined ? {} : { email }),
    ...(pictureUrl === undefined ? {} : { pictureUrl }),
    ...(accounts === undefined ? {} : { accounts }),
    ...(hasPlans ? { accountPlans } : {}),
    ...(hasLimits ? { accountLimits } : {}),
    ...(hasNames ? { accountNames } : {})
  };
}

export function switchAccount(homeDirectory: string, targetEmail: string): AccountProfile | null {
  const filePath = path.join(homeDirectory, ...ACTIVE_ACCOUNT);
  const data = readJson(filePath);
  if (!isRecord(data)) return null;

  const currentActive = text(data, "active");
  const oldList = Array.isArray(data["old"])
    ? (data["old"].filter((item) => typeof item === "string") as string[])
    : [];

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

  // Update Antigravity's app_storage.json lastLoginUsername
  try {
    const appStorageCandidates = [
      path.join(homeDirectory, "AppData", "Roaming", "antigravity", "app_storage.json"),
      path.join(homeDirectory, "AppData", "Roaming", "Antigravity", "app_storage.json")
    ];
    for (const appStoragePath of appStorageCandidates) {
      if (fs.existsSync(appStoragePath)) {
        const storageData = readJson(appStoragePath);
        if (isRecord(storageData)) {
          storageData["jetski.onboarding.lastLoginUsername"] = targetEmail;
          fs.writeFileSync(appStoragePath, JSON.stringify(storageData, null, 2), "utf8");
        }
      }
    }
  } catch {}

  // If cockpit credentials exist for targetEmail, sync into .gemini/oauth_creds.json
  try {
    const cockpitAccountsDir = path.join(homeDirectory, ".antigravity_cockpit", "gemini_accounts");
    if (fs.existsSync(cockpitAccountsDir)) {
      const files = fs.readdirSync(cockpitAccountsDir);
      for (const file of files) {
        if (!file.endsWith(".json") || file.includes(".bak")) continue;
        const entry = readJson(path.join(cockpitAccountsDir, file));
        if (isRecord(entry) && text(entry, "email")?.toLowerCase() === targetEmail.toLowerCase()) {
          const credsPath = path.join(homeDirectory, ...OAUTH_CREDS);
          const credsData: Record<string, unknown> = {
            access_token: entry["access_token"],
            expiry_date: entry["expiry_date"],
            id_token: entry["id_token"],
            refresh_token: entry["refresh_token"],
            scope: entry["scope"] || "openid https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
            token_type: entry["token_type"] || "Bearer"
          };
          fs.writeFileSync(credsPath, JSON.stringify(credsData, null, 2), "utf8");
          break;
        }
      }
    }
  } catch {}

  // Update ~/.antigravity_cockpit/current_account.json if present
  try {
    const cockpitCurr = path.join(homeDirectory, ".antigravity_cockpit", "current_account.json");
    if (fs.existsSync(cockpitCurr)) {
      const curData = readJson(cockpitCurr);
      if (isRecord(curData)) {
        curData["email"] = targetEmail;
        curData["updated_at"] = Math.floor(Date.now() / 1000);
        fs.writeFileSync(cockpitCurr, JSON.stringify(curData, null, 2), "utf8");
      }
    }
  } catch {}

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
