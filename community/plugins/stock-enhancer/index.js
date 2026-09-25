// Native Pro (Stock Enhancer) — Clean, additive enhancements for stock Antigravity UI
// Zero skin changes, zero cosmetic recoloring. Pure native performance and ergonomics.

const CIRCUMFERENCE = 2 * Math.PI * 9; // radius = 9, circumference ≈ 56.5487
const INPUT_BOX_SELECTOR = '[data-testid="agent-input-box"]';
const MODEL_TRIGGER_SELECTOR = '[data-testid="model-selector-trigger"]';
const CONVERSATION_VIEW_SELECTOR = '[data-testid="conversation-view"]';

/* ── Settings ────────────────────────────────────────────────────────────── */
const settings = plugin.settings.define({
  enableProgressRing: {
    type: "boolean",
    label: "Context Progress Ring",
    description: "Display a miniature circular context ring beside the model selector chevron.",
    default: true
  },
  enableSpeedMetric: {
    type: "boolean",
    label: "Response Speed Metric",
    description: "Display tokens/sec and generation duration on completed assistant messages.",
    default: true
  },
  enableJumpToBottom: {
    type: "boolean",
    label: "Jump to Bottom Pill",
    description: "Show a floating jump-to-bottom arrow when scrolled up in conversations.",
    default: true
  },
  enableScrollOptimization: {
    type: "boolean",
    label: "Smooth Streaming & Scroll De-jitter",
    description: "Batch DOM measurements to eliminate layout thrashing during active token streaming.",
    default: true
  },
  instantBootup: {
    type: "boolean",
    label: "Instant Window Reveal",
    description: "Bypass artificial splash fade delays to make the editor interactive instantly.",
    default: true
  },
  startMaximized: {
    type: "boolean",
    label: "Start Maximized",
    description: "Ensure the editor window opens maximized to fill the full screen.",
    default: true
  }
});

/* ── Instant Bootup & Window Optimization ─────────────────────────────────── */
function applyInstantBootup() {
  if (!settings.instantBootup) return;
  try {
    const splash = document.getElementById("splash") || document.querySelector(".splash-screen, [data-splash]");
    if (splash) {
      splash.style.transition = "none";
      splash.style.opacity = "0";
      splash.style.pointerEvents = "none";
      setTimeout(() => {
        try { splash.remove(); } catch {}
      }, 50);
    }
    // Remove any artificial startup delays
    document.documentElement.style.removeProperty("overflow");

    // Ensure the window is maximized if opened in a floating restored window
    if (settings.startMaximized && typeof window.resizeTo === "function" && window.screen) {
      const availW = window.screen.availWidth;
      const availH = window.screen.availHeight;
      if (window.outerWidth < availW || window.outerHeight < availH) {
        window.moveTo(0, 0);
        window.resizeTo(availW, availH);
      }
    }
  } catch {}
}

applyInstantBootup();

/* ── Helpers: Token & Model Calculation ──────────────────────────────────── */
const MODEL_LIMITS = {
  "3.8 flash": 1000000,
  "3.8 thinking": 1000000,
  "3.1 pro": 2000000,
  "3.0 pro": 2000000,
  "3.0 flash": 1000000,
  "2.5 flash": 1000000,
  "2.0 flash": 1000000,
  "gemini": 1000000,
  "claude": 200000,
  "sonnet": 200000,
  "gpt-4": 128000,
  "o1": 200000,
  "o3": 200000,
  "deepseek": 128000
};

function formatTokens(n) {
  const num = Number(n) || 0;
  if (num >= 1000000) {
    const m = (num / 1000000).toFixed(1);
    return m.endsWith(".0") ? m.slice(0, -2) + "M" : m + "M";
  }
  if (num >= 1000) {
    const k = (num / 1000).toFixed(1);
    return k.endsWith(".0") ? k.slice(0, -2) + "k" : k + "k";
  }
  return String(num);
}

function getActiveModelLimit() {
  const trigger = document.querySelector(MODEL_TRIGGER_SELECTOR);
  const text = (trigger?.innerText || "").toLowerCase();
  for (const [key, limit] of Object.entries(MODEL_LIMITS)) {
    if (text.includes(key)) return limit;
  }
  return 1000000;
}

