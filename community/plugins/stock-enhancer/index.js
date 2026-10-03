// Native Pro (Stock Enhancer) — Clean, additive enhancements for stock Antigravity UI
// Zero skin changes, zero cosmetic recoloring. Pure native performance and ergonomics.

const CIRCUMFERENCE = 2 * Math.PI * 9; // radius = 9, circumference ≈ 56.5487
const INPUT_BOX_SELECTOR = '[data-testid="agent-input-box"]';
const MODEL_TRIGGER_SELECTOR = '[data-testid="model-selector-trigger"]';
const CONVERSATION_VIEW_SELECTOR = '[data-testid="conversation-view"]';

function testInteractiveNotification() {
  const mockPrompt = {
    id: "test_" + Date.now(),
    question: "Which database architecture should we use for real-time caching?",
    options: [
      { text: "Redis key-value cache with TTL eviction", element: null },
      { text: "SQLite persistent embedded cache", element: null },
      { text: "In-memory LRU cache map", element: null }
    ],
    continueBtn: null,
    skipBtn: null,
    card: null
  };
  sendInteractiveQuestionToast(mockPrompt);
  playAlertSound("approval", true);
  return "Preview question toast with quick-action buttons sent!";
}

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
  },
  soundNotifications: {
    type: "boolean",
    label: "Audio & Desktop Alerts",
    description: "Play pleasant chimes and send notifications when the agent finishes or needs approval.",
    default: true
  },
  soundOnCompletion: {
    type: "boolean",
    label: "Sound on Completion",
    description: "Play audio alert when the agent finishes its response or tasks.",
    default: true
  },
  soundOnApproval: {
    type: "boolean",
    label: "Sound on Approval Needed",
    description: "Play audio alert when the agent halts for your input or tool approval.",
    default: true
  },
  soundTone: {
    type: "select",
    label: "Alert Sound Tone",
    description: "Harmonic tone style synthesized directly via Web Audio.",
    default: "chime",
    options: [
      { value: "chime", label: "Gentle Chime (Dual/Triple tone)" },
      { value: "ping", label: "Subtle Ping (Crisp glass)" },
      { value: "bell", label: "Harmonic Bell (Warm resonance)" }
    ]
  },
  soundVolume: {
    type: "number",
    label: "Alert Volume (%)",
    description: "Volume level from 0 (silent) to 100.",
    default: 75,
    min: 0,
    max: 100
  },
  notifyInBackgroundOnly: {
    type: "boolean",
    label: "Alert Only in Background",
    description: "Only play audio and send alerts when Antigravity is minimized or Alt-Tabbed.",
    default: true
  },
  desktopNotification: {
    type: "boolean",
    label: "Windows Desktop Notification",
    description: "Show a native Windows banner notification when you are in another app.",
    default: true
  },
  grillNotifications: {
    type: "boolean",
    label: "Interactive Question Toasts",
    description: "Show rich actionable toast with choices when agent asks questions while in background.",
    default: true
  },
  grillQuickActions: {
    type: "boolean",
    label: "Remote Quick-Choice Buttons",
    description: "Allow answering directly from Windows notification buttons without switching windows.",
    default: true
  },
  customCompletionSound: {
    type: "string",
    label: "Custom Completion Sound (.wav/.mp3)",
    description: "Optional absolute file path to your own completion audio file.",
    default: "",
    placeholder: "C:/path/to/completion.wav"
  },
  customApprovalSound: {
    type: "string",
    label: "Custom Approval Sound (.wav/.mp3)",
    description: "Optional absolute file path to your own approval audio file.",
    default: "",
    placeholder: "C:/path/to/approval.wav"
  },
  testSound: {
    type: "action",
    label: "Preview Sound",
    action: "Test Sound",
    onSelect: () => {
      playAlertSound("complete", true);
      return "Sound preview played!";
    }
  },
  testToast: {
    type: "action",
    label: "Preview Question Toast",
    action: "Test Toast",
    onSelect: () => {
      return testInteractiveNotification();
    }
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
    if (settings.startMaximized) {
      try {
        window.__betterGravityBridge?.windowMaximize?.();
      } catch {}
      if (typeof window.resizeTo === "function" && window.screen) {
        const availW = window.screen.availWidth;
        const availH = window.screen.availHeight;
        if (window.outerWidth < availW || window.outerHeight < availH) {
          window.moveTo(0, 0);
          window.resizeTo(availW, availH);
        }
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

function findStore() {
  const anchors = [
    document.querySelector(CONVERSATION_VIEW_SELECTOR),
    document.querySelector(INPUT_BOX_SELECTOR),
    document.querySelector('[data-testid="conversation-row-sidebar"]'),
    document.body
  ];
  for (const anchor of anchors) {
    if (!anchor) continue;
    let fiber = getFiber(anchor);
    for (let depth = 0; fiber && depth < 40; depth += 1, fiber = fiber.return) {
      const store = fiber.memoizedProps?.store;
      if (typeof store?.getState === "function") return store;
      let dep = fiber.dependencies?.firstContext;
      for (let i = 0; dep && i < 30; i += 1, dep = dep.next) {
        const depStore = dep.memoizedValue?.store;
        if (typeof depStore?.getState === "function") return depStore;
      }
    }
  }
  return null;
}

function findRouter() {
  const anchors = [
    document.querySelector(CONVERSATION_VIEW_SELECTOR),
    document.body
  ];
  for (const anchor of anchors) {
    if (!anchor) continue;
    let fiber = getFiber(anchor);
    for (let depth = 0; fiber && depth < 40; depth += 1, fiber = fiber.return) {
      if (typeof fiber.memoizedProps?.router?.navigate === "function") {
        return fiber.memoizedProps.router;
      }
      const value = fiber.memoizedProps?.value;
      if (typeof value?.router?.navigate === "function") return value.router;
      if (typeof value?.navigate === "function" && typeof value.parseLocation === "function") return value;
      let dep = fiber.dependencies?.firstContext;
      for (let i = 0; dep && i < 30; i += 1, dep = dep.next) {
        if (typeof dep.memoizedValue?.navigate === "function" && dep.memoizedValue.parseLocation) {
          return dep.memoizedValue;
        }
        if (typeof dep.memoizedValue?.router?.navigate === "function") return dep.memoizedValue.router;
      }
    }
  }
  return null;
}

async function navigateToConversation(cascadeId, projectId) {
  const router = findRouter();
  if (router && typeof router.navigate === "function") {
    try {
      await router.navigate({
        to: "/c/$cascadeId",
        params: { cascadeId },
        search: (previous) => {
          const search = { ...previous };
          delete search.q;
          delete search.focused;
          delete search.tab;
          if (projectId) search.section = projectId;
          return search;
        }
      });
      return true;
    } catch {}
  }

  // Fallback: click sidebar row if present
  const rowLink = document.querySelector(
    `[data-testid="conversation-row-sidebar"][data-cascade-id="${CSS.escape(cascadeId)}"] a[aria-label]`
  );
  if (rowLink instanceof HTMLElement) {
    rowLink.click();
    return true;
  }

  // Fallback: pushState
  try {
    const url = `/c/${encodeURIComponent(cascadeId)}${projectId ? `?section=${encodeURIComponent(projectId)}` : ""}`;
    window.history.pushState(null, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
    return true;
  } catch {}

  return false;
}

function getConversationTitle(cascadeId) {
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

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const ACTIVE_STEP_STATUSES = new Set([1, 2, 8, 9, 11]);

function snapshotThroughResponse(trajectory, sourceCascadeId, forkAtStepIndex) {
  const allSteps = trajectory?.steps;
  const end = forkAtStepIndex === -1 ? allSteps?.length - 1 : forkAtStepIndex;
  if (!Array.isArray(allSteps) || !Number.isSafeInteger(end) || end < 0 || end >= allSteps.length) {
    throw new Error("Could not load history snapshot.");
  }
  if (trajectory.cascadeId && trajectory.cascadeId !== sourceCascadeId) {
    throw new Error("History belongs to a different conversation.");
  }

  const steps = allSteps.slice(0, end + 1).map((step) =>
    ACTIVE_STEP_STATUSES.has(step.status) ? { ...step, status: 6, interaction: undefined } : step
  );
  const generatorMetadata = [];
  for (const metadata of trajectory.generatorMetadata || []) {
    const stepIndices = (metadata.stepIndices || []).filter(
      (index) => Number.isSafeInteger(index) && index >= 0 && index <= end
    );
    if (stepIndices.length) generatorMetadata.push({ ...metadata, stepIndices });
  }
  const executorMetadatas = (trajectory.executorMetadatas || []).filter(
    (metadata) => Number.isSafeInteger(metadata.lastStepIdx) && metadata.lastStepIdx >= 0 && metadata.lastStepIdx <= end
  );

  return {
    ...trajectory,
    steps,
    generatorMetadata,
    executorMetadatas,
    parentReferences: [],
    battleModeInfos: []
  };
}

async function forkFromSnapshot(agentService, request) {
  if (typeof agentService.getCascadeTrajectory !== "function" || typeof agentService.startCascade !== "function") {
    throw new Error("Snapshot service unavailable.");
  }
  const history = await agentService.getCascadeTrajectory({ cascadeId: request.sourceCascadeId, verbosity: 3 });
  const snapshot = snapshotThroughResponse(history?.trajectory, request.sourceCascadeId, request.forkAtStepIndex);
  const metadata = snapshot.metadata || {};
  const projectId = metadata.projectId;
  const workspaceUris = metadata.workspaceUris?.length
    ? metadata.workspaceUris
    : (metadata.workspaces || []).map((w) => w.workspaceFolderAbsoluteUri).filter(Boolean);
  const projectEnvConfig =
    projectId && projectId !== "outside-of-project"
      ? {
          projectId,
          target: metadata.environmentId
            ? { case: "environmentId", value: metadata.environmentId }
            : { case: "defaultProjectEnvironment", value: {} }
        }
      : undefined;
  const lastModelStep = snapshot.steps.findLast((step) => step.metadata?.generatorModel > 0);
  const snapshotId = crypto.randomUUID();
  let started;
  try {
    started = await agentService.startCascade({
      cascadeId: snapshotId,
      source: 1,
      trajectoryType: 4,
      baseTrajectoryIdentifier: {
        identifier: { case: "trajectory", value: snapshot }
      },
      workspaceUris,
      projectEnvConfig,
      agentScriptItem: metadata.agentScript,
      customAgentSpec: metadata.staticConfig,
      requestedModel: lastModelStep?.metadata.generatorModel
    });
    if (!started?.cascadeId || started.cascadeId !== snapshotId) {
      throw new Error("No conversation ID returned.");
    }
  } catch (error) {
    try {
      await agentService.updateConversationAnnotations?.(snapshotId, { archived: true }, true);
    } catch {}
    throw error;
  }

  return {
    newCascadeId: snapshotId,
    newProjectId: started.projectEnvInfo?.projectId || projectId || "outside-of-project",
    forkedAtStepIndex: snapshot.steps.length - 1
  };
}

async function performFork(agentService, request) {
  try {
    return await agentService.forkConversation(request);
  } catch (error) {
    const message = error?.message || String(error);
    if (/must be fully idle|conversation.{0,100}(?:in progress|is busy)/i.test(message)) {
      return forkFromSnapshot(agentService, request);
    }
    throw error;
  }
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

  const activeSession = getActiveConversationId();
  const convTitle = getConversationTitle(activeSession);

  const popover = document.createElement("div");
  popover.className = "ag-stock-context-popover";
  popover.innerHTML = `
    <div class="ag-stock-popover-header">
      <div class="ag-stock-popover-title-group">
        <div class="ag-stock-popover-name" title="${escapeHtml(convTitle)}">${escapeHtml(convTitle)}</div>
        <div class="ag-stock-popover-subtitle">Context Breakdown</div>
      </div>
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
      const activeSessionId = getActiveConversationId();
      if (plugin?.account?.compactContext) {
        await plugin.account.compactContext(activeSessionId);
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
      if (!service || !currentId) {
        throw new Error("Conversation or agent service unavailable");
      }

      const res = await performFork(service, {
        sourceCascadeId: currentId,
        forkAtStepIndex: -1,
        targetForkWorkspace: 1
      });

      if (!res?.newCascadeId) {
        throw new Error("No conversation ID returned by the server");
      }

      forkBtn.innerHTML = `<span>✔ Forked</span>`;
      setTimeout(async () => {
        closeContextPopover();
        await navigateToConversation(res.newCascadeId, res.newProjectId);
      }, 400);
    } catch {
      forkBtn.innerHTML = `<span>Fork Failed</span>`;
      setTimeout(() => {
        forkBtn.disabled = false;
        forkBtn.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="6" y1="3" x2="6" y2="15"></line>
            <circle cx="18" cy="6" r="3"></circle>
            <circle cx="6" cy="18" r="3"></circle>
            <path d="M18 9a9 9 0 0 1-9 9"></path>
          </svg>
          <span>Fork</span>
        `;
      }, 2000);
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

/* ── Native Streaming & Scroll Integrity ─────────────────────────────────── */
function setupScrollDejitter() {
  // Let Antigravity's native scroller manage streaming token progression directly.
  // Avoids MutationObserver layout thrashing and background requestAnimationFrame freezing.
}

/* ── Instant Conversation Switching (Bounded LRU Cache) ─────────────────── */
const recentScrollCache = new Map(); // cascadeId -> scrollTop
let lastActiveCascadeId = "";

function setupInstantChatSwitching() {
  const checkConversationSwitch = () => {
    if (document.hidden) return;
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
    if (document.hidden) return;
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

/* ── Sound & Notification Engine (AntigravityNotify Parity) ──────────────── */
let audioCtx = null;

function getAudioContext() {
  try {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) audioCtx = new AudioCtxClass();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  } catch {}
  return audioCtx;
}

function playSingleNote(ctx, startTime, freq, duration, vol, wave = "sine") {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(vol, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration);
  } catch {}
}

function sendDesktopNotification(title, body) {
  if (!settings.desktopNotification) return;
  try {
    if (typeof window.Notification !== "undefined") {
      if (Notification.permission === "granted") {
        new Notification(title, { body, silent: true });
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then((p) => {
          if (p === "granted") new Notification(title, { body, silent: true });
        });
      }
    }
  } catch {}
}

/* ── Interactive Question & Approval Extraction ──────────────────────────── */
function isOutsideApp() {
  return !document.hasFocus() || document.hidden || document.visibilityState === "hidden";
}

function extractQuestionPrompt() {
  const continueBtn = document.querySelector('[data-testid="interaction-continue-button"]');
  const skipBtn = document.querySelector('[data-testid="interaction-skip-button"]');
  const confirmationBtn = document.querySelector('[data-testid="confirmation-confirm"], [aria-label*="Allow using this MCP tool"]');

  if (!continueBtn && !confirmationBtn && !document.querySelector(APPROVAL_SELECTOR)) {
    return null;
  }

  const card = continueBtn?.closest('.relative.flex.flex-col.p-px.rounded-2xl.bg-card-border.w-full') ||
               continueBtn?.closest('.bg-card')?.parentElement ||
               continueBtn?.closest('[role="dialog"]') ||
               continueBtn?.closest('.chat-confirmation-widget2') ||
               confirmationBtn?.closest('.chat-confirmation-widget2') ||
               confirmationBtn?.closest('[role="dialog"]') ||
               document.querySelector('.chat-confirmation-widget2, [role="dialog"]');

  let questionText = "";
  if (card) {
    const heading = card.querySelector('h1, h2, h3, h4, [class*="font-semibold"], [class*="font-medium"], [class*="text-base"]');
    if (heading) {
      questionText = heading.innerText?.trim() || "";
    }
    if (!questionText) {
      const p = card.querySelector('p');
      if (p) questionText = p.innerText?.trim() || "";
    }
  }

  if (!questionText) {
    questionText = continueBtn ? "Choose an option to continue." : "The agent is waiting for your tool or action approval.";
  }

  const options = [];
  let hasWriteIn = false;
  let writeInPlaceholder = "Other (write your answer)";

  if (card) {
    const writeInEl = card.querySelector('[data-testid="ask-question-writein"]');
    if (writeInEl) {
      hasWriteIn = true;
      writeInPlaceholder = writeInEl.getAttribute("placeholder") || "Other (write your answer)";
    }

    const optionLabels = card.querySelectorAll('[role="radiogroup"] label, label:has(input[type="radio"]), label:has(input[type="checkbox"])');
    for (const el of optionLabels) {
      if (el.querySelector('[data-testid="ask-question-writein"]')) {
        continue;
      }
      const span = el.querySelector("span:last-child") || el.querySelector("span:not([class*='bg-border'])");
      let txt = (span?.innerText || el.innerText || "").trim();
      txt = txt.replace(/^[0-9]+[.:\s\)]*/, "").trim();
      if (txt && !options.some((o) => o.text === txt)) {
        options.push({ text: txt, element: el });
      }
    }

    if (options.length === 0) {
      const inputs = card.querySelectorAll('input[type="radio"], input[type="checkbox"]');
      for (const input of inputs) {
        if (input.closest('label:has([data-testid="ask-question-writein"])')) continue;
        const parent = input.closest('label') || input.parentElement;
        let txt = parent?.innerText?.trim() || input.value;
        txt = txt.replace(/^[0-9]+[.:\s\)]*/, "").trim();
        if (txt && !options.some((o) => o.text === txt)) {
          options.push({ text: txt, element: input });
        }
      }
    }
  }

  const promptId = questionText.slice(0, 50) + `:${options.length}:${hasWriteIn}`;
  return {
    id: promptId,
    question: questionText,
    options,
    hasWriteIn,
    writeInPlaceholder,
    continueBtn: continueBtn || confirmationBtn,
    skipBtn,
    card
  };
}

function selectOptionElement(labelOrInput) {
  if (!labelOrInput) return;
  const input = labelOrInput.tagName === "INPUT" ? labelOrInput : labelOrInput.querySelector("input");

  labelOrInput.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
  labelOrInput.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
  labelOrInput.click();

  if (input) {
    input.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
    input.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
    input.click();

    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "checked")?.set;
    if (setter) {
      setter.call(input, true);
    } else {
      input.checked = true;
    }
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function triggerQuestionSubmit() {
  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    const submitBtn = document.querySelector('[data-testid="interaction-continue-button"]') ||
                      document.querySelector('[data-testid="confirmation-confirm"]') ||
                      document.querySelector('[aria-label*="Allow using this MCP tool"]');
    if (submitBtn && !submitBtn.disabled) {
      submitBtn.click();
      clearInterval(interval);
    } else if (attempts >= 15) {
      if (submitBtn) submitBtn.click();
      clearInterval(interval);
    }
  }, 60);
}

function handleWriteInSubmit(customText) {
  const writeinTextarea = document.querySelector('[data-testid="ask-question-writein"]');
  if (writeinTextarea) {
    const parentLabel = writeinTextarea.closest("label");
    if (parentLabel) {
      selectOptionElement(parentLabel);
    }

    writeinTextarea.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set ||
                   Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (setter) {
      setter.call(writeinTextarea, customText);
    } else {
      writeinTextarea.value = customText;
    }
    writeinTextarea.dispatchEvent(new Event("input", { bubbles: true }));
    writeinTextarea.dispatchEvent(new Event("change", { bubbles: true }));

    triggerQuestionSubmit();
  }
}

function toastOverlaySurface(Overlay, data) {
  const container = document.createElement("div");
  container.className = "bg-toast-container";
  const question = String(data?.question || "Decision required").replace(/</g, "&lt;");
  const options = Array.isArray(data?.options) ? data.options : [];
  const hasWriteIn = Boolean(data?.hasWriteIn);
  const writeInPlaceholder = String(data?.writeInPlaceholder || "Other (write your answer)").replace(/</g, "&lt;");

  let optionsHtml = "";
  for (let i = 0; i < options.length; i++) {
    const text = String(options[i]?.text || "").replace(/</g, "&lt;");
    optionsHtml += `
      <button class="bg-toast-btn" data-index="${i}" type="button" title="${text}">
        <span class="bg-toast-btn-num">${i + 1}</span>
        <span class="bg-toast-btn-text">${text}</span>
      </button>
    `;
  }

  let writeInHtml = "";
  if (hasWriteIn) {
    writeInHtml = `
      <div class="bg-toast-writein-container">
        <div class="bg-toast-writein-input-wrap">
          <input type="text" class="bg-toast-writein-input" placeholder="${writeInPlaceholder}" />
          <button class="bg-toast-writein-submit" type="button" title="Submit custom answer">Send</button>
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="bg-toast-card">
      <div class="bg-toast-header">
        <span class="bg-toast-badge">🍳 Grill Me: Action Required</span>
        <button class="bg-toast-close" type="button" title="Dismiss">✕</button>
      </div>
      <div class="bg-toast-question">${question}</div>
      <div class="bg-toast-options">${optionsHtml}</div>
      ${writeInHtml}
      <div class="bg-toast-footer">Click outside options to open Antigravity</div>
    </div>
  `;

  document.body.appendChild(container);

  // Pointer tracking & hit-testing for Windows click-through support
  let isPointerOver = false;
  Overlay.onMessage((msg) => {
    if (msg && msg.type === "bettergravity:overlay-pointer") {
      const rect = container.getBoundingClientRect();
      const inside = (
        msg.x >= rect.left &&
        msg.x <= rect.right &&
        msg.y >= rect.top &&
        msg.y <= rect.bottom
      );
      if (inside !== isPointerOver) {
        isPointerOver = inside;
        Overlay.setInteractive(inside);
        if (!inside) {
          Overlay.setFocusable(false);
        }
      }
    }
  });

  const btns = container.querySelectorAll(".bg-toast-btn");
  btns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      Overlay.send({ action: "select", index: idx });
      Overlay.close();
    });
  });

  const writeInInput = container.querySelector(".bg-toast-writein-input");
  const writeInBtn = container.querySelector(".bg-toast-writein-submit");

  if (writeInInput) {
    writeInInput.addEventListener("focus", () => Overlay.setFocusable(true));
    writeInInput.addEventListener("blur", () => Overlay.setFocusable(false));

    const submitCustom = () => {
      const text = writeInInput.value.trim();
      if (!text) return;
      Overlay.send({ action: "writein", text });
      Overlay.close();
    };

    writeInBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      submitCustom();
    });

    writeInInput.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submitCustom();
      }
    });
  }

  const closeBtn = container.querySelector(".bg-toast-close");
  closeBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    Overlay.close();
  });

  const card = container.querySelector(".bg-toast-card");
  card?.addEventListener("click", (e) => {
    if (
      e.target.closest(".bg-toast-btn") ||
      e.target.closest(".bg-toast-close") ||
      e.target.closest(".bg-toast-writein-container")
    ) {
      return;
    }
    Overlay.focusOwner();
    Overlay.close();
  });
}

