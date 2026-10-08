// Native Pro (Stock Enhancer) — Context Progress Ring Component & Core Mounting
import { CIRCUMFERENCE, MODEL_TRIGGER_SELECTOR, settings } from "../config";
import { getActiveConversationId, getActiveModelLimit, hideTooltip, showTooltip } from "../shared";
import { closeContextPopover, setupPopoverDocumentDismissal, toggleContextPopover } from "./popover";
import { ensureJumpToBottom } from "../scroll";

export { closeContextPopover, toggleContextPopover } from "./popover";

let cachedMetrics: any = null;
let lastMetricsFetch = 0;
let isFetchingMetrics = false;

export function getCachedMetrics(): any {
  return cachedMetrics;
}

export function setCachedMetrics(val: any): void {
  cachedMetrics = val;
}

export async function fetchMetrics(force = false): Promise<any> {
  const now = Date.now();
  if (!force && now - lastMetricsFetch < 2500) return cachedMetrics;
  if (isFetchingMetrics) return cachedMetrics;

  isFetchingMetrics = true;
  try {
    const session = getActiveConversationId();
    if (plugin?.account?.getContextMetrics) {
      const res = await plugin.account.getContextMetrics(session);
      if (res && typeof res.used === "number") {
        cachedMetrics = res;
        lastMetricsFetch = Date.now();
      }
    }
  } catch {} finally {
    isFetchingMetrics = false;
  }
  return cachedMetrics;
}

export function ensureContextRing(): void {
  if (!settings.enableProgressRing) {
    document.querySelectorAll(".ag-stock-ring-sibling, .ag-stock-ring-hitbox, .ag-stock-ring-separator, .ag-stock-ring-container").forEach((el) => el.remove());
    return;
  }

  const trigger = document.querySelector(MODEL_TRIGGER_SELECTOR) as HTMLElement | null;
  if (!trigger) return;

  // Fast-path: if sibling ring is already mounted right beside trigger, return immediately
  const existingRing = trigger.parentElement?.querySelector(".ag-stock-ring-sibling") as HTMLElement | null;
  if (existingRing && trigger.nextSibling === existingRing && existingRing.isConnected) {
    return;
  }

  // Clean up any legacy nested rings/separators inside trigger
  trigger.querySelectorAll(".ag-stock-ring-hitbox, .ag-stock-ring-separator, .ag-stock-ring-container").forEach((el) => el.remove());
  trigger.style.removeProperty("background-color");
  trigger.style.removeProperty("box-shadow");

  // Prevent parent wrapper from acting as a block container or wrapping onto multiple lines
  if (trigger.parentElement) {
    trigger.parentElement.style.setProperty("display", "inline-flex", "important");
    trigger.parentElement.style.setProperty("flex-direction", "row", "important");
    trigger.parentElement.style.setProperty("align-items", "center", "important");
    trigger.parentElement.style.setProperty("flex-wrap", "nowrap", "important");
    trigger.parentElement.style.setProperty("vertical-align", "middle", "important");
  }

  // Constrain trigger to hug its content tightly
  trigger.style.setProperty("display", "inline-flex", "important");
  trigger.style.setProperty("align-items", "center", "important");
  trigger.style.setProperty("flex", "0 0 auto", "important");
  trigger.style.setProperty("width", "auto", "important");
  trigger.style.setProperty("max-width", "fit-content", "important");

  // Create or reuse dedicated Sibling Context Ring (Completely independent hitbox)
  let ringSibling = trigger.parentElement?.querySelector(".ag-stock-ring-sibling") as HTMLElement | null;
  if (!ringSibling) {
    ringSibling = document.createElement("button");
    ringSibling.className = "ag-stock-ring-sibling";
    ringSibling.setAttribute("type", "button");
    ringSibling.setAttribute("role", "button");
    ringSibling.setAttribute("tabindex", "0");
    ringSibling.setAttribute("aria-label", "Context usage metrics and breakdown");

    ringSibling.innerHTML = `
      <svg class="ag-stock-ring-svg" viewBox="0 0 24 24">
        <circle class="ag-stock-ring-track" cx="12" cy="12" r="9" />
        <circle class="ag-stock-ring-progress" cx="12" cy="12" r="9" stroke-dasharray="${CIRCUMFERENCE}" stroke-dashoffset="${CIRCUMFERENCE}" />
      </svg>
    `;

    // Tooltip & Hover Isolation
    ringSibling.addEventListener("mouseenter", () => showTooltip(ringSibling!, cachedMetrics));
    ringSibling.addEventListener("mouseleave", hideTooltip);

    // Interactive Popover
    ringSibling.addEventListener("click", (e) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
      e.preventDefault();
      hideTooltip();
      toggleContextPopover(ringSibling!);
    });

    ringSibling.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.stopPropagation();
        e.stopImmediatePropagation();
        e.preventDefault();
        hideTooltip();
        toggleContextPopover(ringSibling!);
      }
    });
  }

  // Place immediately beside trigger (never wraps, never reparents trigger)
  if (trigger.nextSibling !== ringSibling) {
    if (trigger.nextSibling) {
      trigger.parentElement.insertBefore(ringSibling, trigger.nextSibling);
    } else {
      trigger.parentElement.appendChild(ringSibling);
    }
  }

  updateRingUI(ringSibling);
}

export function updateRingUI(ringWrap: HTMLElement): void {
  const metrics = cachedMetrics;
  const limit = metrics?.limit || getActiveModelLimit();
  const used = metrics?.used || 0;
  const ratio = Math.min(Math.max(used / limit, 0), 1);
  const percentage = Math.round(ratio * 100);

  const progressCircle = ringWrap.querySelector(".ag-stock-ring-progress") as HTMLElement | null;

  if (progressCircle) {
    const offset = CIRCUMFERENCE * (1 - ratio);
    progressCircle.style.strokeDashoffset = String(offset);

    progressCircle.classList.remove("risk-low", "risk-moderate", "risk-high");
    if (percentage > 85) progressCircle.classList.add("risk-high");
    else if (percentage > 70) progressCircle.classList.add("risk-moderate");
    else progressCircle.classList.add("risk-low");
  }
}

export function ensureNativeProCore(): void {
  ensureContextRing();
  ensureJumpToBottom();
}

export function setupNativeProLifecycle(): void {
  setupPopoverDocumentDismissal();
  ensureNativeProCore();

  const obs = new MutationObserver(() => {
    ensureNativeProCore();
  });

  const targetNode = document.body || document.documentElement;
  if (targetNode) {
    obs.observe(targetNode, { childList: true, subtree: true });
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      const fallbackTarget = document.body || document.documentElement;
      if (fallbackTarget) obs.observe(fallbackTarget, { childList: true, subtree: true });
      ensureNativeProCore();
    }, { once: true });
  }

  plugin.onDispose(() => {
    obs.disconnect();
  });
}