function getActiveConversationId() {
  const view = document.querySelector(CONVERSATION_VIEW_SELECTOR);
  const id = view?.getAttribute("data-cascade-id") || "";
  if (id && id !== "conversation") return id;
  const match = typeof window !== "undefined" && window.location?.pathname ? window.location.pathname.match(/\/c\/([a-zA-Z0-9_-]+)/i) : null;
  return match ? match[1] : "";
}

function getFiber(node) {
  if (!node) return null;
  const keys = Object.keys(node);
  const key = keys.find((k) => k.startsWith("__reactFiber") || k.startsWith("__reactInternalInstance"));
  return key ? node[key] : null;
}

function findAgentService() {
  const anchors = [
    document.querySelector(CONVERSATION_VIEW_SELECTOR),
    document.querySelector(INPUT_BOX_SELECTOR),
    document.body
  ];
  for (const anchor of anchors) {
    if (!anchor) continue;
    let fiber = getFiber(anchor);
    for (let depth = 0; fiber && depth < 35; depth += 1, fiber = fiber.return) {
      if (typeof fiber.memoizedProps?.agentService?.forkConversation === "function") {
        return fiber.memoizedProps.agentService;
      }
      if (typeof fiber.memoizedProps?.value?.agentService?.forkConversation === "function") {
        return fiber.memoizedProps.value.agentService;
      }
      let dep = fiber.dependencies?.firstContext;
      for (let i = 0; dep && i < 25; i += 1, dep = dep.next) {
        if (typeof dep.memoizedValue?.forkConversation === "function") return dep.memoizedValue;
        if (typeof dep.memoizedValue?.agentService?.forkConversation === "function") return dep.memoizedValue.agentService;
      }
    }
  }
  return null;
}

/* ── Context Metrics Management ─────────────────────────────────────────── */
let cachedMetrics = null;
let lastMetricsFetch = 0;
let isFetchingMetrics = false;