const toastOverlayStyles = `
html, body {
  margin: 0; padding: 0; width: 100%; height: 100%;
  overflow: hidden; background: transparent !important;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  user-select: none;
}
.bg-toast-container {
  position: fixed;
  bottom: 28px;
  right: 28px;
  width: 410px;
  max-width: calc(100vw - 48px);
  z-index: 999999;
  animation: bgToastIn 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes bgToastIn {
  from { opacity: 0; transform: translateY(14px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.bg-toast-card {
  background: rgba(22, 22, 24, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 12px;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(20px);
  padding: 14px 16px;
  color: #f4f4f5;
  cursor: pointer;
}
.bg-toast-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.bg-toast-badge {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #a1a1aa;
}
.bg-toast-close {
  background: transparent;
  border: none;
  color: #71717a;
  font-size: 13px;
  cursor: pointer;
  padding: 2px 5px;
  border-radius: 4px;
  line-height: 1;
}
.bg-toast-close:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
}
.bg-toast-question {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  color: #ffffff;
  margin-bottom: 10px;
}
.bg-toast-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.bg-toast-btn {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 7px;
  padding: 7px 10px;
  color: #e4e4e7;
  font-size: 12px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.12s ease, border-color 0.12s ease;
}
.bg-toast-btn:hover {
  background: rgba(255, 255, 255, 0.14);
  border-color: rgba(255, 255, 255, 0.25);
  color: #ffffff;
}
.bg-toast-btn-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 17px;
  height: 17px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.14);
  font-size: 10px;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 1px;
}
.bg-toast-btn-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.4;
}
.bg-toast-btn:hover .bg-toast-btn-text {
  white-space: normal;
  word-break: break-word;
}
.bg-toast-writein-container {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
}
.bg-toast-writein-input-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  padding: 4px 8px;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.bg-toast-writein-input-wrap:focus-within {
  border-color: #3b82f6;
  background: rgba(255, 255, 255, 0.08);
}
.bg-toast-writein-input {
  flex: 1;
  background: transparent;
  border: none;
  color: #ffffff;
  font-size: 12px;
  outline: none;
  font-family: inherit;
  padding: 3px 0;
}
.bg-toast-writein-input::placeholder {
  color: #71717a;
}
.bg-toast-writein-submit {
  background: #2563eb;
  border: none;
  border-radius: 6px;
  color: #ffffff;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  cursor: pointer;
  transition: background-color 0.12s ease;
}
.bg-toast-writein-submit:hover {
  background: #1d4ed8;
}
.bg-toast-footer {
  margin-top: 8px;
  font-size: 10px;
  color: #71717a;
  text-align: center;
}
`;

