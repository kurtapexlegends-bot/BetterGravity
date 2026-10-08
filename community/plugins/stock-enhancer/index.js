(() => {
  // community/plugins/stock-enhancer/src/config.ts
  var CIRCUMFERENCE = 2 * Math.PI * 9;
  var INPUT_BOX_SELECTOR = '[data-testid="agent-input-box"]';
  var MODEL_TRIGGER_SELECTOR = '[data-testid="model-selector-trigger"]';
  var CONVERSATION_VIEW_SELECTOR = '[data-testid="conversation-view"]';
  var APPROVAL_SELECTOR = [
    '[data-testid="interaction-continue-button"]',
    ".chat-confirmation-widget2",
    '[data-testid="confirmation-confirm"]',
    '[aria-label*="Allow using this MCP tool"]'
  ].join(",");
  var MODEL_LIMITS = {
    "claude-3-5-sonnet": 2e5,
    "claude-3-7-sonnet": 2e5,
    "claude-3-opus": 2e5,
    "claude-3-5-haiku": 2e5,
    "gpt-4o": 128e3,
    "gpt-4o-mini": 128e3,
    "o1": 2e5,
    "o1-mini": 128e3,
    "o1-preview": 128e3,
    "o3-mini": 2e5,
    "gemini-2.0-flash": 1048576,
    "gemini-2.0-pro": 2097152,
    "gemini-1.5-pro": 2097152,
    "gemini-1.5-flash": 1048576,
    "deepseek-r1": 64e3,
    "deepseek-v3": 64e3
  };
  var testSoundHandler = null;
  var testToastHandler = null;
  function registerConfigActionHandlers(handlers) {
    if (handlers.testSound) testSoundHandler = handlers.testSound;
    if (handlers.testToast) testToastHandler = handlers.testToast;
  }
  var settings = plugin.settings.define({
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
        if (testSoundHandler) return testSoundHandler();
        return "Sound preview played!";
      }
    },
    testToast: {
      type: "action",
      label: "Preview Question Toast",
      action: "Test Toast",
      onSelect: () => {
        if (testToastHandler) return testToastHandler();
        return "Preview question toast with quick-action buttons sent!";
      }
    },
    terminalSplitMode: {
      type: "select",
      label: "Split Terminal Layout",
      description: "Layout for split terminal panes: auto stacks vertically when narrow, vertical always stacks top-and-bottom.",
      default: "auto",
      options: [
        { value: "auto", label: "Smart Responsive (Auto-stack when narrow)" },
        { value: "vertical", label: "Always Stack Vertically (Top & Bottom)" },
        { value: "horizontal", label: "Always Horizontal (Side by Side)" }
      ]
    }
  });

  // community/plugins/stock-enhancer/src/audio.ts
  var audioCtx = null;
  function getAudioContext() {
    try {
      if (!audioCtx) {
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        if (AudioCtxClass) audioCtx = new AudioCtxClass();
      }
      if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume();
      }
    } catch {
    }
    return audioCtx;
  }
  function closeAudioContext() {
    if (audioCtx) {
      try {
        audioCtx.close();
      } catch {
      }
      audioCtx = null;
    }
  }
  function playSingleNote(ctx, startTime, freq, duration, vol, wave = "sine") {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(vol, startTime);
      gain.gain.exponentialRampToValueAtTime(1e-4, startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    } catch {
    }
  }
  function sendDesktopNotification(title, body, cascadeId) {
    if (!settings.desktopNotification) return;
    try {
      if (typeof window.Notification !== "undefined") {
        const show = () => {
          const notif = new Notification(title, { body, silent: true });
          notif.onclick = () => {
            try {
              window.focus();
              if (cascadeId) navigateToConversation(cascadeId);
            } catch {
            }
          };
        };
        if (Notification.permission === "granted") {
          show();
        } else if (Notification.permission !== "denied") {
          Notification.requestPermission().then((p) => {
            if (p === "granted") show();
          });
        }
      }
    } catch {
    }
  }
  function playSynthesizedAlert(type) {
    const ctx = getAudioContext();
    if (!ctx) return;
    const vol = Math.max(0, Math.min(Number(settings.soundVolume || 75) / 100, 1)) * 0.28;
    const now = ctx.currentTime;
    const tone = settings.soundTone || "chime";
    if (type === "approval") {
      playSingleNote(ctx, now, 587.33, 0.14, vol * 0.9, "sine");
      playSingleNote(ctx, now + 0.12, 880, 0.28, vol, "sine");
    } else {
      if (tone === "ping") {
        playSingleNote(ctx, now, 1046.5, 0.35, vol, "sine");
        playSingleNote(ctx, now, 2093, 0.2, vol * 0.4, "sine");
      } else if (tone === "bell") {
        playSingleNote(ctx, now, 440, 0.7, vol * 0.8, "sine");
        playSingleNote(ctx, now, 1210, 0.45, vol * 0.3, "triangle");
        playSingleNote(ctx, now, 2420, 0.25, vol * 0.15, "sine");
      } else {
        playSingleNote(ctx, now, 523.25, 0.14, vol * 0.8, "sine");
        playSingleNote(ctx, now + 0.1, 659.25, 0.14, vol * 0.85, "sine");
        playSingleNote(ctx, now + 0.2, 783.99, 0.35, vol, "sine");
      }
      sendDesktopNotification("Antigravity: Task Complete", "The agent has finished generating.");
    }
  }
  function playAlertSound(type = "complete", force = false) {
    if (!force) {
      if (!settings.soundNotifications) return;
      if (type === "complete" && !settings.soundOnCompletion) return;
      if (type === "approval" && !settings.soundOnApproval) return;
      const isOutside = !document.hasFocus() || document.hidden || document.visibilityState === "hidden";
      if (settings.notifyInBackgroundOnly && !isOutside) return;
    }
    const customPath = (type === "approval" ? settings.customApprovalSound : settings.customCompletionSound)?.trim();
    if (customPath) {
      try {
        const uri = customPath.startsWith("http") || customPath.startsWith("file://") ? customPath : `file:///${customPath.replace(/\\/g, "/")}`;
        const audio = new Audio(uri);
        audio.volume = Math.max(0, Math.min(Number(settings.soundVolume || 75) / 100, 1));
        audio.play().then(() => {
          if (type === "complete") {
            sendDesktopNotification("Antigravity: Task Complete", "The agent has finished generating.");
          }
        }).catch(() => playSynthesizedAlert(type));
        return;
      } catch {
      }
    }
    playSynthesizedAlert(type);
  }

  // community/plugins/stock-enhancer/src/fork.ts
  var ACTIVE_STEP_STATUSES = /* @__PURE__ */ new Set([1, 2, 8, 9, 11]);
  function snapshotThroughResponse(trajectory, sourceCascadeId, forkAtStepIndex) {
    const allSteps = trajectory?.steps;
    const end = forkAtStepIndex === -1 ? allSteps?.length - 1 : forkAtStepIndex;
    if (!Array.isArray(allSteps) || !Number.isSafeInteger(end) || end < 0 || end >= allSteps.length) {
      throw new Error("Could not load history snapshot.");
    }
    if (trajectory.cascadeId && trajectory.cascadeId !== sourceCascadeId) {
      throw new Error("History belongs to a different conversation.");
    }
    const steps = allSteps.slice(0, end + 1).map(
      (step) => ACTIVE_STEP_STATUSES.has(step.status) ? { ...step, status: 6, interaction: void 0 } : step
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
    const workspaceUris = metadata.workspaceUris?.length ? metadata.workspaceUris : (metadata.workspaces || []).map((w) => w.workspaceFolderAbsoluteUri).filter(Boolean);
    const projectEnvConfig = projectId && projectId !== "outside-of-project" ? {
      projectId,
      target: metadata.environmentId ? { case: "environmentId", value: metadata.environmentId } : { case: "defaultProjectEnvironment", value: {} }
    } : void 0;
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
      } catch {
      }
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

  // community/plugins/stock-enhancer/src/shared.ts
  function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  function positionFloatingElement(element, anchor, offset = 8) {
    const rect = anchor.getBoundingClientRect();
    const elemRect = element.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - elemRect.width / 2;
    let top = rect.top - elemRect.height - offset;
    if (left < 10) left = 10;
    if (left + elemRect.width > window.innerWidth - 10) {
      left = window.innerWidth - elemRect.width - 10;
    }
    if (top < 10) {
      top = rect.bottom + offset;
    }
    element.style.position = "fixed";
    element.style.left = `${Math.round(left)}px`;
    element.style.top = `${Math.round(top)}px`;
    element.style.zIndex = "999999";
  }
  var activeTooltip = null;
  function showTooltip(anchor, metrics) {
    hideTooltip();
    const limit = metrics?.limit || getActiveModelLimit();
    const used = metrics?.used || 0;
    const percentage = Math.round(Math.min(Math.max(used / limit, 0), 1) * 100);
    const remaining = Math.max(0, limit - used);
    const tip = document.createElement("div");
    tip.className = "ag-stock-floating-tooltip";
    tip.textContent = `${percentage}% context used \u2022 ~${formatTokens(remaining)} left`;
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
  function applyInstantBootup() {
    if (settings.instantBootup) {
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
      } catch {
      }
    }
  }
  function formatTokens(n) {
    const num = Number(n) || 0;
    if (num >= 1e6) {
      const m = (num / 1e6).toFixed(1);
      return `${m.endsWith(".0") ? m.slice(0, -2) : m}M`;
    }
    if (num >= 1e3) {
      const k = (num / 1e3).toFixed(1);
      return `${k.endsWith(".0") ? k.slice(0, -2) : k}k`;
    }
    return String(num);
  }
  function getActiveModelLimit() {
    const trigger = document.querySelector(MODEL_TRIGGER_SELECTOR);
    const text = (trigger?.innerText || "").toLowerCase();
    for (const [key, limit] of Object.entries(MODEL_LIMITS)) {
      if (text.includes(key.toLowerCase())) return limit;
    }
    return 1e6;
  }
  function getActiveConversationId() {
    const view = document.querySelector(CONVERSATION_VIEW_SELECTOR);
    const id = view?.getAttribute("data-cascade-id") || "";
    if (id) return id;
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
  function findStore() {
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
  function findRouter() {
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
  async function navigateToConversation(cascadeId, projectId) {
    const router = findRouter();
    if (router) {
      try {
        if (typeof router.navigate === "function") {
          router.navigate({
            pathname: `/c/${encodeURIComponent(cascadeId)}`,
            search: (previous) => {
              const search = { ...previous };
              if (projectId) search.section = projectId;
              return search;
            }
          });
          return true;
        }
      } catch {
      }
    }
    const rowLink = document.querySelector(
      `[data-testid="conversation-row-sidebar"][data-cascade-id="${CSS.escape(cascadeId)}"] a, [data-cascade-id="${CSS.escape(cascadeId)}"] a, a[href*="/c/${CSS.escape(cascadeId)}"]`
    );
    if (rowLink) {
      rowLink.click();
      return true;
    }
    const url = `/c/${encodeURIComponent(cascadeId)}${projectId ? `?section=${encodeURIComponent(projectId)}` : ""}`;
    window.history.pushState(null, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
    return true;
  }
  function getConversationTitle(cascadeId) {
    if (!cascadeId) return "Current Conversation";
    try {
      const store = findStore();
      const summary = store?.getState()?.trajectorySummaries?.summaries?.[cascadeId];
      if (summary?.summary) return summary.summary.trim();
      if (summary?.title) return summary.title.trim();
    } catch {
    }
    try {
      const row = document.querySelector(`[data-cascade-id="${CSS.escape(cascadeId)}"]`);
      const label = row?.querySelector("a[aria-label]")?.getAttribute("aria-label") || row?.querySelector("span.truncate")?.textContent?.trim() || row?.querySelector(".truncate")?.textContent?.trim();
      if (label && !label.includes(cascadeId)) return label;
    } catch {
    }
    try {
      const headerTitle = document.querySelector('[data-testid="conversation-title"]')?.textContent?.trim() || document.querySelector(".conversation-title")?.textContent?.trim() || document.querySelector('header [class*="truncate"]')?.textContent?.trim();
      if (headerTitle && !headerTitle.includes(cascadeId)) return headerTitle;
    } catch {
    }
    try {
      if (document.title && !document.title.toLowerCase().startsWith("antigravity")) {
        const clean = document.title.split(" - ")[0].trim();
        if (clean) return clean;
      }
    } catch {
    }
    return "Current Conversation";
  }
  var cachedLsClient = null;
  var lastLsClientPollTime = 0;
  var cachedBackendSummaries = null;
  function resetLsClientPollTime() {
    lastLsClientPollTime = 0;
  }
  function getAntigravityLsClient() {
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
        let f = el[key];
        while (f) {
          const client = f.memoizedProps?.syncedState?.sidebarSectionsProvider?.projectManagementFeature?.lsClient;
          if (client && typeof client.getAllCascadeTrajectories === "function") {
            cachedLsClient = client;
            return cachedLsClient;
          }
          f = f.return;
        }
      }
      const candidates = document.querySelectorAll('[data-testid], [class*="sidebar"]');
      for (let i = 0; i < candidates.length; i++) {
        const el = candidates[i];
        const key = Object.keys(el).find((k) => k.startsWith("__reactFiber"));
        if (!key) continue;
        let f = el[key];
        while (f) {
          const client = f.memoizedProps?.syncedState?.sidebarSectionsProvider?.projectManagementFeature?.lsClient;
          if (client && typeof client.getAllCascadeTrajectories === "function") {
            cachedLsClient = client;
            return cachedLsClient;
          }
          f = f.return;
        }
      }
    } catch {
    }
    return null;
  }
  async function refreshBackendSummaries() {
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
    } catch {
    }
  }

  // community/plugins/stock-enhancer/src/context-ring/popover.ts
  var activePopover = null;
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
    const metrics = getCachedMetrics();
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
        <span>~${formatTokens(metrics?.modelTokens || Math.round(used * 0.4))}</span>
      </div>
      <div class="ag-stock-breakdown-row">
        <span>Tool Executions & Files</span>
        <span>~${formatTokens(metrics?.toolTokens || Math.round(used * 0.2))}</span>
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
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="6" y1="3" x2="6" y2="15"></line>
          <circle cx="18" cy="6" r="3"></circle>
          <circle cx="6" cy="18" r="3"></circle>
          <path d="M18 9a9 9 0 0 1-9 9"></path>
        </svg>
        <span>Fork</span>
      </button>
    </div>
  `;
    document.body.appendChild(popover);
    positionFloatingElement(popover, anchor, 10);
    activePopover = popover;
    const compactBtn = popover.querySelector(".ag-stock-compact-btn");
    compactBtn?.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (compactBtn.disabled) return;
      compactBtn.disabled = true;
      compactBtn.classList.add("compacting");
      anchor.classList.add("ag-stock-ring-compacting");
      const barFill = popover.querySelector(".ag-stock-bar-fill");
      barFill?.classList.add("compacting");
      compactBtn.innerHTML = `
      <svg class="ag-stock-spinner" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <circle cx="12" cy="12" r="9" stroke-opacity="0.25"></circle>
        <path d="M12 3a9 9 0 0 1 9 9" stroke-linecap="round"></path>
      </svg>
      <span>Compacting...</span>
    `;
      try {
        if (settings.soundNotifications) {
          const ctx = getAudioContext();
          if (ctx) {
            const now = ctx.currentTime;
            playSingleNote(ctx, now, 523.25, 0.08, 0.1, "sine");
            playSingleNote(ctx, now + 0.08, 659.25, 0.12, 0.12, "sine");
          }
        }
      } catch {
      }
      try {
        const activeSessionId = getActiveConversationId();
        let res = null;
        if (plugin?.account?.compactContext) {
          res = await plugin.account.compactContext(activeSessionId);
        }
        await fetchMetrics(true);
        const reclaimedPercent = res?.reclaimedPercentage ?? (res?.reclaimedTokens && res?.originalTokens ? Math.round(res.reclaimedTokens / res.originalTokens * 100) : 0);
        const successLabel = reclaimedPercent ? `\u2714 -${reclaimedPercent}% Reclaimed` : `\u2714 Compacted!`;
        compactBtn.classList.remove("compacting");
        compactBtn.classList.add("success");
        compactBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>${successLabel}</span>
      `;
        barFill?.classList.remove("compacting");
        anchor.classList.remove("ag-stock-ring-compacting");
        anchor.classList.add("ag-stock-ring-success");
        updateRingUI(anchor);
        const updatedMetrics = getCachedMetrics();
        if (updatedMetrics) {
          const newUsed = updatedMetrics.used || 0;
          const newLimit = updatedMetrics.limit || limit;
          const newRatio = Math.min(Math.max(newUsed / newLimit, 0), 1);
          const newPct = Math.round(newRatio * 100);
          const usedLabel = popover.querySelector(".ag-stock-popover-used");
          if (usedLabel) usedLabel.textContent = `${formatTokens(newUsed)} tokens (${newPct}%)`;
          const totalLabel = popover.querySelector(".ag-stock-popover-total");
          if (totalLabel) totalLabel.textContent = `of ${formatTokens(newLimit)} cap`;
          if (barFill) barFill.style.width = `${newPct}%`;
        }
        try {
          if (settings.soundNotifications) {
            const ctx = getAudioContext();
            if (ctx) {
              const now = ctx.currentTime;
              playSingleNote(ctx, now, 587.33, 0.1, 0.12, "sine");
              playSingleNote(ctx, now + 0.09, 880, 0.22, 0.15, "sine");
            }
          }
        } catch {
        }
        setTimeout(() => {
          anchor.classList.remove("ag-stock-ring-success");
          closeContextPopover();
        }, 1200);
      } catch {
        barFill?.classList.remove("compacting");
        anchor.classList.remove("ag-stock-ring-compacting");
        compactBtn.classList.remove("compacting");
        compactBtn.innerHTML = `<span>Compact Failed</span>`;
        setTimeout(() => {
          compactBtn.disabled = false;
          compactBtn.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="4 14 10 14 10 20"></polyline>
            <polyline points="20 10 14 10 14 4"></polyline>
            <line x1="14" y1="10" x2="21" y2="3"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
          </svg>
          <span>Compact</span>
        `;
        }, 1500);
      }
    });
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
        forkBtn.innerHTML = `<span>\u2714 Forked</span>`;
        setTimeout(async () => {
          closeContextPopover();
          await navigateToConversation(res.newCascadeId, res.newProjectId);
        }, 400);
      } catch {
        forkBtn.innerHTML = `<span>Fork Failed</span>`;
        setTimeout(() => {
          forkBtn.disabled = false;
          forkBtn.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="6" y1="3" x2="6" y2="15"></line>
            <circle cx="18" cy="6" r="3"></circle>
            <circle cx="6" cy="18" r="3"></circle>
            <path d="M18 9a9 9 0 0 1-9 9"></path>
          </svg>
          <span>Fork</span>
        `;
        }, 2e3);
      }
    });
  }
  function setupPopoverDocumentDismissal() {
    const onDocClick = (e) => {
      if (activePopover && !activePopover.contains(e.target) && !e.target.closest(".ag-stock-ring-sibling, .ag-stock-ring-side, .ag-stock-ring-hitbox, .ag-stock-ring-container")) {
        closeContextPopover();
      }
    };
    document.addEventListener("click", onDocClick, true);
    plugin.onDispose(() => document.removeEventListener("click", onDocClick, true));
  }

  // community/plugins/stock-enhancer/src/scroll/index.ts
  function ensureJumpToBottom() {
    if (!settings.enableJumpToBottom) {
      document.querySelectorAll(".ag-stock-jump-button").forEach((el) => el.remove());
      return;
    }
    const view = document.querySelector(CONVERSATION_VIEW_SELECTOR);
    if (!view) return;
    let jumpBtn = view.querySelector(".ag-stock-jump-button");
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
  function setupScrollDejitter() {
  }
  var recentScrollCache = /* @__PURE__ */ new Map();
  var lastActiveCascadeId = "";
  function checkConversationSwitch() {
    if (document.hidden) return;
    const currentId = getActiveConversationId();
    if (!currentId) return;
    if (currentId !== lastActiveCascadeId) {
      const view = document.querySelector(CONVERSATION_VIEW_SELECTOR);
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
      if (view && recentScrollCache.has(currentId)) {
        const targetScroll = recentScrollCache.get(currentId);
        requestAnimationFrame(() => {
          if (view.isConnected) view.scrollTop = targetScroll;
        });
      }
      fetchMetrics(true).then(() => {
        const ring = document.querySelector(".ag-stock-ring-sibling");
        if (ring) updateRingUI(ring);
      });
    }
  }
  function setupInstantChatSwitching() {
    checkConversationSwitch();
  }

  // community/plugins/stock-enhancer/src/context-ring/index.ts
  var cachedMetrics = null;
  var lastMetricsFetch = 0;
  var isFetchingMetrics = false;
  function getCachedMetrics() {
    return cachedMetrics;
  }
  function setCachedMetrics(val) {
    cachedMetrics = val;
  }
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
    } catch {
    } finally {
      isFetchingMetrics = false;
    }
    return cachedMetrics;
  }
  function ensureContextRing() {
    if (!settings.enableProgressRing) {
      document.querySelectorAll(".ag-stock-ring-sibling, .ag-stock-ring-hitbox, .ag-stock-ring-separator, .ag-stock-ring-container").forEach((el) => el.remove());
      return;
    }
    const trigger = document.querySelector(MODEL_TRIGGER_SELECTOR);
    if (!trigger) return;
    const existingRing = trigger.parentElement?.querySelector(".ag-stock-ring-sibling");
    if (existingRing && trigger.nextSibling === existingRing && existingRing.isConnected) {
      return;
    }
    trigger.querySelectorAll(".ag-stock-ring-hitbox, .ag-stock-ring-separator, .ag-stock-ring-container").forEach((el) => el.remove());
    trigger.style.removeProperty("background-color");
    trigger.style.removeProperty("box-shadow");
    if (trigger.parentElement) {
      trigger.parentElement.style.setProperty("display", "inline-flex", "important");
      trigger.parentElement.style.setProperty("flex-direction", "row", "important");
      trigger.parentElement.style.setProperty("align-items", "center", "important");
      trigger.parentElement.style.setProperty("flex-wrap", "nowrap", "important");
      trigger.parentElement.style.setProperty("vertical-align", "middle", "important");
    }
    trigger.style.setProperty("display", "inline-flex", "important");
    trigger.style.setProperty("align-items", "center", "important");
    trigger.style.setProperty("flex", "0 0 auto", "important");
    trigger.style.setProperty("width", "auto", "important");
    trigger.style.setProperty("max-width", "fit-content", "important");
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
      ringSibling.addEventListener("mouseenter", () => showTooltip(ringSibling, cachedMetrics));
      ringSibling.addEventListener("mouseleave", hideTooltip);
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
  function ensureNativeProCore() {
    ensureContextRing();
    ensureJumpToBottom();
  }
  function setupNativeProLifecycle() {
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

  // community/plugins/stock-enhancer/src/metrics/index.ts
  var trackedResponses = /* @__PURE__ */ new WeakSet();
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
    const interval = setInterval(inspectAssistantResponses, 1e3);
    plugin.onDispose(() => clearInterval(interval));
  }

  // community/plugins/stock-enhancer/src/terminal/index.ts
  var terminalSplitUserOverride = null;
  function isTerminalSplitVertical(containerWidth) {
    if (terminalSplitUserOverride === "vertical") return true;
    if (terminalSplitUserOverride === "horizontal") return false;
    const mode = settings.terminalSplitMode || "auto";
    if (mode === "vertical") return true;
    if (mode === "horizontal") return false;
    return containerWidth < 460;
  }
  function updateTerminalSplitLayout() {
    const splitRow = document.querySelector(".flex.flex-row.w-full.h-full.min-w-0.min-h-0");
    if (!splitRow) return;
    const children = Array.from(splitRow.children);
    const terminalPanes = children.filter((c) => !c.classList.contains("cursor-col-resize") && !c.classList.contains("cursor-row-resize") && !c.classList.contains("ag-terminal-split-divider"));
    if (terminalPanes.length >= 2) {
      const containerWidth = splitRow.clientWidth || 300;
      const shouldBeVertical = isTerminalSplitVertical(containerWidth);
      if (shouldBeVertical) {
        if (!splitRow.classList.contains("ag-terminal-split-vertical")) {
          splitRow.classList.add("ag-terminal-split-vertical");
          splitRow.style.setProperty("flex-direction", "column", "important");
          const divider = splitRow.querySelector('div[class*="cursor-col-resize"]');
          if (divider) {
            divider.classList.add("ag-terminal-split-divider");
            divider.style.setProperty("cursor", "row-resize", "important");
          }
          requestAnimationFrame(() => {
            window.dispatchEvent(new Event("resize"));
          });
        }
      } else {
        if (splitRow.classList.contains("ag-terminal-split-vertical")) {
          splitRow.classList.remove("ag-terminal-split-vertical");
          splitRow.style.removeProperty("flex-direction");
          const divider = splitRow.querySelector(".ag-terminal-split-divider");
          if (divider) {
            divider.classList.remove("ag-terminal-split-divider");
            divider.style.removeProperty("cursor");
          }
          requestAnimationFrame(() => {
            window.dispatchEvent(new Event("resize"));
          });
        }
      }
    }
    ensureTerminalOrientationButton();
  }
  function ensureTerminalOrientationButton() {
    const terminalHeaders = Array.from(
      document.querySelectorAll('div[aria-label="Terminal header"], div[class*="items-center"][class*="justify-between"]')
    ).filter((h) => h.getAttribute("aria-label") === "Terminal header" || h.querySelector('[data-testid="terminal-add-button"]') || Array.from(h.querySelectorAll("span")).some((s) => s.textContent?.trim() === "Terminals"));
    for (const header of terminalHeaders) {
      if (header.querySelector(".ag-terminal-orientation-btn")) continue;
      const actionGroup = header.querySelector(".flex.items-center.gap-1:last-child") || header.lastElementChild;
      if (!actionGroup) continue;
      const splitRow = document.querySelector(".flex.flex-row.w-full.h-full.min-w-0.min-h-0");
      const containerWidth = splitRow?.clientWidth || 260;
      const isVertical = isTerminalSplitVertical(containerWidth);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ag-terminal-orientation-btn";
      btn.setAttribute("aria-label", "Toggle Split Stacking");
      btn.setAttribute("title", isVertical ? "Switch to Side-by-Side Split" : "Switch to Stacked Top/Bottom Split");
      btn.style.setProperty("app-region", "no-drag");
      const renderIcon = (vertical) => {
        btn.innerHTML = vertical ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2"/>
            <path d="M3 12h18"/>
          </svg>` : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2"/>
            <path d="M12 3v18"/>
          </svg>`;
        btn.setAttribute("title", vertical ? "Switch to Side-by-Side Split (Horizontal)" : "Switch to Stacked Top/Bottom Split (Vertical)");
      };
      renderIcon(isVertical);
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const currentVert = isTerminalSplitVertical(containerWidth);
        terminalSplitUserOverride = currentVert ? "horizontal" : "vertical";
        renderIcon(!currentVert);
        updateTerminalSplitLayout();
      });
      actionGroup.prepend(btn);
    }
  }
  function setupSplitTerminalEnhancer() {
    updateTerminalSplitLayout();
    const termObserver = new MutationObserver(() => {
      updateTerminalSplitLayout();
    });
    const targetNode = document.body || document.documentElement;
    if (targetNode) {
      termObserver.observe(targetNode, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class", "data-active-tab-id"]
      });
    }
    window.addEventListener("resize", updateTerminalSplitLayout);
    plugin.onDispose(() => {
      termObserver.disconnect();
      window.removeEventListener("resize", updateTerminalSplitLayout);
      for (const btn of document.querySelectorAll(".ag-terminal-orientation-btn")) {
        btn.remove();
      }
      for (const split of document.querySelectorAll(".ag-terminal-split-vertical")) {
        split.classList.remove("ag-terminal-split-vertical");
        split.style.removeProperty("flex-direction");
      }
    });
  }

  // community/plugins/stock-enhancer/src/side-question/overlay.ts
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
        <span class="bg-toast-badge">Decision Needed</span>
        <button class="bg-toast-close" type="button" title="Dismiss">\u2715</button>
      </div>
      <div class="bg-toast-question">${question}</div>
      <div class="bg-toast-options">${optionsHtml}</div>
      ${writeInHtml}
      <div class="bg-toast-footer">Click outside or press card to bring editor into focus</div>
    </div>
  `;
    const onDocClick = (e) => {
      const rect = container.getBoundingClientRect();
      const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (!inside) {
        document.removeEventListener("click", onDocClick, true);
        Overlay.close();
      }
    };
    setTimeout(() => {
      document.addEventListener("click", onDocClick, true);
    }, 100);
    const btns = container.querySelectorAll(".bg-toast-btn");
    for (const btn of btns) {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute("data-index") || "0", 10);
        Overlay.send({ action: "select", index: idx });
        Overlay.close();
      });
    }
    const writeInInput = container.querySelector(".bg-toast-writein-input");
    const writeInBtn = container.querySelector(".bg-toast-writein-submit");
    if (writeInInput && writeInBtn) {
      const submitCustom = () => {
        const text = writeInInput.value.trim();
        if (text) {
          Overlay.send({ action: "writein", text });
          Overlay.close();
        }
      };
      writeInBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        submitCustom();
      });
      writeInInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.stopPropagation();
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
      if (e.target.closest(".bg-toast-btn") || e.target.closest(".bg-toast-close") || e.target.closest(".bg-toast-writein-container")) {
        return;
      }
      Overlay.focusOwner();
      Overlay.close();
    });
    return container;
  }
  var toastOverlayStyles = `
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
  var activeOverlayHandle = null;
  function setActiveOverlayHandle(handle) {
    activeOverlayHandle = handle;
  }
  async function showDesktopQuestionOverlay(prompt) {
    if (!plugin.overlay?.open) return;
    if (!settings.grillNotifications) return;
    if (activeOverlayHandle) {
      try {
        await activeOverlayHandle.close();
      } catch {
      }
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
      plugin.log?.error?.("Failed to show desktop question overlay:", err);
    }
  }

  // community/plugins/stock-enhancer/src/side-question/toast.ts
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
    const card = continueBtn?.closest(".relative.flex.flex-col.p-px.rounded-2xl.bg-card-border.w-full") || continueBtn?.closest(".bg-card")?.parentElement || continueBtn?.closest('[role="dialog"]') || continueBtn?.closest(".chat-confirmation-widget2") || confirmationBtn?.closest(".chat-confirmation-widget2") || confirmationBtn?.closest('[role="dialog"]') || document.querySelector('.chat-confirmation-widget2, [role="dialog"]');
    let questionText = "";
    if (card) {
      const heading = card.querySelector('h1, h2, h3, h4, [class*="font-semibold"], [class*="font-medium"], [class*="text-base"]');
      if (heading) {
        questionText = heading.innerText?.trim() || "";
      }
      if (!questionText) {
        const p = card.querySelector("p");
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
          const parent = input.closest("label") || input.parentElement;
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
      const submitBtn = document.querySelector('[data-testid="interaction-continue-button"]') || document.querySelector('[data-testid="confirmation-confirm"]') || document.querySelector('[aria-label*="Allow using this MCP tool"]');
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
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
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
  var activePromptToast = null;
  var lastDispatchedPromptId = "";
  function closeActivePromptToast() {
    if (activePromptToast) {
      try {
        activePromptToast.close();
      } catch {
      }
      activePromptToast = null;
    }
  }
  var hasActiveApproval = false;
  function checkAndDispatchQuestionToast() {
    try {
      const approval = document.querySelector(APPROVAL_SELECTOR) !== null;
      if (!approval) {
        if (hasActiveApproval) {
          hasActiveApproval = false;
          lastDispatchedPromptId = "";
          closeActivePromptToast();
          if (activeOverlayHandle) {
            try {
              activeOverlayHandle.close();
            } catch {
            }
            setActiveOverlayHandle(null);
          }
        }
        return;
      }
      hasActiveApproval = true;
      if (settings.notifyInBackgroundOnly && !isOutsideApp()) {
        if (activeOverlayHandle) {
          try {
            activeOverlayHandle.close();
          } catch {
          }
          setActiveOverlayHandle(null);
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
      plugin.log?.info?.("Dispatching question toast for:", prompt.id);
      playAlertSound("approval");
      sendInteractiveQuestionToast(prompt);
      showDesktopQuestionOverlay(prompt);
    } catch (err) {
      plugin.log?.error?.("checkAndDispatchQuestionToast error:", String(err));
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
      closeActivePromptToast();
      const options = prompt.options || [];
      const maxActions = typeof Notification !== "undefined" && Notification.maxActions ? Notification.maxActions : 2;
      const actions = [];
      if (settings.grillQuickActions && options.length > 0) {
        for (let i = 0; i < Math.min(options.length, maxActions); i++) {
          const cleanTitle = options[i].text.replace(/^[0-9]+[.:\s]*/, "").trim().slice(0, 20);
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
      const title = options.length > 0 ? "\u{1F373} Grill Me: Decision Needed" : "Antigravity: Approval Needed";
      let notif;
      try {
        notif = new Notification(title, {
          body: bodyText.slice(0, 300),
          requireInteraction: true,
          actions: actions.length > 0 ? actions : void 0,
          silent: true
          // sound is synthesized harmonically by playAlertSound
        });
      } catch {
        notif = new Notification(title, {
          body: bodyText.slice(0, 300),
          requireInteraction: true,
          silent: true
        });
      }
      plugin.log?.info?.("Toast notification created:", title);
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
          plugin.log?.error?.("Failed to select option from toast action:", err);
        }
      };
      notif.onclick = () => {
        try {
          window.focus();
        } catch {
        }
      };
      notif.onclose = () => {
        if (activePromptToast === notif) activePromptToast = null;
      };
      activePromptToast = notif;
    } catch (err) {
      plugin.log?.error?.("Error showing interactive toast:", err);
    }
  }
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

  // community/plugins/stock-enhancer/src/side-question/panel.ts
  function insertToMainComposer(text) {
    const input = document.querySelector('[role="combobox"][contenteditable="true"]') || document.querySelector('[data-testid="agent-input-box"] [contenteditable="true"]');
    if (!input) return;
    input.focus();
    try {
      document.execCommand("insertText", false, text);
    } catch (_) {
      input.textContent = (input.textContent || "") + text;
    }
  }
  function dispatchNativeSideQuestion(questionText) {
    const input = document.querySelector('[role="combobox"][contenteditable="true"]') || document.querySelector('[data-testid="agent-input-box"] [contenteditable="true"]');
    if (!input) return false;
    const k = Object.keys(input).find((k2) => k2.startsWith("__reactFiber"));
    let f = k ? input[k] : null;
    let hs = null;
    for (let i = 0; f && i < 35; i++, f = f.return) {
      if (typeof f.memoizedProps?.handleSubmit === "function") {
        hs = f.memoizedProps.handleSubmit;
        break;
      }
    }
    if (!hs) return false;
    const items = [
      {
        chunk: {
          case: "item",
          value: {
            scopeItem: {
              case: "recipe",
              value: { recipeId: "btw", title: "btw" }
            }
          }
        }
      },
      {
        chunk: {
          case: "text",
          value: questionText
        }
      }
    ];
    try {
      hs(items, [], () => {
      }, {}, void 0, void 0);
      return true;
    } catch (e) {
      console.debug("[StockEnhancer] Failed to dispatch side question:", e);
      return false;
    }
  }
  function getCleanAnswerText(el) {
    if (!el) return "";
    const clone = el.cloneNode(true);
    clone.querySelectorAll("style, script, .ag-native-side-followup-wrap").forEach((n) => n.remove());
    return clone.textContent?.trim() || "";
  }
  function updateNativeSideQuestionUI() {
    const panel = document.querySelector('[data-testid="side-question-panel"]');
    if (!panel) return;
    const questionEl = panel.querySelector('[data-testid="side-question-question"]');
    const answerEl = panel.querySelector('[data-testid="side-question-answer"]');
    if (!questionEl || !answerEl) return;
    const isThinking = !!panel.querySelector(".animate-pulse") || (answerEl.textContent || "").trim() === "Thinking...";
    let followupWrap = panel.querySelector(".ag-native-side-followup-wrap");
    if (!followupWrap) {
      followupWrap = document.createElement("div");
      followupWrap.className = "ag-native-side-followup-wrap";
      followupWrap.innerHTML = `
      <div class="ag-native-side-input-row">
        <input type="text" class="ag-native-side-input" placeholder="Ask a follow-up on this answer... (Enter to send)" />
        <button type="button" class="ag-native-side-send-btn" title="Send follow-up">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
        <button type="button" class="ag-native-side-action-btn ag-native-side-insert-btn" title="Insert answer into main composer">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 10 4 15 9 20"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/></svg>
          <span>Insert</span>
        </button>
      </div>
      <div class="ag-native-side-status-row" style="display:none;">
        <div class="ag-native-side-spinner"></div>
        <span>Antigravity is answering...</span>
      </div>
    `;
      const input2 = followupWrap.querySelector(".ag-native-side-input");
      const sendBtn2 = followupWrap.querySelector(".ag-native-side-send-btn");
      const insertBtn = followupWrap.querySelector(".ag-native-side-insert-btn");
      const submitFollowup = () => {
        if (!input2) return;
        const text = input2.value.trim();
        const currentThinking = !!panel.querySelector(".animate-pulse") || (answerEl.textContent || "").trim() === "Thinking...";
        if (!text || currentThinking) return;
        const currentQ = questionEl.textContent?.replace(/^Side Question:\s*/i, "").trim() || "";
        const shortQ = currentQ.length > 120 ? currentQ.slice(0, 117) + "..." : currentQ;
        const prompt = `Follow-up to "${shortQ}": ${text}`;
        input2.value = "";
        const ok = dispatchNativeSideQuestion(prompt);
        if (!ok) {
          input2.value = text;
        }
      };
      input2?.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          submitFollowup();
        }
      });
      sendBtn2?.addEventListener("click", () => {
        submitFollowup();
      });
      insertBtn?.addEventListener("click", () => {
        const currentAns = getCleanAnswerText(answerEl);
        if (currentAns) {
          insertToMainComposer(currentAns);
        }
      });
      panel.appendChild(followupWrap);
    }
    const input = followupWrap.querySelector(".ag-native-side-input");
    const sendBtn = followupWrap.querySelector(".ag-native-side-send-btn");
    const statusRow = followupWrap.querySelector(".ag-native-side-status-row");
    if (input && sendBtn && statusRow) {
      input.disabled = isThinking;
      sendBtn.disabled = isThinking;
      statusRow.style.display = isThinking ? "flex" : "none";
      if (isThinking) {
        input.placeholder = "Antigravity is thinking... please wait";
      } else {
        input.placeholder = "Ask a follow-up on this answer... (Enter to send)";
      }
    }
  }
  function setupNativeSideQuestionEnhancer() {
    updateNativeSideQuestionUI();
    const obs = new MutationObserver(() => {
      updateNativeSideQuestionUI();
    });
    const targetNode = document.body || document.documentElement;
    obs.observe(targetNode, {
      childList: true,
      subtree: true
    });
    plugin.onDispose(() => {
      obs.disconnect();
      for (const wrap of document.querySelectorAll(".ag-native-side-followup-wrap")) {
        wrap.remove();
      }
    });
  }

  // community/plugins/stock-enhancer/src/side-question/state.ts
  function isInputBoxBusy() {
    const inputBox = document.querySelector(INPUT_BOX_SELECTOR) || document.querySelector('[data-testid="agent-input-box"]');
    const hasInputBusy = inputBox ? inputBox.querySelector('[data-tooltip-id="input-send-button-cancel-tooltip"], [data-testid="stop-button"], [data-testid="cancel-button"], [aria-label="Stop execution"], button svg.animate-spin') !== null : false;
    const hasViewBusy = document.querySelector(
      '[data-testid="conversation-view"] .animate-spin, [data-testid="conversation-view"] [data-testid="status-loading-spinner"], [data-testid="conversation-view"] [data-status="thinking"], [data-testid="conversation-view"] [data-status="running"], [data-testid="conversation-view"] button[aria-label*="Stop"], [data-testid="conversation-view"] [data-testid="stop-button"]'
    ) !== null;
    return hasInputBusy || hasViewBusy;
  }
  var isAgentBusy = false;
  var stateWatcherTimer = 0;
  function setupStateWatcher() {
    const checkState = () => {
      try {
        ensureNativeProCore();
        const busy = isInputBoxBusy();
        const approval = document.querySelector(APPROVAL_SELECTOR) !== null;
        checkConversationSwitch();
        checkAndDispatchQuestionToast();
        if (isAgentBusy && !busy) {
          isAgentBusy = false;
          if (!approval) {
            playAlertSound("complete");
          }
        } else if (!isAgentBusy && busy) {
          isAgentBusy = true;
        }
      } catch {
      }
    };
    stateWatcherTimer = setInterval(checkState, 400);
    plugin.onDispose(() => clearInterval(stateWatcherTimer));
    const onBlur = () => {
      checkAndDispatchQuestionToast();
    };
    const onFocus = () => {
      if (settings.notifyInBackgroundOnly && activeOverlayHandle) {
        try {
          activeOverlayHandle.close();
        } catch {
        }
      }
    };
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    plugin.onDispose(() => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    });
  }

  // community/plugins/stock-enhancer/src/projects/helpers.ts
  function getSidebarSectionsProvider() {
    try {
      const anchors = [
        document.querySelector('[data-testid="conversation-row-sidebar"]'),
        document.querySelector('[data-project-card="true"]'),
        document.querySelector('[data-testid="agent-input-box"]'),
        document.querySelector(CONVERSATION_VIEW_SELECTOR),
        document.body.firstElementChild,
        document.body
      ].filter(Boolean);
      for (const el of anchors) {
        const key = Object.keys(el).find((k) => k.startsWith("__reactFiber"));
        if (!key) continue;
        let f = el[key];
        while (f) {
          const provider = f.memoizedProps?.syncedState?.sidebarSectionsProvider;
          if (provider && typeof provider.getState === "function") {
            return provider;
          }
          f = f.return;
        }
      }
      const candidates = document.querySelectorAll('[data-testid], [class*="sidebar"]');
      for (let i = 0; i < candidates.length; i++) {
        const el = candidates[i];
        const key = Object.keys(el).find((k) => k.startsWith("__reactFiber"));
        if (!key) continue;
        let f = el[key];
        while (f) {
          const provider = f.memoizedProps?.syncedState?.sidebarSectionsProvider;
          if (provider && typeof provider.getState === "function") {
            return provider;
          }
          f = f.return;
        }
      }
    } catch {
    }
    return null;
  }
  var cachedBridgeProjects = [];
  function syncBridgeProjects() {
    try {
      const bridge = window.__betterGravityBridge;
      if (bridge && typeof bridge.getProjects === "function") {
        bridge.getProjects().then((projs) => {
          if (Array.isArray(projs) && projs.length > 0) {
            cachedBridgeProjects = projs;
          }
        }).catch(() => {
        });
      }
    } catch {
    }
  }
  function getAvailableProjectsList() {
    const provider = getSidebarSectionsProvider();
    const list = [];
    for (const bp of cachedBridgeProjects) {
      if (bp.projectId && !list.some((p) => p.projectId === bp.projectId)) {
        list.push({
          projectId: bp.projectId,
          label: bp.label || "Project",
          conversations: [],
          count: bp.count || 0
        });
      }
    }
    if (provider) {
      try {
        const sections = provider.getState?.()?.sidebarSections || [];
        for (const s of sections) {
          const pid = s.uri || s.projectId;
          if (pid && !list.some((p) => p.projectId === pid)) {
            list.push({
              projectId: pid,
              label: s.title || s.label || s.name || "Project",
              conversations: Array.isArray(s.conversations) ? s.conversations : [],
              count: Array.isArray(s.conversations) ? s.conversations.length : 0
            });
          }
        }
      } catch {
      }
    }
    const projectHeaders = document.querySelectorAll(
      '.group\\/header:has(a[href*="section="]), [data-project-card="true"], a[href*="section="]'
    );
    for (const ph of projectHeaders) {
      let pid = ph.getAttribute("data-project-id") || "";
      if (!pid) {
        const href = ph.getAttribute("href") || ph.querySelector("a")?.getAttribute("href") || "";
        const match = href.match(/section=([^&]+)/);
        if (match && match[1]) pid = decodeURIComponent(match[1]);
      }
      const label = ph.textContent?.split("\n")?.[0]?.trim();
      if (pid && label && !list.some((p) => p.projectId === pid)) {
        list.push({
          projectId: pid,
          label,
          conversations: [],
          count: 0
        });
      }
    }
    const KNOWN_PROJECT_RECORDS = [
      { projectId: "838fa185-fbbc-4f2b-8e50-df00fb3956b4", label: "LikhangKamay" },
      { projectId: "348e9acc-cd1b-42b4-8bdf-5d7ec61c87f8", label: "SIDEPROJECTS" },
      { projectId: "b71fae7c-9892-4961-8d15-85b4de39ea50", label: "talastaswp" },
      { projectId: "ad1aae76-3c67-455f-85a3-5e8da5a6776d", label: "Pastil ni Liling" },
      { projectId: "12ee24de-59b9-45c0-a9cc-c4aa99f71eae", label: "lechonsystem" },
      { projectId: "1da013dd-3b1a-4dc7-a861-a3a30434147e", label: "Photobooth" },
      { projectId: "78fbb772-98ff-4c3f-820b-ff2483211a87", label: "Agent Harness" },
      { projectId: "default-cli-project", label: "CLI Project" }
    ];
    for (const k of KNOWN_PROJECT_RECORDS) {
      if (!list.some((p) => p.projectId === k.projectId)) {
        list.push({ projectId: k.projectId, label: k.label, conversations: [], count: 0 });
      }
    }
    return list;
  }
  async function executeMoveConversation(conversationId, targetProjectId) {
    if (!conversationId) return { success: false, message: "No conversation selected" };
    try {
      const projects = getAvailableProjectsList();
      const targetProj = projects.find((p) => p.projectId === targetProjectId);
      const targetLabel = targetProj?.label || (targetProjectId === "outside-of-project" ? "" : "Project");
      const bridge = window.__betterGravityBridge;
      if (bridge && typeof bridge.moveConversation === "function") {
        const res = await bridge.moveConversation(conversationId, targetProjectId);
        if (!res?.success) {
          console.warn("[StockEnhancer] moveConversation bridge warning:", res?.message);
        }
      }
      const projMap = window.__bettergravityConversationProjectMap;
      if (projMap) {
        if (targetProjectId === "outside-of-project") {
          projMap.set(conversationId + ":override", "outside-of-project");
          projMap.delete(conversationId);
          projMap.delete(conversationId + ":groupId");
        } else {
          projMap.set(conversationId + ":override", targetProjectId);
          projMap.set(conversationId, targetLabel);
          projMap.set(conversationId + ":groupId", targetProjectId);
        }
      }
      const provider = getSidebarSectionsProvider();
      if (provider) {
        const state = provider.getState();
        const sections = state?.sidebarSections || [];
        let foundConvoItem = null;
        for (const sec of sections) {
          if (Array.isArray(sec.conversations)) {
            const idx = sec.conversations.findIndex((c) => (c.conversationId || c.id) === conversationId);
            if (idx !== -1) {
              foundConvoItem = sec.conversations.splice(idx, 1)[0];
              break;
            }
          }
        }
        if (foundConvoItem && targetProjectId !== "outside-of-project") {
          let targetSec = sections.find((s) => (s.uri || s.projectId) === targetProjectId);
          if (targetSec) {
            if (!Array.isArray(targetSec.conversations)) targetSec.conversations = [];
            targetSec.conversations.unshift(foundConvoItem);
          }
        }
        try {
          if (typeof provider.emitter?.fire === "function") {
            provider.emitter.fire(provider.getState());
          }
          if (typeof provider.refresh === "function") {
            provider.refresh();
          }
        } catch {
        }
      }
      try {
        if (typeof window.__bettergravityTriggerListRerender === "function") {
          window.__bettergravityTriggerListRerender();
        }
        window.dispatchEvent(new Event("resize"));
      } catch {
      }
      try {
        const row = document.querySelector(
          `[data-testid="conversation-row-sidebar"][data-cascade-id="${conversationId}"], [data-testid="conversation-row-sidebar"]:has(a[href*="${conversationId}"])`
        );
        if (row) {
          const dropTarget = document.querySelector(
            `.group\\/header:has(a[href*="${encodeURIComponent(targetProjectId)}"]), [data-project-card="true"][data-project-id="${targetProjectId}"]`
          );
          if (dropTarget && dropTarget.parentElement) {
            dropTarget.parentElement.insertBefore(row, dropTarget.nextSibling);
          }
          row.classList.add("ag-project-drop-success");
          setTimeout(() => row.classList.remove("ag-project-drop-success"), 800);
        }
      } catch {
      }
      try {
        const client = getAntigravityLsClient();
        if (client && typeof client.getAllCascadeTrajectories === "function") {
          resetLsClientPollTime();
          await refreshBackendSummaries();
        }
      } catch {
      }
      playAlertSound("complete");
      return { success: true };
    } catch (err) {
      console.error("[StockEnhancer] Failed to execute moveConversation:", err);
      return { success: false, message: String(err) };
    }
  }

  // community/plugins/stock-enhancer/src/projects/modal.ts
  async function openMoveProjectPickerModal(conversationId, conversationTitle) {
    const existing = document.querySelector(".ag-move-project-overlay");
    if (existing) existing.remove();
    if (cachedBridgeProjects.length === 0 && window.__betterGravityBridge?.getProjects) {
      try {
        const projs = await window.__betterGravityBridge.getProjects();
        if (Array.isArray(projs) && projs.length > 0) {
          cachedBridgeProjects.splice(0, cachedBridgeProjects.length, ...projs);
        }
      } catch {
      }
    }
    const projects = getAvailableProjectsList();
    let currentProjectId = "outside-of-project";
    const mappedGid = window.__bettergravityConversationProjectMap?.get(conversationId + ":groupId");
    const overrideGid = window.__bettergravityConversationProjectMap?.get(conversationId + ":override");
    if (overrideGid === "outside-of-project") {
      currentProjectId = "outside-of-project";
    } else if (overrideGid) {
      currentProjectId = overrideGid;
    } else if (mappedGid) {
      currentProjectId = mappedGid;
    } else {
      for (const p of projects) {
        if (p.conversations.some((c) => (c.conversationId || c.id) === conversationId)) {
          currentProjectId = p.projectId;
          break;
        }
      }
    }
    const allTargets = [
      { projectId: "outside-of-project", label: "Outside of Project (General Chat)", count: 0 },
      ...projects
    ];
    const overlay = document.createElement("div");
    overlay.className = "ag-move-project-overlay";
    const modal = document.createElement("div");
    modal.className = "ag-move-project-modal";
    modal.innerHTML = `
    <div class="ag-move-project-header">
      <span>Move to Project / Folder</span>
      <button class="ag-move-project-close-btn" type="button" title="Close">\u2715</button>
    </div>
    <div class="ag-move-project-subtitle">
      Moving: <strong>${escapeHtml(conversationTitle || "Conversation")}</strong>
    </div>
    <div class="ag-move-project-list">
      ${allTargets.map((p) => {
      const isCurrent = p.projectId === currentProjectId;
      return `
          <button class="ag-move-project-item ${isCurrent ? "ag-move-project-item-current" : ""}"
                  data-project-id="${escapeHtml(p.projectId)}"
                  ${isCurrent ? 'disabled title="Currently in this project"' : ""}
                  type="button">
            <span class="ag-move-project-item-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
            </span>
            <span class="ag-move-project-item-title">${escapeHtml(p.label || "Untitled Project")}</span>
            <span class="ag-move-project-item-badge">${isCurrent ? "Current" : p.projectId === "outside-of-project" ? "General" : `${p.count} convos`}</span>
          </button>
        `;
    }).join("")}
    </div>
  `;
    const close = () => {
      overlay.remove();
    };
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    modal.querySelector(".ag-move-project-close-btn")?.addEventListener("click", close);
    for (const btn of modal.querySelectorAll(".ag-move-project-item:not([disabled])")) {
      btn.addEventListener("click", async () => {
        const targetId = btn.getAttribute("data-project-id") || "";
        close();
        await executeMoveConversation(conversationId, targetId);
      });
    }
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  // community/plugins/stock-enhancer/src/projects/dnd.ts
  function findConversationElementId(el) {
    if (!el) return null;
    if (el.closest?.('.ag-convo-toast, .ag-convo-toast-stack, [data-testid="conversation-view"], main')) return null;
    const row = el.closest('[data-testid="conversation-row-sidebar"], [data-testid="conversation-row-history"], nav a[href*="/c/"], aside a[href*="/c/"]');
    if (row) {
      if (row.closest('.ag-convo-toast, .ag-convo-toast-stack, [data-testid="conversation-view"], main')) return null;
      const directId = row.getAttribute("data-cascade-id") || row.getAttribute("data-conversation-id");
      if (directId) return { element: row, id: directId };
      const link = row.matches?.('a[href*="/c/"]') ? row : row.querySelector?.('a[href*="/c/"]');
      const href = link?.getAttribute("href") || "";
      const m = href.match(/\/c\/([a-zA-Z0-9_-]+)/);
      if (m && m[1]) return { element: row, id: m[1] };
    }
    let curr = el;
    while (curr && curr !== document.body) {
      if (curr.classList?.contains("ag-convo-toast") || curr.classList?.contains("ag-convo-toast-stack") || curr.getAttribute?.("data-testid") === "conversation-view") {
        return null;
      }
      const cid = curr.getAttribute?.("data-cascade-id") || curr.getAttribute?.("data-conversation-id");
      if (cid && !curr.closest('[data-testid="conversation-view"]')) return { element: curr, id: cid };
      const key = Object.keys(curr).find((k) => k.startsWith("__reactFiber"));
      if (key) {
        let f = curr[key];
        for (let i = 0; f && i < 15; i++, f = f.return) {
          const p = f.memoizedProps;
          const candidate = p?.cascadeId || p?.conversationId || p?.conversation?.id || p?.conversation?.conversationId;
          if (typeof candidate === "string" && candidate.length > 8) {
            return { element: curr, id: candidate };
          }
        }
      }
      curr = curr.parentElement;
    }
    return null;
  }
  function findProjectDropTarget(target) {
    if (!target) return null;
    const recents = target.closest?.(
      '[data-gemini-experience-tab="chat"], [data-testid="section-header"]'
    );
    if (recents && (recents.innerText?.includes("Recent") || recents.getAttribute?.("data-gemini-experience-tab") === "chat")) {
      return recents;
    }
    const directHeader = target.closest?.(
      '.group\\/header, [id^="header-"], a[href*="section="], [data-project-card="true"], [data-testid*="project-card"], [class*="project-card"], [data-testid*="project-header"], [data-testid="project-group"], button:has([class*="truncate"]):has(svg)'
    );
    if (directHeader) return directHeader;
    const row = target.closest?.('[data-testid="conversation-row-sidebar"], [data-testid="conversation-row-history"]');
    if (row && !row.closest?.('[data-testid="conversation-view"], main')) {
      return row;
    }
    return null;
  }
  function resolveProjectIdFromTarget(targetEl) {
    if (!targetEl) return "";
    if (targetEl.matches?.('[data-gemini-experience-tab="chat"]') || targetEl.innerText && (targetEl.innerText.includes("Recent") || targetEl.innerText.includes("General Chat"))) {
      return "outside-of-project";
    }
    const link = targetEl.matches?.('a[href*="section="]') ? targetEl : targetEl.querySelector?.('a[href*="section="]');
    if (link) {
      const match = link.getAttribute("href")?.match(/section=([^&]+)/);
      if (match && match[1]) {
        return decodeURIComponent(match[1]);
      }
    }
    const headerId = targetEl.id || targetEl.getAttribute?.("data-id") || "";
    if (headerId.startsWith("header-")) {
      return headerId.replace(/^header-/, "");
    }
    const cidFound = findConversationElementId(targetEl);
    if (cidFound?.id) {
      const mappedGid = window.__bettergravityConversationProjectMap?.get(cidFound.id + ":groupId");
      if (mappedGid) return mappedGid;
      const mappedOverride = window.__bettergravityConversationProjectMap?.get(cidFound.id + ":override");
      if (mappedOverride && mappedOverride !== "outside-of-project") return mappedOverride;
      const mappedName = window.__bettergravityConversationProjectMap?.get(cidFound.id);
      if (mappedName) {
        const projects = getAvailableProjectsList();
        const match = projects.find((p) => p.label?.toLowerCase() === mappedName.toLowerCase());
        if (match) return match.projectId;
      }
    }
    const key = Object.keys(targetEl).find((k) => k.startsWith("__reactFiber"));
    if (key) {
      let f = targetEl[key];
      while (f) {
        if (f.memoizedProps?.projectId) return f.memoizedProps.projectId;
        if (f.memoizedProps?.section?.id) return f.memoizedProps.section.id;
        if (f.memoizedProps?.group?.id) return f.memoizedProps.group.id;
        if (f.memoizedProps?.id && f.memoizedProps.id !== "header" && !f.memoizedProps.id.startsWith("section-")) {
          return f.memoizedProps.id;
        }
        f = f.return;
      }
    }
    const cardTitle = targetEl.innerText?.split("\n")?.[0]?.trim();
    if (cardTitle) {
      const projects = getAvailableProjectsList();
      const match = projects.find((p) => p.label?.toLowerCase() === cardTitle.toLowerCase());
      if (match) return match.projectId;
    }
    return "";
  }
  var activeDraggedConversationId = null;
  function setupConversationMoveEnhancer() {
    const makeRowsDraggable = () => {
      const rows = document.querySelectorAll(
        '[data-testid="conversation-row-sidebar"], [data-testid="conversation-row-history"], nav a[href*="/c/"], aside a[href*="/c/"]'
      );
      for (const r of rows) {
        if (r.closest('.ag-convo-toast, .ag-convo-toast-stack, [data-testid="conversation-view"], main')) continue;
        if (!r.hasAttribute("draggable")) {
          r.setAttribute("draggable", "true");
        }
      }
      const convoView = document.querySelector('[data-testid="conversation-view"]');
      if (convoView && convoView.getAttribute("draggable") === "true") {
        convoView.removeAttribute("draggable");
      }
    };
    const injectRowMoveButtons = () => {
      const rows = document.querySelectorAll('[data-testid="conversation-row-sidebar"], [data-testid="conversation-row-history"]');
      for (const row of rows) {
        if (row.querySelector(".ag-convo-move-btn")) continue;
        const found = findConversationElementId(row);
        if (!found) continue;
        const btn = document.createElement("button");
        btn.className = "ag-convo-move-btn";
        btn.type = "button";
        btn.title = "Move to Project / Folder";
        btn.setAttribute("aria-label", "Move to Project");
        btn.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
      `;
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const title = getConversationTitle(found.id) || row.textContent?.split("\n")[0]?.trim() || "";
          openMoveProjectPickerModal(found.id, title);
        });
        const kebab = row.querySelector('[data-testid="conversation-kebab"], button[aria-label*="More options"]');
        if (kebab && kebab.parentElement) {
          kebab.parentElement.insertBefore(btn, kebab);
        } else {
          row.appendChild(btn);
        }
      }
    };
    const refreshEnhancerState = () => {
      makeRowsDraggable();
      injectRowMoveButtons();
    };
    refreshEnhancerState();
    const observer = new MutationObserver(() => refreshEnhancerState());
    observer.observe(document.body, { childList: true, subtree: true });
    plugin.onDispose(() => observer.disconnect());
    document.addEventListener("dragstart", (e) => {
      const found = findConversationElementId(e.target);
      if (!found) {
        if (e.target?.closest?.('[data-testid="conversation-view"], .ag-convo-toast, .ag-convo-toast-stack, main')) {
          e.preventDefault();
        }
        return;
      }
      activeDraggedConversationId = found.id;
      try {
        e.dataTransfer?.setData("text/plain", found.id);
        e.dataTransfer?.setData("application/x-bettergravity-convo", found.id);
        if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
      } catch {
      }
    }, true);
    document.addEventListener("dragend", () => {
      activeDraggedConversationId = null;
      for (const el of document.querySelectorAll(".ag-project-drop-hover")) {
        el.classList.remove("ag-project-drop-hover");
      }
    }, true);
    document.addEventListener("dragover", (e) => {
      const projectCard = findProjectDropTarget(e.target);
      if (!projectCard) return;
      if (!activeDraggedConversationId) {
        const types = Array.from(e.dataTransfer?.types || []);
        if (!types.includes("text/plain") && !types.includes("application/x-bettergravity-convo")) {
          return;
        }
      }
      e.preventDefault();
      try {
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      } catch {
      }
      projectCard.classList.add("ag-project-drop-target");
      if (!projectCard.classList.contains("ag-project-drop-hover")) {
        projectCard.classList.add("ag-project-drop-hover");
      }
    }, true);
    document.addEventListener("dragleave", (e) => {
      const projectCard = findProjectDropTarget(e.target);
      if (!projectCard) return;
      const related = e.relatedTarget;
      if (!related || !projectCard.contains(related)) {
        projectCard.classList.remove("ag-project-drop-hover");
      }
    }, true);
    document.addEventListener("drop", async (e) => {
      const projectCard = findProjectDropTarget(e.target);
      if (!projectCard) return;
      e.preventDefault();
      e.stopPropagation();
      projectCard.classList.remove("ag-project-drop-hover");
      let cid = activeDraggedConversationId;
      if (!cid) {
        try {
          cid = e.dataTransfer?.getData("application/x-bettergravity-convo") || e.dataTransfer?.getData("text/plain") || null;
        } catch {
        }
      }
      if (!cid) return;
      const targetProjectId = resolveProjectIdFromTarget(projectCard);
      if (cid && targetProjectId) {
        projectCard.classList.add("ag-project-drop-success");
        setTimeout(() => projectCard.classList.remove("ag-project-drop-success"), 700);
        await executeMoveConversation(cid, targetProjectId);
      }
    }, true);
    let pendingConversationContext = null;
    const injectMoveMenuItem = (targetMenu, cid, title) => {
      if (!cid || !targetMenu) return;
      if (targetMenu.querySelector(".ag-injected-move-btn")) return;
      const moveItem = document.createElement("div");
      moveItem.className = "ag-injected-move-btn";
      moveItem.setAttribute("role", "menuitem");
      moveItem.style.cssText = `
      display: flex; align-items: center; gap: 8px;
      padding: 6px 10px; font-size: 12px; cursor: pointer;
      border-radius: 4px; color: #e4e4e7;
      transition: background-color 0.12s ease;
    `;
      moveItem.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
      </svg>
      <span>Move to Project...</span>
    `;
      moveItem.addEventListener("mouseenter", () => {
        moveItem.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
      });
      moveItem.addEventListener("mouseleave", () => {
        moveItem.style.backgroundColor = "transparent";
      });
      moveItem.addEventListener("click", (ev) => {
        ev.stopPropagation();
        try {
          targetMenu.remove();
        } catch {
        }
        openMoveProjectPickerModal(cid, title);
      });
      const firstItem = targetMenu.querySelector('[role="menuitem"]');
      if (firstItem && firstItem.parentElement) {
        firstItem.parentElement.insertBefore(moveItem, firstItem);
      } else {
        targetMenu.appendChild(moveItem);
      }
    };
    const handleMenuAppearance = () => {
      const menus = document.querySelectorAll('[role="menu"]');
      const menu = menus[menus.length - 1];
      if (!menu) return;
      const activeRow = pendingConversationContext?.element || document.querySelector('[data-testid="conversation-row-sidebar"]:hover, [data-testid="conversation-row-history"]:hover');
      const found = activeRow ? findConversationElementId(activeRow) : null;
      const cid = pendingConversationContext?.id || found?.id;
      const title = pendingConversationContext?.title || (found ? getConversationTitle(found.id) : "");
      if (cid) {
        injectMoveMenuItem(menu, cid, title);
      }
    };
    document.addEventListener("contextmenu", (e) => {
      const found = findConversationElementId(e.target);
      if (!found) return;
      const title = getConversationTitle(found.id) || found.element.textContent?.split("\n")[0]?.trim() || "";
      pendingConversationContext = { id: found.id, title, element: found.element };
      setTimeout(handleMenuAppearance, 50);
      setTimeout(handleMenuAppearance, 150);
    }, true);
    document.addEventListener("click", (e) => {
      const kebabBtn = e.target.closest(
        '[data-testid="conversation-kebab"], button[aria-label*="conversation menu"], button[aria-label*="More options"], [data-testid*="more-options"], [aria-haspopup="menu"]'
      );
      if (!kebabBtn) return;
      const found = findConversationElementId(kebabBtn);
      if (!found) return;
      const title = getConversationTitle(found.id) || found.element.textContent?.split("\n")[0]?.trim() || "";
      pendingConversationContext = { id: found.id, title, element: found.element };
      setTimeout(handleMenuAppearance, 50);
      setTimeout(handleMenuAppearance, 140);
      setTimeout(handleMenuAppearance, 240);
    }, true);
    plugin.onDispose(() => {
      for (const el of document.querySelectorAll(".ag-move-project-overlay, .ag-injected-move-btn, .ag-convo-move-btn")) {
        el.remove();
      }
    });
  }

  // community/plugins/stock-enhancer/src/projects/index.ts
  function initProjectsDomain() {
    syncBridgeProjects();
    setupConversationMoveEnhancer();
  }

  // community/plugins/stock-enhancer/src/index.ts
  registerConfigActionHandlers({
    testSound: () => {
      playAlertSound("complete", true);
      return "Sound preview played!";
    },
    testToast: () => testInteractiveNotification()
  });
  applyInstantBootup();
  setupNativeProLifecycle();
  setupScrollDejitter();
  setupInstantChatSwitching();
  setupSpeedMetrics();
  setupStateWatcher();
  setupSplitTerminalEnhancer();
  setupNativeSideQuestionEnhancer();
  initProjectsDomain();
  var onVisibility = () => {
    if (!document.hidden) {
      ensureNativeProCore();
      fetchMetrics(true).then(() => {
        const ring = document.querySelector(".ag-stock-ring-sibling");
        if (ring) updateRingUI(ring);
      });
    }
  };
  document.addEventListener("visibilitychange", onVisibility);
  plugin.onDispose(() => document.removeEventListener("visibilitychange", onVisibility));
  plugin.onDispose(() => {
    closeContextPopover();
    hideTooltip();
    closeActivePromptToast();
    closeAudioContext();
    const trigger = document.querySelector(MODEL_TRIGGER_SELECTOR);
    if (trigger) {
      trigger.style.removeProperty("background-color");
      trigger.style.removeProperty("box-shadow");
    }
    for (const el of document.querySelectorAll(
      ".ag-stock-ring-sibling, .ag-stock-ring-hitbox, .ag-stock-ring-separator, .ag-stock-floating-tooltip, .ag-stock-context-popover, .ag-stock-jump-button, .ag-stock-speed-badge, .ag-convo-toast-stack, .ag-convo-toast"
    )) {
      el.remove();
    }
  });
})();
