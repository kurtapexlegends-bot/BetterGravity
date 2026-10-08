// Native Pro (Stock Enhancer) — Shared Utilities & Runtime Adapters
import { CONVERSATION_VIEW_SELECTOR, MODEL_LIMITS, MODEL_TRIGGER_SELECTOR, settings } from "./config";

export * from "./audio";
export * from "./fork";

/* ── DOM & Portal Positioning Helpers ────────────────────────────────────────── */
export function escapeHtml(str: any): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function positionFloatingElement(element: HTMLElement, anchor: HTMLElement, offset = 8): void {
  const rect = anchor.getBoundingClientRect();
  const elemRect = element.getBoundingClientRect();
  let left = rect.left + rect.width / 2 - elemRect.width / 2;
  let top = rect.top - elemRect.height - offset;

  // Horizontal viewport clamping
  if (left < 10) left = 10;
  if (left + elemRect.width > window.innerWidth - 10) {
    left = window.innerWidth - elemRect.width - 10;
  }
  // If top runs offscreen, flip below
  if (top < 10) {
    top = rect.bottom + offset;
  }

  element.style.position = "fixed";
  element.style.left = `${Math.round(left)}px`;
  element.style.top = `${Math.round(top)}px`;
  element.style.zIndex = "999999";
}

let activeTooltip: HTMLElement | null = null;

export function showTooltip(anchor: HTMLElement, metrics?: { used?: number; limit?: number } | null): void {
  hideTooltip();
  const limit = metrics?.limit || getActiveModelLimit();
  const used = metrics?.used || 0;
  const percentage = Math.round(Math.min(Math.max(used / limit, 0), 1) * 100);
  const remaining = Math.max(0, limit - used);

  const tip = document.createElement("div");
  tip.className = "ag-stock-floating-tooltip";
  tip.textContent = `${percentage}% context used • ~${formatTokens(remaining)} left`;
  document.body.appendChild(tip);

  positionFloatingElement(tip, anchor, 8);
  activeTooltip = tip;
}

export function hideTooltip(): void {
  if (activeTooltip) {
    activeTooltip.remove();
    activeTooltip = null;
  }
}

export function applyInstantBootup(): void {
  if (settings.instantBootup) {
    // 1. Remove splash screen immediately on instant bootup
    const splash = document.getElementById("splash") || document.querySelector(".splash-screen, [data-splash]");
    if (splash) {
      splash.remove();
    }

    const style = document.createElement("style");
    style.id = "ag-instant-bootup-patch";
    style.textContent = `
      #splash, .splash-screen, [data-splash] { display: none !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; }
    `;
    document.head.appendChild(style);

    // 2. Remove legacy toast elements if present
    for (const el of document.querySelectorAll(".ag-convo-toast-stack, .ag-convo-toast")) {
      el.remove();
    }
  }

  if (settings.startMaximized) {
    try {
      if (typeof window.__betterGravityBridge?.windowMaximize === "function") {
        window.__betterGravityBridge.windowMaximize();
      } else if (typeof window.resizeTo === "function" && window.screen) {
        const availW = window.screen.availWidth;
        const availH = window.screen.availHeight;
        if (window.outerWidth < availW || window.outerHeight < availH) {
          window.moveTo(0, 0);
          window.resizeTo(availW, availH);
        }
      }
    } catch {}
  }
}

/* ── Token Formatting & Calculation ─────────────────────────────────────────── */
export function formatTokens(n: number | string): string {
  const num = Number(n) || 0;
  if (num >= 1000000) {
    const m = (num / 1000000).toFixed(1);
    return `${m.endsWith(".0") ? m.slice(0, -2) : m}M`;
  }
  if (num >= 1000) {
    const k = (num / 1000).toFixed(1);
    return `${k.endsWith(".0") ? k.slice(0, -2) : k}k`;
  }
  return String(num);
}

