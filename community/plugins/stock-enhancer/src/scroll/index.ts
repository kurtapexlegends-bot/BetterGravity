// Native Pro (Stock Enhancer) — Streaming Scroll De-jitter & Navigation Pill
import { CONVERSATION_VIEW_SELECTOR, settings } from "../config";
import { getActiveConversationId } from "../shared";
import { ensureNativeProCore, fetchMetrics, setCachedMetrics, updateRingUI } from "../context-ring";

/* ── Jump-to-Bottom Quick-Nav Pill ───────────────────────────────────────── */
export function ensureJumpToBottom(): void {
  if (!settings.enableJumpToBottom) {
    document.querySelectorAll(".ag-stock-jump-button").forEach((el) => el.remove());
    return;
  }

  const view = document.querySelector(CONVERSATION_VIEW_SELECTOR) as (HTMLElement & { __agStockJumpAttached?: boolean }) | null;
  if (!view) return;

  let jumpBtn = view.querySelector(".ag-stock-jump-button") as HTMLElement | null;
  if (jumpBtn && jumpBtn.isConnected) {
    return;
  }

  if (!jumpBtn) {
    jumpBtn = document.createElement("button");
    jumpBtn.className = "ag-stock-jump-button";
    jumpBtn.setAttribute("type", "button");
    jumpBtn.setAttribute("aria-label", "Jump to latest response");
    jumpBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <polyline points="19 12 12 19 5 12"></polyline>
      </svg>
      <span>Jump to latest</span>
    `;

    jumpBtn.addEventListener("click", () => {
      view.scrollTo({ top: view.scrollHeight, behavior: "smooth" });
    });

    view.appendChild(jumpBtn);
  }

  // Idempotent scroll listener attached once per conversation view
  if (!view.__agStockJumpAttached) {
    view.__agStockJumpAttached = true;
    const onScroll = () => {
      const btn = view.querySelector(".ag-stock-jump-button");
      if (!btn) return;
      const distanceToBottom = view.scrollHeight - view.scrollTop - view.clientHeight;
      if (distanceToBottom > 160) {
        btn.classList.add("visible");
      } else {
        btn.classList.remove("visible");
      }
    };

    view.addEventListener("scroll", onScroll, { passive: true });
    plugin.onDispose(() => {
      view.removeEventListener("scroll", onScroll);
      delete view.__agStockJumpAttached;
    });
  }
}

/* ── Native Streaming & Scroll Integrity ─────────────────────────────────── */
export function setupScrollDejitter(): void {
  // Let Antigravity's native scroller manage streaming token progression directly.
  // Avoids MutationObserver layout thrashing and background requestAnimationFrame freezing.
}

/* ── Instant Conversation Switching (Bounded LRU Cache) ─────────────────── */
const recentScrollCache = new Map<string, number>(); // cascadeId -> scrollTop
let lastActiveCascadeId = "";

export function checkConversationSwitch(): void {
  if (document.hidden) return;
  const currentId = getActiveConversationId();
  if (!currentId) return;

  if (currentId !== lastActiveCascadeId) {
    const view = document.querySelector(CONVERSATION_VIEW_SELECTOR) as HTMLElement | null;
    if (lastActiveCascadeId && view) {
      recentScrollCache.set(lastActiveCascadeId, view.scrollTop);
      if (recentScrollCache.size > 3) {
        const oldestKey = recentScrollCache.keys().next().value;
        if (oldestKey) recentScrollCache.delete(oldestKey);
      }
    }

    lastActiveCascadeId = currentId;
    setCachedMetrics(null);
    ensureNativeProCore();

    // Restore scroll if in recent cache
    if (view && recentScrollCache.has(currentId)) {
      const targetScroll = recentScrollCache.get(currentId)!;
      requestAnimationFrame(() => {
        if (view.isConnected) view.scrollTop = targetScroll;
      });
    }

    // Refresh metrics on switch
    fetchMetrics(true).then(() => {
      const ring = document.querySelector(".ag-stock-ring-sibling") as HTMLElement | null;
      if (ring) updateRingUI(ring);
    });
  }
}

export function setupInstantChatSwitching(): void {
  checkConversationSwitch();
}