let activeOverlayHandle = null;

async function showDesktopQuestionOverlay(prompt) {
  if (!plugin.overlay?.open) return;
  if (!settings.grillNotifications) return;

  if (activeOverlayHandle) {
    try { await activeOverlayHandle.close(); } catch {}
    activeOverlayHandle = null;
  }

  const optionsData = (prompt.options || []).slice(0, 4).map((o) => ({ text: o.text }));

  try {
    const handle = await plugin.overlay.open({
      script: toastOverlaySurface,
      styles: toastOverlayStyles,
      data: {
        question: prompt.question,
        options: optionsData,
        hasWriteIn: Boolean(prompt.hasWriteIn),
        writeInPlaceholder: prompt.writeInPlaceholder || "Other (write your answer)"
      },
      display: "primary"
    });

    if (handle?.ok) {
      activeOverlayHandle = handle;
      handle.onMessage((msg) => {
        if (msg?.action === "select" && typeof msg.index === "number") {
          const opt = prompt.options?.[msg.index];
          if (opt?.element) {
            selectOptionElement(opt.element);
            triggerQuestionSubmit();
          }
        } else if (msg?.action === "writein" && typeof msg.text === "string") {
          handleWriteInSubmit(msg.text);
        }
      });
    }
  } catch (err) {
    plugin.log.error("Failed to show desktop question overlay:", err);
  }
}

