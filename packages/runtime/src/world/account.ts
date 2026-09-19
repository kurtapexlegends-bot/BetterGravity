/**
 * `plugin.account`, the signed-in user's name and nothing else.
 *
 * The page cannot read files, and the name is not in Antigravity's own state — it
 * is in the Chromium profile Antigravity signs into Google through — so the main
 * process reads it and this relays the answer.
 *
 * One read per page, shared by every plugin: a plugin that greets the user asks
 * on every visit to the home screen, and Google's record does not change between
 * them. A read that fails is not remembered, so a profile that is being rewritten
 * as the page loads is asked again rather than held wrong for the session.
 */

import type { AccountProfile, PluginAccount } from "@bettergravity/plugin-api";
import { resolveBridge } from "./bridge.js";

const NO_NAME: AccountProfile = {};

let pending: Promise<AccountProfile> | undefined;

export function createAccountTools(): PluginAccount {
  return {
    read: (forceRefresh = false) => {
      if (!forceRefresh && pending) return pending;

      const bridge = resolveBridge();
      if (!bridge) return Promise.resolve(NO_NAME);

      pending = bridge.readAccount().then(
        (profile) => profile ?? NO_NAME,
        () => {
          pending = undefined;
          return NO_NAME;
        }
      );
      return pending;
    },
    switchAccount: async (email: string) => {
      pending = undefined;
      const bridge = resolveBridge();
      if (!bridge?.switchAccount) return null;
      try {
        const profile = await bridge.switchAccount(email);
        if (profile) pending = Promise.resolve(profile);
        return profile;
      } catch {
        return null;
      }
    },
    addAccount: async (email: string) => {
      pending = undefined;
      const bridge = resolveBridge();
      if (!bridge?.addAccount) return null;
      try {
        const profile = await bridge.addAccount(email);
        if (profile) pending = Promise.resolve(profile);
        return profile;
      } catch {
        return null;
      }
    },
    removeAccount: async (email: string) => {
      pending = undefined;
      const bridge = resolveBridge();
      if (!bridge?.removeAccount) return null;
      try {
        const profile = await bridge.removeAccount(email);
        if (profile) pending = Promise.resolve(profile);
        return profile;
      } catch {
        return null;
      }
    },
    getContextMetrics: async (conversationId?: string) => {
      const bridge = resolveBridge();
      if (!bridge?.getContextMetrics) return null;
      try {
        return await bridge.getContextMetrics(conversationId);
      } catch {
        return null;
      }
    },
    compactContext: async (conversationId?: string) => {
      const bridge = resolveBridge();
      if (!bridge?.compactContext) return null;
      try {
        return await bridge.compactContext(conversationId);
      } catch {
        return null;
      }
    }
  };
}