export function getActiveModelLimit(): number {
  const trigger = document.querySelector(MODEL_TRIGGER_SELECTOR) as HTMLElement | null;
  const text = (trigger?.innerText || "").toLowerCase();
  for (const [key, limit] of Object.entries(MODEL_LIMITS)) {
    if (text.includes(key.toLowerCase())) return limit;
  }
  return 1000000; // Default: 1M token ceiling
}

export function getActiveConversationId(): string {
  const view = document.querySelector(CONVERSATION_VIEW_SELECTOR);
  const id = view?.getAttribute("data-cascade-id") || "";
  if (id) return id;
  const match = typeof window !== "undefined" && window.location?.pathname ? window.location.pathname.match(/\/c\/([a-zA-Z0-9_-]+)/i) : null;
  return match ? match[1] : "";
}

/* ── React Fiber & Store Inspection Helpers ─────────────────────────────────── */
export function getFiber(node: any): any {
  if (!node) return null;
  const keys = Object.keys(node);
  const key = keys.find((k) => k.startsWith("__reactFiber") || k.startsWith("__reactInternalInstance"));
  return key ? node[key] : null;
}

export function findAgentService(): any {
  const anchors = [
    document.querySelector(CONVERSATION_VIEW_SELECTOR),
    document.querySelector(MODEL_TRIGGER_SELECTOR),
    document.body.firstElementChild,
    document.body
  ].filter(Boolean);

  for (const anchor of anchors) {
    let fiber = getFiber(anchor);
    for (let i = 0; fiber && i < 30; i++, fiber = fiber.return) {
      const candidates = [
        fiber.memoizedProps?.agentService,
        fiber.memoizedProps?.service,
        fiber.memoizedProps?.agent,
        fiber.memoizedProps?.controller?.agentService,
        fiber.memoizedProps?.value?.agentService
      ];
      for (const c of candidates) {
        if (c && typeof c.forkConversation === "function") return c;
      }
    }
  }
  return null;
}

export function findStore(): any {
  const anchors = [
    document.querySelector(CONVERSATION_VIEW_SELECTOR),
    document.querySelector(MODEL_TRIGGER_SELECTOR),
    document.body.firstElementChild,
    document.body
  ].filter(Boolean);

  for (const anchor of anchors) {
    let fiber = getFiber(anchor);
    for (let i = 0; fiber && i < 25; i++, fiber = fiber.return) {
      const store = fiber.memoizedProps?.store;
      if (store && typeof store.getState === "function") return store;
      const dependencies = fiber.dependencies;
      for (let dep = dependencies?.firstContext; dep; dep = dep.next) {
        const depStore = dep.memoizedValue?.store;
        if (depStore && typeof depStore.getState === "function") return depStore;
      }
    }
  }
  return null;
}

export function findRouter(): any {
  const anchors = [
    document.body.firstElementChild,
    document.body
  ].filter(Boolean);

  for (const anchor of anchors) {
    let fiber = getFiber(anchor);
    for (let i = 0; fiber && i < 20; i++, fiber = fiber.return) {
      const value = fiber.memoizedProps?.value;
      if (value?.navigator && typeof value.navigator.push === "function") return value.navigator;
      if (typeof value?.navigate === "function") return value;
      if (typeof fiber.memoizedProps?.navigate === "function") return fiber.memoizedProps;
    }
  }
  return null;
}