let activePromptToast = null;
let lastDispatchedPromptId = "";

function checkAndDispatchQuestionToast() {
  try {
    const approval = document.querySelector(APPROVAL_SELECTOR) !== null;
    if (!approval) {
      if (hasActiveApproval) {
        hasActiveApproval = false;
        lastDispatchedPromptId = "";
        if (activePromptToast) {
          try { activePromptToast.close(); } catch {}
          activePromptToast = null;
        }
        if (activeOverlayHandle) {
          try { activeOverlayHandle.close(); } catch {}
          activeOverlayHandle = null;
        }
      }
      return;
    }

    hasActiveApproval = true;

    // If user is currently focused inside Antigravity and setting requires background, defer until they tab out
    if (settings.notifyInBackgroundOnly && !isOutsideApp()) {
      if (activeOverlayHandle) {
        try { activeOverlayHandle.close(); } catch {}
        activeOverlayHandle = null;
        lastDispatchedPromptId = "";
      }
      return;
    }

    const prompt = extractQuestionPrompt();
    if (!prompt) return;

    if (prompt.id === lastDispatchedPromptId) {
      return;
    }

    lastDispatchedPromptId = prompt.id;
    plugin.log.info("Dispatching question toast for:", prompt.id);
    playAlertSound("approval");
    sendInteractiveQuestionToast(prompt);
    showDesktopQuestionOverlay(prompt);
  } catch (err) {
    plugin.log.error("checkAndDispatchQuestionToast error:", String(err));
  }
}

