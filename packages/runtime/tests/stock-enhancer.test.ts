// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const manifest = JSON.parse(readFileSync("community/plugins/stock-enhancer/plugin.json", "utf8"));
const pluginSource = readFileSync("community/plugins/stock-enhancer/index.js", "utf8");

describe("Native Pro (Stock Enhancer) manifest", () => {
  it("conforms to plugin manifest standards", () => {
    expect(manifest.name).toBe("Native Pro");
    expect(manifest.version).toBe("1.0.0");
    expect(manifest.main).toBe("index.js");
    expect(manifest.styles).toEqual(["styles/stock-enhancer.css"]);
    expect(typeof manifest.description).toBe("string");
    expect(manifest.description.length).toBeGreaterThan(15);
    expect(manifest.author).toBe("BetterGravity");
  });
});

describe("Native Pro (Stock Enhancer) functionality", () => {
  let cleanups: (() => void)[] = [];
  let compactCalls: string[] = [];

  const mockContextMetrics = {
    used: 125000,
    limit: 1000000,
    percentage: 13,
    remaining: 875000,
    systemTokens: 15000,
    userTokens: 30000,
    modelTokens: 55000,
    toolTokens: 25000
  };

  const mockPlugin = {
    settings: {
      define: (schema: any) => {
        const accessor: any = {};
        for (const [k, v] of Object.entries(schema)) {
          accessor[k] = (v as any).default;
        }
        return accessor;
      }
    },
    account: {
      getContextMetrics: vi.fn(async (sessionId?: string) => mockContextMetrics),
      compactContext: vi.fn(async (sessionId?: string) => {
        compactCalls.push(sessionId || "");
        return { success: true, reclaimedPercentage: 35 };
      })
    },
    ui: {
      toast: vi.fn()
    },
    overlay: {
      open: vi.fn(async (surface: any) => ({
        ok: true,
        send: vi.fn(),
        onMessage: vi.fn(),
        close: vi.fn()
      }))
    },
    onDispose: (fn: () => void) => {
      cleanups.push(fn);
    }
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    cleanups = [];
    compactCalls = [];

    // Setup mock DOM for Antigravity stock UI
    document.body.innerHTML = `
      <div id="splash" class="splash-screen"></div>
      <div data-testid="conversation-view" data-cascade-id="test-conv-123" style="height: 500px; overflow-y: scroll;">
        <div style="height: 1200px;">
          <div data-testid="assistant-turn">
            <p>Assistant response text with more than 60 characters so speed metric triggers.</p>
            <div class="flex items-center gap-1"></div>
          </div>
        </div>
      </div>
      <div data-testid="agent-input-box">
        <button data-testid="model-selector-trigger">
          <span>Gemini 3.8 Flash</span>
          <span class="shrink-0"><svg class="chevron"></svg></span>
        </button>
      </div>
    `;
  });

  afterEach(() => {
    for (const c of cleanups) {
      try { c(); } catch {}
    }
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function runPlugin() {
    const fn = new Function("BetterGravity", "plugin", pluginSource);
    fn({}, mockPlugin);
  }

  it("removes the splash screen immediately on instant bootup", () => {
    const splash = document.getElementById("splash");
    expect(splash).toBeTruthy();

    runPlugin();

    vi.advanceTimersByTime(100);
    expect(document.getElementById("splash")).toBeNull();
  });

  it("mounts context ring as a standalone sibling button directly beside the model selector trigger without reparenting", () => {
    const trigger = document.querySelector('[data-testid="model-selector-trigger"]') as HTMLElement;
    const initialParent = trigger.parentElement;

    runPlugin();

    // Verify trigger was NEVER reparented (prevents React reconciliation crash)
    expect(trigger.parentElement).toBe(initialParent);

    const ringSibling = trigger.parentElement?.querySelector(".ag-stock-ring-sibling");
    expect(ringSibling).toBeTruthy();

    // Sibling check: ringSibling placed immediately beside trigger
    expect(trigger.nextSibling).toBe(ringSibling);
    expect(trigger.parentElement?.style.flexWrap).toBe("nowrap");
  });

  it("updates progress ring stroke and displays floating portal tooltip on hover", async () => {
    runPlugin();

    // Advance timer to trigger metric update
    await vi.advanceTimersByTimeAsync(3000);

    const ring = document.querySelector(".ag-stock-ring-sibling") as HTMLElement;
    const progress = ring.querySelector(".ag-stock-ring-progress") as HTMLElement;

    expect(progress).toBeTruthy();
    expect(progress.classList.contains("risk-low")).toBe(true);

    // Hover ring: should display floating tooltip mounted to document.body
    ring.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    const tooltip = document.querySelector(".ag-stock-floating-tooltip");
    expect(tooltip).toBeTruthy();
    expect(tooltip?.textContent).toContain("13% context used • ~875k left");

    // Mouse leave: cleans up tooltip
    ring.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    expect(document.querySelector(".ag-stock-floating-tooltip")).toBeNull();
  });

  it("opens interactive context popover on ring click with breakdown and actions", async () => {
    runPlugin();
    await vi.advanceTimersByTimeAsync(3000);

    const ring = document.querySelector(".ag-stock-ring-sibling") as HTMLElement;
    ring.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    await vi.advanceTimersByTimeAsync(100);

    const popover = document.querySelector(".ag-stock-context-popover");
    expect(popover).toBeTruthy();
    expect(popover?.parentElement).toBe(document.body);
    expect(popover?.textContent).toContain("Context Breakdown");
    expect(popover?.textContent).toContain("System & Guidelines");
    expect(popover?.textContent).toContain("User Messages");
    expect(popover?.textContent).toContain("Assistant Replies");
    expect(popover?.textContent).toContain("Tool Executions & Files");

    // Click Compact button
    const compactBtn = popover?.querySelector(".ag-stock-compact-btn") as HTMLButtonElement;
    expect(compactBtn).toBeTruthy();
    compactBtn.click();

    await vi.advanceTimersByTimeAsync(100);
    expect(mockPlugin.account.compactContext).toHaveBeenCalledWith("test-conv-123");
  });

  it("shows jump-to-bottom button when scrolled up and scrolls on click", () => {
    runPlugin();

    const view = document.querySelector('[data-testid="conversation-view"]') as HTMLElement;
    const jumpBtn = view.querySelector(".ag-stock-jump-button") as HTMLElement;
    expect(jumpBtn).toBeTruthy();
    expect(jumpBtn.classList.contains("visible")).toBe(false);

    // Mock scrolling up (scrollHeight: 1200, clientHeight: 500, scrollTop: 200 -> distance: 500 > 160)
    Object.defineProperty(view, "scrollHeight", { value: 1200, configurable: true });
    Object.defineProperty(view, "clientHeight", { value: 500, configurable: true });
    Object.defineProperty(view, "scrollTop", { value: 200, configurable: true });

    view.dispatchEvent(new Event("scroll"));
    expect(jumpBtn.classList.contains("visible")).toBe(true);

    const scrollSpy = vi.fn();
    view.scrollTo = scrollSpy;
    jumpBtn.click();
    expect(scrollSpy).toHaveBeenCalledWith({ top: 1200, behavior: "smooth" });
  });

  it("adds generation speed metric to assistant response footer", () => {
    runPlugin();

    vi.advanceTimersByTime(1100);

    const badge = document.querySelector(".ag-stock-speed-badge");
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toContain("tok/s");
  });

  it("cleans up all injected elements on disposal without memory leaks", () => {
    runPlugin();

    expect(document.querySelector(".ag-stock-ring-sibling")).toBeTruthy();
    expect(document.querySelector(".ag-stock-jump-button")).toBeTruthy();

    // Dispose plugin
    for (const c of cleanups) {
      c();
    }

    expect(document.querySelector(".ag-stock-ring-sibling")).toBeNull();
    expect(document.querySelector(".ag-stock-jump-button")).toBeNull();
    expect(document.querySelector(".ag-stock-context-popover")).toBeNull();
    // The native trigger remains in place
    expect(document.querySelector('[data-testid="model-selector-trigger"]')).toBeTruthy();
  });

  it("self-heals and mounts cleanly on cold boot when DOM arrives asynchronously", async () => {
    // Clear DOM completely to simulate early preload execution
    document.body.innerHTML = "";

    runPlugin();

    // Verify nothing mounted yet (DOM was empty)
    expect(document.querySelector(".ag-stock-ring-sibling")).toBeNull();
    expect(document.querySelector(".ag-stock-jump-button")).toBeNull();

    // Now simulate React mounting the UI after cold boot
    document.body.innerHTML = `
      <div data-testid="conversation-view" data-cascade-id="cold-boot-conv"></div>
      <div data-testid="agent-input-box">
        <button data-testid="model-selector-trigger">
          <span>Gemini 3.8 Flash</span>
        </button>
      </div>
    `;

    // Wait for MutationObserver / timer ticks
    await vi.advanceTimersByTimeAsync(450);

    // Verify self-healed and mounted!
    expect(document.querySelector(".ag-stock-ring-sibling")).toBeTruthy();
    expect(document.querySelector(".ag-stock-jump-button")).toBeTruthy();
  });

  it("re-attaches context ring and jump button seamlessly after account switch / DOM recreation", async () => {
    runPlugin();

    expect(document.querySelector(".ag-stock-ring-sibling")).toBeTruthy();
    expect(document.querySelector(".ag-stock-jump-button")).toBeTruthy();

    // Simulate account sign-in / switch: React tears down DOM and mounts a new account shell
    document.body.innerHTML = `
      <div data-testid="conversation-view" data-cascade-id="switched-account-conv"></div>
      <div data-testid="agent-input-box">
        <button data-testid="model-selector-trigger">
          <span>Gemini 3.1 Pro</span>
        </button>
      </div>
    `;

    // Wait for MutationObserver / timer ticks
    await vi.advanceTimersByTimeAsync(450);

    // Verify self-healed and re-mounted on the new account's view
    expect(document.querySelector(".ag-stock-ring-sibling")).toBeTruthy();
    expect(document.querySelector(".ag-stock-jump-button")).toBeTruthy();
  });

  it("does not render conversation status toast stack during running conversations", async () => {
    const sidebar = document.createElement("div");
    sidebar.innerHTML = `
      <div data-testid="conversation-row-sidebar" data-cascade-id="convo-alpha">
        <span class="truncate">Alpha Task</span>
        <svg class="animate-spin" data-testid="status-loading-spinner"></svg>
      </div>
    `;
    document.body.appendChild(sidebar);

    runPlugin();
    await vi.advanceTimersByTimeAsync(500);

    expect(document.querySelector(".ag-convo-toast-stack")).toBeNull();
    expect(document.querySelector(".ag-convo-toast")).toBeNull();
  });

  it("strictly prevents conversation-view from being draggable and injects inline move button on sidebar rows", async () => {
    const sidebar = document.createElement("div");
    sidebar.innerHTML = `
      <div data-testid="conversation-row-sidebar" data-cascade-id="row-1">
        <span class="truncate">Row 1 Conversation</span>
        <button data-testid="conversation-kebab">···</button>
      </div>
    `;
    document.body.appendChild(sidebar);

    runPlugin();
    await vi.advanceTimersByTimeAsync(100);

    // 1. Ensure conversation view is NOT draggable (anti-ghosting root cause fix)
    const convoView = document.querySelector('[data-testid="conversation-view"]');
    expect(convoView?.getAttribute("draggable")).not.toBe("true");

    // 2. Ensure sidebar row IS draggable
    const row = document.querySelector('[data-testid="conversation-row-sidebar"]');
    expect(row?.getAttribute("draggable")).toBe("true");

    // 3. Ensure inline Move to Project button was injected into the row
    const moveBtn = row?.querySelector(".ag-convo-move-btn");
    expect(moveBtn).toBeTruthy();
  });

  it("opens move project picker modal and executes moveConversation bridge call", async () => {
    let bridgeMoveCalled: { id: string; target: string } | null = null;
    (window as any).__betterGravityBridge = {
      moveConversation: vi.fn(async (id: string, target: string) => {
        bridgeMoveCalled = { id, target };
        return { success: true };
      })
    };

    const sidebar = document.createElement("div");
    sidebar.innerHTML = `
      <div data-testid="conversation-row-sidebar" data-cascade-id="move-convo-target">
        <span class="truncate">Move Me Task</span>
        <button data-testid="conversation-kebab">···</button>
      </div>
    `;
    document.body.appendChild(sidebar);

    runPlugin();
    await vi.advanceTimersByTimeAsync(100);

    const moveBtn = document.querySelector('[data-cascade-id="move-convo-target"] .ag-convo-move-btn') as HTMLElement;
    expect(moveBtn).toBeTruthy();

    // Click move button to open picker modal
    moveBtn.click();

    const modal = document.querySelector(".ag-move-project-modal");
    expect(modal).toBeTruthy();

    // Click the first non-disabled project button in the modal
    const projectBtn = modal?.querySelector(".ag-move-project-item:not([disabled])") as HTMLElement;
    expect(projectBtn).toBeTruthy();
    const targetProjectId = projectBtn.getAttribute("data-project-id");

    projectBtn.click();
    await vi.advanceTimersByTimeAsync(50);

    expect((window as any).__betterGravityBridge.moveConversation).toHaveBeenCalledWith(
      "move-convo-target",
      targetProjectId
    );
    expect(bridgeMoveCalled).toEqual({
      id: "move-convo-target",
      target: targetProjectId
    });

    // Modal was closed after selection
    expect(document.querySelector(".ag-move-project-modal")).toBeNull();
  });
});