export async function navigateToConversation(cascadeId: string, projectId?: string): Promise<boolean> {
  const router = findRouter();
  if (router) {
    try {
      if (typeof router.navigate === "function") {
        router.navigate({
          pathname: `/c/${encodeURIComponent(cascadeId)}`,
          search: (previous: any) => {
            const search = { ...previous };
            if (projectId) search.section = projectId;
            return search;
          }
        });
        return true;
      }
    } catch {}
  }

  const rowLink = document.querySelector(
    `[data-testid="conversation-row-sidebar"][data-cascade-id="${CSS.escape(cascadeId)}"] a, ` +
    `[data-cascade-id="${CSS.escape(cascadeId)}"] a, ` +
    `a[href*="/c/${CSS.escape(cascadeId)}"]`
  ) as HTMLElement | null;

  if (rowLink) {
    rowLink.click();
    return true;
  }

  const url = `/c/${encodeURIComponent(cascadeId)}${projectId ? `?section=${encodeURIComponent(projectId)}` : ""}`;
  window.history.pushState(null, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
  return true;
}

export function getConversationTitle(cascadeId: string): string {
  if (!cascadeId) return "Current Conversation";

  // 1. Redux store trajectory summaries
  try {
    const store = findStore();
    const summary = store?.getState()?.trajectorySummaries?.summaries?.[cascadeId];
    if (summary?.summary) return summary.summary.trim();
    if (summary?.title) return summary.title.trim();
  } catch {}

  // 2. Sidebar active row
  try {
    const row = document.querySelector(`[data-cascade-id="${CSS.escape(cascadeId)}"]`);
    const label =
      row?.querySelector("a[aria-label]")?.getAttribute("aria-label") ||
      row?.querySelector("span.truncate")?.textContent?.trim() ||
      row?.querySelector(".truncate")?.textContent?.trim();
    if (label && !label.includes(cascadeId)) return label;
  } catch {}

  // 3. Main header / breadcrumb title
  try {
    const headerTitle =
      document.querySelector('[data-testid="conversation-title"]')?.textContent?.trim() ||
      document.querySelector('.conversation-title')?.textContent?.trim() ||
      document.querySelector('header [class*="truncate"]')?.textContent?.trim();
    if (headerTitle && !headerTitle.includes(cascadeId)) return headerTitle;
  } catch {}

  // 4. Document title
  try {
    if (document.title && !document.title.toLowerCase().startsWith("antigravity")) {
      const clean = document.title.split(" - ")[0].trim();
      if (clean) return clean;
    }
  } catch {}

  return "Current Conversation";
}

/* ── Antigravity Language Server Client Trajectory Summaries ─────────────────── */
let cachedLsClient: any = null;
let lastLsClientPollTime = 0;
let cachedBackendSummaries: any = null;

export function resetLsClientPollTime(): void {
  lastLsClientPollTime = 0;
}

export function getAntigravityLsClient(): any {
  if (cachedLsClient) return cachedLsClient;
  try {
    const anchors = [
      document.querySelector('[data-testid="conversation-row-sidebar"]'),
      document.querySelector('[data-testid="agent-input-box"]'),
      document.querySelector(CONVERSATION_VIEW_SELECTOR),
      document.body.firstElementChild,
      document.body
    ].filter(Boolean);

    for (const el of anchors) {
      const key = Object.keys(el).find((k) => k.startsWith("__reactFiber"));
      if (!key) continue;
      let f = (el as any)[key];
      while (f) {
        const client = f.memoizedProps?.syncedState?.sidebarSectionsProvider?.projectManagementFeature?.lsClient;
        if (client && typeof client.getAllCascadeTrajectories === "function") {
          cachedLsClient = client;
          return cachedLsClient;
        }
        f = f.return;
      }
    }

    // Fallback
    const candidates = document.querySelectorAll('[data-testid], [class*="sidebar"]');
    for (let i = 0; i < candidates.length; i++) {
      const el = candidates[i];
      const key = Object.keys(el).find((k) => k.startsWith("__reactFiber"));
      if (!key) continue;
      let f = (el as any)[key];
      while (f) {
        const client = f.memoizedProps?.syncedState?.sidebarSectionsProvider?.projectManagementFeature?.lsClient;
        if (client && typeof client.getAllCascadeTrajectories === "function") {
          cachedLsClient = client;
          return cachedLsClient;
        }
        f = f.return;
      }
    }
  } catch {}
  return null;
}

export async function refreshBackendSummaries(): Promise<void> {
  const client = getAntigravityLsClient();
  if (!client) return;
  const now = Date.now();
  if (now - lastLsClientPollTime < 1800) return;
  lastLsClientPollTime = now;
  try {
    const res = await client.getAllCascadeTrajectories({});
    if (res?.trajectorySummaries && typeof res.trajectorySummaries === "object") {
      cachedBackendSummaries = res.trajectorySummaries;
    }
  } catch {}
}