function sendInteractiveQuestionToast(prompt) {
  if (!settings.desktopNotification) return;
  if (!settings.grillNotifications && prompt?.options?.length > 0) return;
  if (settings.notifyInBackgroundOnly && !isOutsideApp()) return;

  try {
    if (typeof Notification === "undefined") return;

    if (Notification.permission !== "granted") {
      if (Notification.permission !== "denied") {
        Notification.requestPermission();
      }
      return;
    }

    // Clean up any previously opened toast for older prompt
    if (activePromptToast) {
      try { activePromptToast.close(); } catch {}
      activePromptToast = null;
    }

    const options = prompt.options || [];
    const maxActions = (typeof Notification !== "undefined" && Notification.maxActions) ? Notification.maxActions : 2;
    const actions = [];

    if (settings.grillQuickActions && options.length > 0) {
      for (let i = 0; i < Math.min(options.length, maxActions); i++) {
        const cleanTitle = options[i].text.replace(/^[0-9]+[.:\s]*/, '').trim().slice(0, 20);
        actions.push({
          action: `choice_${i}`,
          title: `${i + 1}. ${cleanTitle}`
        });
      }
    }

    let bodyText = prompt.question;
    if (options.length > 0) {
      bodyText += "\n\n" + options.map((opt, idx) => `[${idx + 1}] ${opt.text}`).join("\n");
    }

    const title = options.length > 0 ? "🍳 Grill Me: Decision Needed" : "Antigravity: Approval Needed";
    let notif;
    try {
      notif = new Notification(title, {
        body: bodyText.slice(0, 300),
        requireInteraction: true,
        actions: actions.length > 0 ? actions : undefined,
        silent: true // sound is synthesized harmonically by playAlertSound
      });
    } catch {
      // Chromium renderer rejects actions without a ServiceWorker; fallback to standard rich notification
      notif = new Notification(title, {
        body: bodyText.slice(0, 300),
        requireInteraction: true,
        silent: true
      });
    }

    plugin.log.info("Toast notification created:", title);

    notif.onaction = (e) => {
      try {
        const action = e?.action || "";
        if (action.startsWith("choice_")) {
          const idx = parseInt(action.replace("choice_", ""), 10);
          if (Number.isFinite(idx) && options[idx]) {
            const el = options[idx].element;
            if (el) {
              el.click();
              if (el.tagName === "INPUT") {
                el.checked = true;
                el.dispatchEvent(new Event("change", { bubbles: true }));
              }
            }
            setTimeout(() => {
              const btn = prompt.continueBtn;
              if (btn && !btn.disabled) {
                btn.click();
              }
            }, 80);
          }
        }
      } catch (err) {
        plugin.log.error("Failed to select option from toast action:", err);
      }
    };

    notif.onclick = () => {
      try {
        window.focus();
      } catch {}
    };

    notif.onclose = () => {
      if (activePromptToast === notif) activePromptToast = null;
    };

    activePromptToast = notif;
  } catch (err) {
    plugin.log.error("Error showing interactive toast:", err);
  }
}