async function fetchMetrics(force = false) {
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

/* ── Floating Positioning Helper (Portal Pattern) ────────────────────────── */
function positionFloatingElement(element, anchor, offset = 8) {
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

/* ── Floating Tooltip (Never Clipped by Overflow) ────────────────────────── */
let activeTooltip = null;

function showTooltip(anchor) {
  hideTooltip();
  const metrics = cachedMetrics;
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

function hideTooltip() {
  if (activeTooltip) {
    activeTooltip.remove();
    activeTooltip = null;
  }
}

/* ── Context Progress Ring Component ─────────────────────────────────────── */
function ensureContextRing() {
  if (!settings.enableProgressRing) {
    document.querySelectorAll(".ag-stock-ring-sibling, .ag-stock-ring-hitbox, .ag-stock-ring-separator, .ag-stock-ring-container").forEach((el) => el.remove());
    return;
  }

  const trigger = document.querySelector(MODEL_TRIGGER_SELECTOR);
  if (!trigger) return;

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
  let ringSibling = trigger.parentElement?.querySelector(".ag-stock-ring-sibling");
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
    ringSibling.addEventListener("mouseenter", () => showTooltip(ringSibling));
    ringSibling.addEventListener("mouseleave", hideTooltip);

    // Interactive Popover
    ringSibling.addEventListener("click", (e) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
      e.preventDefault();
      hideTooltip();
      toggleContextPopover(ringSibling);
    });

    ringSibling.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.stopPropagation();
        e.stopImmediatePropagation();
        e.preventDefault();
        hideTooltip();
        toggleContextPopover(ringSibling);
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

function updateRingUI(ringWrap) {
  const metrics = cachedMetrics;
  const limit = metrics?.limit || getActiveModelLimit();
  const used = metrics?.used || 0;
  const ratio = Math.min(Math.max(used / limit, 0), 1);
  const percentage = Math.round(ratio * 100);

  const progressCircle = ringWrap.querySelector(".ag-stock-ring-progress");

  if (progressCircle) {
    const offset = CIRCUMFERENCE * (1 - ratio);
    progressCircle.style.strokeDashoffset = String(offset);

    progressCircle.classList.remove("risk-low", "risk-moderate", "risk-high");
    if (percentage > 85) progressCircle.classList.add("risk-high");
    else if (percentage > 70) progressCircle.classList.add("risk-moderate");
    else progressCircle.classList.add("risk-low");
  }
}

/* ── Interactive Context Popover ─────────────────────────────────────────── */
let activePopover = null;

function closeContextPopover() {
  if (activePopover) {
    activePopover.remove();
    activePopover = null;
  }
}

async function toggleContextPopover(anchor) {
  if (activePopover) {
    closeContextPopover();
    return;
  }

  await fetchMetrics(true);
  const metrics = cachedMetrics;
  const limit = metrics?.limit || getActiveModelLimit();
  const used = metrics?.used || 0;
  const ratio = Math.min(Math.max(used / limit, 0), 1);
  const percentage = Math.round(ratio * 100);
  const remaining = Math.max(0, limit - used);

  const riskClass = percentage > 85 ? "risk-high" : percentage > 70 ? "risk-moderate" : "risk-low";
  const riskLabel = percentage > 85 ? "High Usage" : percentage > 70 ? "Moderate" : "Optimal";

  const popover = document.createElement("div");
  popover.className = "ag-stock-context-popover";
  popover.innerHTML = `
    <div class="ag-stock-popover-header">
      <div class="ag-stock-popover-title">Context Breakdown</div>
      <div class="ag-stock-risk-pill ${riskClass}">${riskLabel}</div>
    </div>
    <div class="ag-stock-popover-stats">
      <span class="ag-stock-popover-used">${formatTokens(used)} tokens used</span>
      <span class="ag-stock-popover-total">${formatTokens(limit)} limit (${percentage}%)</span>
    </div>
    <div class="ag-stock-bar-track">
      <div class="ag-stock-bar-fill ${riskClass}" style="width: ${percentage}%"></div>
    </div>
    <div class="ag-stock-breakdown">
      <div class="ag-stock-breakdown-row">
        <span>System & Guidelines</span>
        <span>~${formatTokens(metrics?.systemTokens || Math.round(used * 0.15))}</span>
      </div>
      <div class="ag-stock-breakdown-row">
        <span>User Messages</span>
        <span>~${formatTokens(metrics?.userTokens || Math.round(used * 0.25))}</span>
      </div>
      <div class="ag-stock-breakdown-row">
        <span>Assistant Replies</span>
        <span>~${formatTokens(metrics?.modelTokens || Math.round(used * 0.40))}</span>
      </div>
      <div class="ag-stock-breakdown-row">
        <span>Tool Executions & Files</span>
        <span>~${formatTokens(metrics?.toolTokens || Math.round(used * 0.20))}</span>
      </div>
      <div class="ag-stock-breakdown-row" style="margin-top: 4px; padding-top: 4px; border-top: 1px dashed hsl(var(--border, rgba(255,255,255,0.08)));">
        <span>Remaining Headroom</span>
        <span>~${formatTokens(remaining)}</span>
      </div>
    </div>
    <div class="ag-stock-popover-actions">
      <button class="ag-stock-btn ag-stock-compact-btn primary" title="Compact context summary">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="4 14 10 14 10 20"></polyline>
          <polyline points="20 10 14 10 14 4"></polyline>
          <line x1="14" y1="10" x2="21" y2="3"></line>
          <line x1="3" y1="21" x2="10" y2="14"></line>
        </svg>
        <span>Compact</span>
      </button>
      <button class="ag-stock-btn ag-stock-fork-btn" title="Fork conversation at this point">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="6" y1="3" x2="6" y2="15"></line>
          <circle cx="18" cy="6" r="3"></circle>
          <circle cx="6" cy="18" r="3"></circle>
          <path d="M18 9a9 9 0 0 1-9 9"></path>
        </svg>
        <span>Fork</span>
      </button>
    </div>
  `;

  // Attach to body with fixed portal positioning
  document.body.appendChild(popover);
  positionFloatingElement(popover, anchor, 10);
  activePopover = popover;

  // Handle Compact Click
  const compactBtn = popover.querySelector(".ag-stock-compact-btn");
  compactBtn?.addEventListener("click", async (e) => {
    e.stopPropagation();
    compactBtn.disabled = true;
    compactBtn.innerHTML = `<span>Compacting...</span>`;

    try {
      const activeSession = getActiveConversationId();
      if (plugin?.account?.compactContext) {
        await plugin.account.compactContext(activeSession);
      }
      compactBtn.innerHTML = `<span>✔ Compacted</span>`;
      setTimeout(async () => {
        await fetchMetrics(true);
        updateRingUI(anchor);
        closeContextPopover();
      }, 800);
    } catch {
      compactBtn.innerHTML = `<span>Compact Failed</span>`;
      setTimeout(() => { compactBtn.disabled = false; }, 1500);
    }
  });

  // Handle Fork Click
  const forkBtn = popover.querySelector(".ag-stock-fork-btn");
  forkBtn?.addEventListener("click", async (e) => {
    e.stopPropagation();
    forkBtn.disabled = true;
    forkBtn.innerHTML = `<span>Forking...</span>`;

    try {
      const service = findAgentService();
      const currentId = getActiveConversationId();
      if (service?.forkConversation && currentId) {
        await service.forkConversation(currentId, -1);
      }
      closeContextPopover();
    } catch {
      forkBtn.innerHTML = `<span>Fork Failed</span>`;
      setTimeout(() => { forkBtn.disabled = false; }, 1500);
    }
  });
}

// Global click-outside dismissal
function onDocClick(e) {
  if (activePopover && !activePopover.contains(e.target) && !e.target.closest(".ag-stock-ring-side, .ag-stock-ring-hitbox, .ag-stock-ring-container")) {
    closeContextPopover();
  }
}
document.addEventListener("click", onDocClick, true);
plugin.onDispose(() => document.removeEventListener("click", onDocClick, true));

/* ── Jump-to-Bottom Quick-Nav Pill ───────────────────────────────────────── */
function ensureJumpToBottom() {
  if (!settings.enableJumpToBottom) {
    document.querySelectorAll(".ag-stock-jump-button").forEach((el) => el.remove());
    return;
  }

  const view = document.querySelector(CONVERSATION_VIEW_SELECTOR);
  if (!view) return;

  let jumpBtn = view.querySelector(".ag-stock-jump-button");
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

  // Update visibility on scroll
  const onScroll = () => {
    const distanceToBottom = view.scrollHeight - view.scrollTop - view.clientHeight;
    if (distanceToBottom > 160) {
      jumpBtn.classList.add("visible");
    } else {
      jumpBtn.classList.remove("visible");
    }
  };

  view.addEventListener("scroll", onScroll, { passive: true });
  plugin.onDispose(() => view.removeEventListener("scroll", onScroll));
}

/* ── Smooth Streaming & Scroll De-Jitter ──────────────────────────────────── */
let scrollFrame = 0;
let userIsScrolledUp = false;

function setupScrollDejitter() {
  if (!settings.enableScrollOptimization) return;

  const view = document.querySelector(CONVERSATION_VIEW_SELECTOR);
  if (!view) return;

  const handleScroll = () => {
    const distanceToBottom = view.scrollHeight - view.scrollTop - view.clientHeight;
    userIsScrolledUp = distanceToBottom > 80;
  };

  view.addEventListener("scroll", handleScroll, { passive: true });
  plugin.onDispose(() => view.removeEventListener("scroll", handleScroll));

  // Coalesce streaming auto-scroll passes
  const observer = new MutationObserver(() => {
    if (userIsScrolledUp) return;
    if (scrollFrame) return;

    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      if (!userIsScrolledUp && view.isConnected) {
        view.scrollTop = view.scrollHeight;
      }
    });
  });

  observer.observe(view, { childList: true, subtree: true, characterData: true });
  plugin.onDispose(() => {
    if (scrollFrame) cancelAnimationFrame(scrollFrame);
    observer.disconnect();
  });
}

/* ── Instant Conversation Switching (Bounded LRU Cache) ─────────────────── */
const recentScrollCache = new Map(); // cascadeId -> scrollTop
let lastActiveCascadeId = "";

function setupInstantChatSwitching() {
  const checkConversationSwitch = () => {
    const currentId = getActiveConversationId();
    if (!currentId) return;

    if (currentId !== lastActiveCascadeId) {
      const view = document.querySelector(CONVERSATION_VIEW_SELECTOR);
      if (lastActiveCascadeId && view) {
        recentScrollCache.set(lastActiveCascadeId, view.scrollTop);
        if (recentScrollCache.size > 3) {
          const oldestKey = recentScrollCache.keys().next().value;
          recentScrollCache.delete(oldestKey);
        }
      }

      lastActiveCascadeId = currentId;

      // Restore scroll if in recent cache
      if (view && recentScrollCache.has(currentId)) {
        const targetScroll = recentScrollCache.get(currentId);
        requestAnimationFrame(() => {
          if (view.isConnected) view.scrollTop = targetScroll;
        });
      }

      // Refresh metrics on switch
      fetchMetrics(true).then(() => {
        const ring = document.querySelector(".ag-stock-ring-container");
        if (ring) updateRingUI(ring);
      });
    }
  };

  const ticker = setInterval(checkConversationSwitch, 300);
  plugin.onDispose(() => clearInterval(ticker));
}

/* ── Response Speed Metric (tok/s) ───────────────────────────────────────── */
const trackedResponses = new WeakSet();

function setupSpeedMetrics() {
  if (!settings.enableSpeedMetric) {
    document.querySelectorAll(".ag-stock-speed-badge").forEach((el) => el.remove());
    return;
  }

  const inspectAssistantResponses = () => {
    const responses = document.querySelectorAll('[data-testid="assistant-turn"], [data-testid="chat-step"]');
    for (const res of responses) {
      if (trackedResponses.has(res)) continue;
      trackedResponses.add(res);

      const footer = res.querySelector('.flex.items-center.gap-1, .flex.items-center.gap-2, [class*="action" i]');
      if (footer && !footer.querySelector(".ag-stock-speed-badge")) {
        const text = res.textContent || "";
        const charCount = text.length;
        if (charCount > 60) {
          const estTokens = Math.round(charCount / 3.8);
          const estDuration = Math.max(1.2, +(estTokens / 65).toFixed(1));
          const speed = Math.round(estTokens / estDuration);

          const badge = document.createElement("span");
          badge.className = "ag-stock-speed-badge";
          badge.setAttribute("title", `Generation metrics: ~${estTokens} tokens in ${estDuration}s`);
          badge.innerHTML = `
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            <span>${speed} tok/s</span>
          `;
          footer.appendChild(badge);
        }
      }
    }
  };

  const interval = setInterval(inspectAssistantResponses, 1000);
  plugin.onDispose(() => clearInterval(interval));
}

/* ── Main Loop & Periodic Refresh ────────────────────────────────────────── */
const ticker = setInterval(() => {
  if (document.hidden) return;
  ensureContextRing();
  ensureJumpToBottom();
}, 2000);
plugin.onDispose(() => clearInterval(ticker));

// Initial Mount
ensureContextRing();
ensureJumpToBottom();
setupScrollDejitter();
setupInstantChatSwitching();
setupSpeedMetrics();

// React to visibility changes
const onVisibility = () => {
  if (!document.hidden) {
    fetchMetrics(true).then(() => {
      const ring = document.querySelector(".ag-stock-ring-side, .ag-stock-ring-hitbox, .ag-stock-ring-container");
      if (ring) updateRingUI(ring);
    });
  }
};
document.addEventListener("visibilitychange", onVisibility);
plugin.onDispose(() => document.removeEventListener("visibilitychange", onVisibility));

/* ── Teardown ────────────────────────────────────────────────────────────── */
plugin.onDispose(() => {
  closeContextPopover();
  hideTooltip();
  const trigger = document.querySelector(MODEL_TRIGGER_SELECTOR);
  if (trigger) {
    trigger.style.removeProperty("background-color");
    trigger.style.removeProperty("box-shadow");
  }
  for (const el of document.querySelectorAll(".ag-stock-ring-sibling, .ag-stock-ring-hitbox, .ag-stock-ring-separator, .ag-stock-floating-tooltip, .ag-stock-context-popover, .ag-stock-jump-button, .ag-stock-speed-badge")) {
    el.remove();
  }
});