function playAlertSound(type = "complete", force = false) {
  if (!force) {
    if (!settings.soundNotifications) return;
    if (type === "complete" && !settings.soundOnCompletion) return;
    if (type === "approval" && !settings.soundOnApproval) return;
    if (settings.notifyInBackgroundOnly && !isOutsideApp()) return;
  }

  const customPath = (type === "approval" ? settings.customApprovalSound : settings.customCompletionSound)?.trim();
  if (customPath) {
    try {
      const uri = customPath.startsWith("http") || customPath.startsWith("file://")
        ? customPath
        : `file:///${customPath.replace(/\\/g, "/")}`;
      const audio = new Audio(uri);
      audio.volume = Math.max(0, Math.min(Number(settings.soundVolume || 75) / 100, 1));
      audio.play().then(() => {
        if (type === "complete") {
          sendDesktopNotification("Antigravity: Task Complete", "The agent has finished generating.");
        }
      }).catch(() => playSynthesizedAlert(type));
      return;
    } catch {}
  }

  playSynthesizedAlert(type);
}

function playSynthesizedAlert(type) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const vol = Math.max(0, Math.min(Number(settings.soundVolume || 75) / 100, 1)) * 0.28;
  const now = ctx.currentTime;
  const tone = settings.soundTone || "chime";

  if (type === "approval") {
    // Two-tone alert (D5 -> A5)
    playSingleNote(ctx, now, 587.33, 0.14, vol * 0.9, "sine");
    playSingleNote(ctx, now + 0.12, 880, 0.28, vol, "sine");
  } else {
    // Completion chime
    if (tone === "ping") {
      playSingleNote(ctx, now, 1046.5, 0.35, vol, "sine");
      playSingleNote(ctx, now, 2093, 0.2, vol * 0.4, "sine");
    } else if (tone === "bell") {
      playSingleNote(ctx, now, 440, 0.7, vol * 0.8, "sine");
      playSingleNote(ctx, now, 1210, 0.45, vol * 0.3, "triangle");
      playSingleNote(ctx, now, 2420, 0.25, vol * 0.15, "sine");
    } else {
      // Default: Gentle 3-note harmonic arpeggio (C5 -> E5 -> G5)
      playSingleNote(ctx, now, 523.25, 0.14, vol * 0.8, "sine");
      playSingleNote(ctx, now + 0.10, 659.25, 0.14, vol * 0.85, "sine");
      playSingleNote(ctx, now + 0.20, 783.99, 0.35, vol, "sine");
    }
    sendDesktopNotification("Antigravity: Task Complete", "The agent has finished generating.");
  }
}

/* ── Execution State & Approval Tracker ───────────────────────────────────── */
const BUSY_SELECTOR = [
  '[data-tooltip-id="input-send-button-cancel-tooltip"]',
  '[aria-label="Stop execution"]',
  'button[aria-label*="Cancel (Ctrl+D)"]'
].join(",");

const APPROVAL_SELECTOR = [
  '[data-testid="interaction-continue-button"]',
  '.chat-confirmation-widget2',
  '[data-testid="confirmation-confirm"]',
  '[aria-label*="Allow using this MCP tool"]'
].join(",");

let isAgentBusy = false;
let hasActiveApproval = false;
let stateWatcherTimer = 0;

function setupStateWatcher() {
  const checkState = () => {
    try {
      const busy = document.querySelector(BUSY_SELECTOR) !== null;
      const approval = document.querySelector(APPROVAL_SELECTOR) !== null;

      // 1. Approval / Question Check
      checkAndDispatchQuestionToast();

      // 2. Completion Trigger: was running, now stopped without pending approval
      if (isAgentBusy && !busy) {
        isAgentBusy = false;
        if (!approval) {
          playAlertSound("complete");
        }
      } else if (!isAgentBusy && busy) {
        isAgentBusy = true;
      }
    } catch {}
  };

  stateWatcherTimer = setInterval(checkState, 400);
  plugin.onDispose(() => clearInterval(stateWatcherTimer));

  // Instant trigger when user Alt-Tabs or clicks outside
  const onBlur = () => {
    checkAndDispatchQuestionToast();
  };
  const onFocus = () => {
    if (settings.notifyInBackgroundOnly && activeOverlayHandle) {
      try { activeOverlayHandle.close(); } catch {}
      activeOverlayHandle = null;
      lastDispatchedPromptId = "";
    }
  };
  window.addEventListener("blur", onBlur);
  window.addEventListener("focus", onFocus);
  plugin.onDispose(() => {
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("focus", onFocus);
  });
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
setupStateWatcher();

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
  if (activePromptToast) {
    try { activePromptToast.close(); } catch {}
    activePromptToast = null;
  }
  if (audioCtx) {
    try { audioCtx.close(); } catch {}
    audioCtx = null;
  }
  const trigger = document.querySelector(MODEL_TRIGGER_SELECTOR);
  if (trigger) {
    trigger.style.removeProperty("background-color");
    trigger.style.removeProperty("box-shadow");
  }
  for (const el of document.querySelectorAll(".ag-stock-ring-sibling, .ag-stock-ring-hitbox, .ag-stock-ring-separator, .ag-stock-floating-tooltip, .ag-stock-context-popover, .ag-stock-jump-button, .ag-stock-speed-badge")) {
    el.remove();
  }
});
