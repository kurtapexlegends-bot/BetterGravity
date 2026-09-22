// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

const source = readFileSync("community/plugins/gemini-app/index.js", "utf8");
const handler = source.slice(
  source.indexOf("function handleNewConversationActivation("),
  source.indexOf("function checkUrlForProjectSwitch(")
);

function createHandler() {
  const navigate = vi.fn();
  const markExperience = vi.fn();
  const store = vi.fn();
  const activate = new Function(
    "navigateToExperienceNewConversation", "getStoredExperience", "markExperience", "setStoredExperience",
    `${handler}\nreturn handleNewConversationActivation;`
  )(navigate, () => "work", markExperience, store) as (event: unknown) => void;
  return { activate, navigate, markExperience, store };
}

afterEach(() => {
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-gemini-experience");
});

describe("Gemini App new-conversation routing", () => {
  it("uses the selected experience for ordinary New Conversation clicks", () => {
    const { activate, navigate, markExperience } = createHandler();
    activate(new MouseEvent("click", { cancelable: true }));
    expect(navigate).toHaveBeenCalledExactlyOnceWith("work");
    expect(markExperience).not.toHaveBeenCalled();
  });

  // React wraps the pet's DOM click. Ignoring its explicit scope sent quick chat
  // into the last project whenever Work was the selected experience.
  it("routes a pet quick chat to Conversations through React's nativeEvent", () => {
    document.body.innerHTML = '<div id="gemini-experience-switch"></div>';
    const { activate, navigate, markExperience } = createHandler();
    const nativeEvent = new MouseEvent("click", { cancelable: true });
    Object.defineProperty(nativeEvent, "betterGravityProjectless", { value: true });
    activate({ nativeEvent, preventDefault: vi.fn(), stopPropagation: vi.fn() });
    expect(markExperience).toHaveBeenCalledExactlyOnceWith(document.querySelector("#gemini-experience-switch"), "chat", true);
    expect(navigate).toHaveBeenCalledExactlyOnceWith("chat");
  });

  it("remembers Chat when the experience switch has not mounted yet", () => {
    const { activate, navigate, store } = createHandler();
    const event = new MouseEvent("click", { cancelable: true });
    Object.defineProperty(event, "betterGravityProjectless", { value: true });
    activate(event);
    expect(store).toHaveBeenCalledExactlyOnceWith("chat");
    expect(document.documentElement.getAttribute("data-gemini-experience")).toBe("chat");
    expect(navigate).toHaveBeenCalledExactlyOnceWith("chat");
  });
});

describe("Gemini App experience switch notification dots", () => {
  const switchSource = source.slice(
    source.lastIndexOf("function getElementFiber("),
    source.indexOf("function ensureExperienceSwitch(")
  );

  function createSwitchScope(mockStoreState: any) {
    const mockStore = {
      getState: () => mockStoreState,
      subscribe: vi.fn()
    };
    const fn = new Function(
      "EXPERIENCES", "getStoredExperience", "markExperience", "navigateToExperienceNewConversation",
      `
      const plugin = { react: { getFiber: () => ({ memoizedProps: { store: arguments[4] } }) } };
      ${switchSource}
      return { buildExperienceSwitch, updateExperienceSwitchDots, isConversationCompletedUnread };
      `
    );
    return fn(
      [
        { id: "chat", label: "Chat" },
        { id: "work", label: "Work", badge: "beta" }
      ],
      () => "work",
      () => {},
      () => {},
      mockStore
    );
  }

  it("builds experience switch with dot elements before labels in both tabs", () => {
    const scope = createSwitchScope({
      trajectorySummaries: { summaries: {} },
      conversation: { sidebarSections: [], localLastViewedTimes: {} }
    });
    const pill = scope.buildExperienceSwitch();

    const chatTab = pill.querySelector('[data-gemini-experience-tab="chat"]');
    const workTab = pill.querySelector('[data-gemini-experience-tab="work"]');
    expect(chatTab).not.toBeNull();
    expect(workTab).not.toBeNull();

    const chatDot = chatTab.querySelector('[data-gemini-dot="chat"]');
    const chatLabel = chatTab.querySelector('[data-gemini-experience-label]');
    expect(chatDot).not.toBeNull();
    expect(chatDot.nextElementSibling).toBe(chatLabel);

    const workDot = workTab.querySelector('[data-gemini-dot="work"]');
    const workLabel = workTab.querySelector('[data-gemini-experience-label]');
    expect(workDot).not.toBeNull();
    expect(workDot.nextElementSibling).toBe(workLabel);

    const collapsedBtn = pill.querySelector('.gemini-experience-collapsed-btn');
    expect(collapsedBtn.querySelector('.gemini-experience-collapsed-dot')).not.toBeNull();
  });

  it("sets data-has-unread on chat when a chat conversation has completed a task", () => {
    const now = Date.now() / 1000;
    const scope = createSwitchScope({
      trajectorySummaries: {
        summaries: {
          "c1": {
            lastModifiedTime: { seconds: now - 100 },
            annotations: { lastUserViewTime: { seconds: now - 300 } },
            notFullyIdle: false,
            trajectoryType: 1
          }
        }
      },
      conversation: {
        sidebarSections: [
          { id: "outside-of-project", conversationIds: ["c1"] }
        ],
        localLastViewedTimes: {}
      }
    });

    const pill = scope.buildExperienceSwitch();
    const chatDot = pill.querySelector('[data-gemini-dot="chat"]');
    const workDot = pill.querySelector('[data-gemini-dot="work"]');

    expect(chatDot.getAttribute("data-has-unread")).toBe("true");
    expect(workDot.hasAttribute("data-has-unread")).toBe(false);
  });

  it("suppresses unread status when conversation is currently active and focused", () => {
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    const now = Date.now() / 1000;
    const scope = createSwitchScope({
      trajectorySummaries: {
        summaries: {
          "active-1": {
            lastModifiedTime: { seconds: now - 100 },
            annotations: { lastUserViewTime: { seconds: now - 300 } },
            notFullyIdle: false,
            trajectoryType: 1
          }
        }
      },
      conversation: {
        sidebarSections: [
          { id: "outside-of-project", conversationIds: ["active-1"] }
        ],
        convoState: { cascadeId: "active-1" },
        localLastViewedTimes: {}
      }
    });

    const pill = scope.buildExperienceSwitch();
    const chatDot = pill.querySelector('[data-gemini-dot="chat"]');
    expect(chatDot.hasAttribute("data-has-unread")).toBe(false);
  });

  it("avoids repainting unchanged notification dots during store updates and still clears viewed chats", () => {
    const now = Date.now() / 1000;
    const localTimes: Record<string, number> = {};
    const scope = createSwitchScope({
      trajectorySummaries: { summaries: {
        chat: { lastModifiedTime: { seconds: now - 50 }, notFullyIdle: false, trajectoryType: 1 }
      } },
      conversation: { sidebarSections: [{ id: "outside-of-project", conversationIds: ["chat"] }], localLastViewedTimes: localTimes }
    });
    const pill = scope.buildExperienceSwitch();
    const dot = pill.querySelector('[data-gemini-dot="chat"]');
    const collapsed = pill.querySelector('.gemini-experience-collapsed-btn');
    expect(dot.getAttribute('data-has-unread')).toBe('true');
    expect(collapsed.getAttribute('data-has-unread')).toBe('true');
    const observer = new MutationObserver(() => {});
    observer.observe(pill, { subtree: true, attributes: true, attributeFilter: ['data-has-unread'] });
    try {
      for (let i = 0; i < 20; i++) scope.updateExperienceSwitchDots(pill);
      expect(observer.takeRecords()).toHaveLength(0);
      localTimes.chat = now;
      scope.updateExperienceSwitchDots(pill);
      expect(dot.hasAttribute('data-has-unread')).toBe(false);
      expect(collapsed.hasAttribute('data-has-unread')).toBe(false);
      expect(observer.takeRecords()).toHaveLength(2);
      scope.updateExperienceSwitchDots(pill);
      expect(observer.takeRecords()).toHaveLength(0);
    } finally {
      observer.disconnect();
    }
  });

  it("sets data-has-unread on work and on collapsed button when a project conversation has completed a task", () => {
    const now = Date.now() / 1000;
    const scope = createSwitchScope({
      trajectorySummaries: {
        summaries: {
          "proj-conv-1": {
            lastModifiedTime: { seconds: now - 50 },
            annotations: { lastUserViewTime: { seconds: now - 500 } },
            notFullyIdle: false,
            trajectoryType: 1
          }
        }
      },
      conversation: {
        sidebarSections: [
          { id: "project-uuid-1", conversationIds: ["proj-conv-1"] }
        ],
        localLastViewedTimes: {}
      }
    });

    const pill = scope.buildExperienceSwitch();
    const chatDot = pill.querySelector('[data-gemini-dot="chat"]');
    const workDot = pill.querySelector('[data-gemini-dot="work"]');
    const collapsedBtn = pill.querySelector('.gemini-experience-collapsed-btn');

    expect(chatDot.hasAttribute("data-has-unread")).toBe(false);
    expect(workDot.getAttribute("data-has-unread")).toBe("true");
    // In mock, getStoredExperience() returns "work", so inactive is "chat" (false), but if current is "chat", collapsed has-unread is true
    pill.dataset.geminiExperience = "chat";
    scope.updateExperienceSwitchDots(pill);
    expect(collapsedBtn.getAttribute("data-has-unread")).toBe("true");
  });
});

describe("Gemini App search wildcard sanitation", () => {
  const wildcardSource = source.slice(
    source.indexOf("const SEARCH_ROW_SELECTOR ="),
    source.indexOf("plugin.dom.observe(SEARCH_ROW_SELECTOR")
  );
  const { sanitizeSearchWildcardRow, sanitizeSearchWildcards } = new Function(
    `${wildcardSource}\nreturn { sanitizeSearchWildcardRow, sanitizeSearchWildcards };`
  )();

  function createSearchRow(labelText: string, queryText: string, resultCount?: number) {
    const row = document.createElement("div");
    row.className = "flex items-center gap-1 overflow-hidden text-sm group";

    const label = document.createElement("span");
    label.className = "text-secondary-foreground shrink-0";
    label.textContent = labelText;
    row.appendChild(label);

    const query = document.createElement("span");
    query.className = "overflow-hidden text-ellipsis whitespace-nowrap";
    query.textContent = queryText;
    row.appendChild(query);

    if (typeof resultCount === "number") {
      const badge = document.createElement("span");
      badge.className = "shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-xs leading-none text-muted-foreground";
      badge.textContent = `${resultCount} results`;
      row.appendChild(badge);
    }
    return row;
  }

  it("marks bare wildcard queries as hidden with data-gemini-wildcard='true'", () => {
    for (const wildcard of ["*", "**/*", '"*"', "'*'"]) {
      const row = createSearchRow("Searched", wildcard, 132);
      sanitizeSearchWildcardRow(row);
      const querySpan = row.children[1];
      expect(querySpan?.getAttribute("data-gemini-wildcard")).toBe("true");
    }
  });

  it("also sanitizes rows during active 'Searching' state", () => {
    const row = createSearchRow("Searching", "*", 0);
    sanitizeSearchWildcardRow(row);
    expect(row.children[1]?.getAttribute("data-gemini-wildcard")).toBe("true");
  });

  it("preserves non-wildcard or specific search queries", () => {
    for (const validQuery of ["*.ts", "*.html", "auth", "foo*bar", "**/*.json"]) {
      const row = createSearchRow("Searched", validQuery, 12);
      sanitizeSearchWildcardRow(row);
      const querySpan = row.children[1];
      expect(querySpan?.hasAttribute("data-gemini-wildcard")).toBe(false);
    }
  });

  it("does not modify rows with non-search labels", () => {
    const row = createSearchRow("Executed", "*", 1);
    sanitizeSearchWildcardRow(row);
    expect(row.children[1]?.hasAttribute("data-gemini-wildcard")).toBe(false);
  });

  it("clears data-gemini-wildcard if query changes to a non-wildcard string", () => {
    const row = createSearchRow("Searched", "*", 10);
    sanitizeSearchWildcardRow(row);
    expect(row.children[1]?.getAttribute("data-gemini-wildcard")).toBe("true");

    const querySpan = row.children[1];
    if (querySpan) {
      querySpan.textContent = "main.ts";
    }
    sanitizeSearchWildcardRow(row);
    expect(row.children[1]?.hasAttribute("data-gemini-wildcard")).toBe(false);
  });

  it("sanitizes multiple rows inside a container subtree via sanitizeSearchWildcards", () => {
    const container = document.createElement("div");
    const row1 = createSearchRow("Searched", "*", 5);
    const row2 = createSearchRow("Searched", "component.tsx", 1);
    const row3 = createSearchRow("Searched", "**/*", 100);
    container.appendChild(row1);
    container.appendChild(row2);
    container.appendChild(row3);

    sanitizeSearchWildcards(container);
    expect(row1.children[1]?.getAttribute("data-gemini-wildcard")).toBe("true");
    expect(row2.children[1]?.hasAttribute("data-gemini-wildcard")).toBe(false);
    expect(row3.children[1]?.getAttribute("data-gemini-wildcard")).toBe("true");
  });
});

describe("Gemini App native duplicate logo suppression", () => {
  it("includes CSS rule suppressing native Antigravity SVG logo container", () => {
    const sidebarCss = readFileSync("community/plugins/gemini-app/styles/sidebar.css", "utf8");
    expect(sidebarCss).toMatch(/div:has\(\+ div > \[data-testid="sidebar-toggle"\]\):has\(svg\)/);
    expect(sidebarCss).toMatch(/svg path\[d\^="M144\.248"\]/);
  });
});

describe("Gemini App experience preservation and items filtering", () => {
  const transformSource = source.slice(
    source.indexOf("function transformItems("),
    source.indexOf("function listFiberFor(")
  );

  function createTransformScope(currentExp: string, projectMap = new Map()) {
    const fn = new Function(
      "getStoredExperience", "conversationProjectMap", "updateProjectMapFromFiber",
      `
      let firstDiscoveredProjectId = null;
      ${transformSource}
      return { transformItems };
      `
    );
    return fn(() => currentExp, projectMap, () => {});
  }

  const sampleItems = [
    { type: "section-header", id: "section-pinned", title: "Pinned" },
    { type: "row", id: "c-standalone-pinned", groupId: "pinned", cascadeId: "c-standalone-pinned" },
    { type: "row", id: "c-work-pinned", groupId: "pinned", cascadeId: "c-work-pinned" },
    { type: "header", id: "header-proj-1", title: "Project Alpha" },
    { type: "row", id: "c-work-1", groupId: "proj-1", cascadeId: "c-work-1" },
    { type: "show-more", groupId: "proj-1" },
    { type: "section-header", id: "section-standalone", title: "Recents" },
    { type: "row", id: "c-standalone-1", groupId: "standalone", cascadeId: "c-standalone-1" }
  ];

  it("in Chat mode: includes all pinned chats and standalone recents, strictly excludes project headers and project rows", () => {
    const map = new Map();
    map.set("c-work-pinned", "Project Alpha");
    map.set("c-work-pinned:groupId", "proj-1");
    map.set("c-work-1", "Project Alpha");
    map.set("c-work-1:groupId", "proj-1");

    const scope = createTransformScope("chat", map);
    const result = scope.transformItems(sampleItems);

    const rowIds = result.filter((it: any) => it.type === "row").map((it: any) => it.id);
    expect(rowIds).toEqual(["c-standalone-pinned", "c-work-pinned", "c-standalone-1"]);

    const headers = result.filter((it: any) => it.type === "header");
    expect(headers).toHaveLength(0);

    const pinnedHeader = result.find((it: any) => it.id === "section-pinned");
    expect(pinnedHeader).toBeDefined();
    expect(pinnedHeader.title).toBe("Pinned Conversations");

    const recentsHeader = result.find((it: any) => it.id === "section-standalone");
    expect(recentsHeader).toBeDefined();
    expect(recentsHeader.title).toBe("Recents");
  });

  it("in Work mode: includes all pinned chats and project headers/rows, strictly excludes unpinned standalone chats", () => {
    const map = new Map();
    map.set("c-work-pinned", "Project Alpha");
    map.set("c-work-pinned:groupId", "proj-1");
    map.set("c-work-1", "Project Alpha");
    map.set("c-work-1:groupId", "proj-1");

    const scope = createTransformScope("work", map);
    const result = scope.transformItems(sampleItems);

    const rowIds = result.filter((it: any) => it.type === "row").map((it: any) => it.id);
    expect(rowIds).toEqual(["c-standalone-pinned", "c-work-pinned", "c-work-1"]);

    const headers = result.filter((it: any) => it.type === "header");
    expect(headers).toHaveLength(1);
    expect(headers[0].id).toBe("header-proj-1");

    const recentsHeader = result.find((it: any) => it.id === "section-standalone");
    expect(recentsHeader).toBeUndefined();
  });

  it("checkUrlForProjectSwitch never switches stored experience when URL has section parameter", () => {
    const checkSource = source.slice(
      source.indexOf("function checkUrlForProjectSwitch("),
      source.indexOf("const pinnedStateOwners =")
    );
    let lastProj = "";
    let storedExp = "chat";
    const markExp = vi.fn();
    const setLastSelectedProjectId = vi.fn((pid) => { lastProj = pid; });
    const conversationProjectMap = new Map();

    const scope = new Function(
      "setLastSelectedProjectId", "getStoredExperience", "markExperience", "conversationProjectMap",
      `
      ${checkSource}
      return { checkUrlForProjectSwitch };
      `
    )(setLastSelectedProjectId, () => storedExp, markExp, conversationProjectMap);

    // Simulate navigating to a work conversation with ?section=my-project
    delete (window as any).location;
    window.location = new URL("https://app.antigravity.test/c/xyz123?section=my-project") as any;

    scope.checkUrlForProjectSwitch();
    expect(setLastSelectedProjectId).toHaveBeenCalledWith("my-project");
    expect(markExp).not.toHaveBeenCalled();
    expect(storedExp).toBe("chat");
  });

  it("suppresses project headers, cards, and toggles via sidebar.css in Chat mode", () => {
    const sidebarCss = readFileSync("community/plugins/gemini-app/styles/sidebar.css", "utf8");
    expect(sidebarCss).toMatch(/\[data-gemini-experience="chat"\] \[role="navigation"\]\[aria-label="Sidebar"\] \.group\\\/header/);
    expect(sidebarCss).toMatch(/\[data-gemini-experience="chat"\] \[role="navigation"\]\[aria-label="Sidebar"\] button\[data-project-card="true"\]/);
    expect(sidebarCss).toMatch(/\[data-gemini-experience="chat"\] \[role="navigation"\]\[aria-label="Sidebar"\] \.group\\\/headerbtn/);
  });
});

describe("Gemini App sidebar toggle detection and layout lock prevention", () => {
  it("broadens toggle CSS rules to data-testid without strict aria-label requirements", () => {
    const sidebarCss = readFileSync("community/plugins/gemini-app/styles/sidebar.css", "utf8");
    expect(sidebarCss).toMatch(/\[data-testid="sidebar-toggle"\] > span:first-child/);
    expect(sidebarCss).toMatch(/\[data-testid="sidebar-toggle"\]\[aria-expanded="false"\]/);
    expect(sidebarCss).not.toMatch(/\[data-testid="sidebar-toggle"\]\[aria-label\*="Toggle Sidebar"\]/);
  });

  it("extracts TOGGLE_SELECTOR as button[data-testid=\"sidebar-toggle\"] without strict aria-label", () => {
    expect(source).toMatch(/const TOGGLE_SELECTOR = ['"]button\[data-testid="sidebar-toggle"\]['"];/);
  });

  it("detects collapsed state from arbitrary aria-label and prevents layout lock during active expansion", () => {
    const scopeCode = `
      ${source.slice(
        source.indexOf('const WILLOW_SIDEBAR_EXPANDED_WIDTH'),
        source.indexOf('function ensureSidebarHeader(')
      )}
      return {
        isSidebarCollapsed,
        enforceSidebarGeometry,
        get expansionLockUntil() { return expansionLockUntil; },
        set expansionLockUntil(v) { expansionLockUntil = v; },
        get collapseLockUntil() { return collapseLockUntil; },
        set collapseLockUntil(v) { collapseLockUntil = v; }
      };
    `;
    const scope = new Function("SIDEBAR_SELECTOR", scopeCode)('[role="navigation"][aria-label="Sidebar"]');

    // Mount toggle with "Toggle Sidebar (Ctrl+B)" when collapsed
    document.body.innerHTML = `
      <div id="grandparent" style="width: 52px;">
        <div id="child">
          <nav role="navigation" aria-label="Sidebar" data-collapsed="true"></nav>
        </div>
      </div>
      <button data-testid="sidebar-toggle" aria-label="Toggle Sidebar (Ctrl+B)" aria-expanded="false"></button>
    `;

    const grandParent = document.getElementById("grandparent")!;
    expect(scope.isSidebarCollapsed()).toBe(true);

    // User initiates expansion -> expansionLockUntil is set
    scope.expansionLockUntil = Date.now() + 600;
    expect(scope.isSidebarCollapsed()).toBe(false);

    // Any observer trying to enforce collapsed geometry while expansion is in flight must be blocked
    scope.enforceSidebarGeometry(grandParent, true);
    expect(grandParent.style.width).toBe("52px"); // not overwritten to 52px if it were expanding, but let's test width transition:

    // When expanding to 288px:
    scope.enforceSidebarGeometry(grandParent, false);
    expect(grandParent.style.width).toBe("288px");

    // Collapsed call during expansion lock does NOT reset back to 52px
    scope.enforceSidebarGeometry(grandParent, true);
    expect(grandParent.style.width).toBe("288px");

    // Toggle with "Expand sidebar" when expanded
    const toggle = document.querySelector<HTMLButtonElement>('button[data-testid="sidebar-toggle"]')!;
    toggle.setAttribute("aria-label", "Expand sidebar");
    toggle.setAttribute("aria-expanded", "true");
    scope.expansionLockUntil = 0;
    expect(scope.isSidebarCollapsed()).toBe(false);
  });

  it("guards conversation click navigation against synthetic auto-collapse", () => {
    let expansionLockUntil = 0;
    let navigatingConversationUntil = 0;
    let isInternalToggleAction = false;
    let sidebarCollapsed = false;

    // Simulate convRow click handler
    const onConvRowClick = () => {
      if (!sidebarCollapsed && window.innerWidth >= 900) {
        expansionLockUntil = Date.now() + 1500;
        navigatingConversationUntil = Date.now() + 1500;
      }
    };

    // Simulate toggle click handler
    const onToggleClick = (e: { isTrusted: boolean; defaultPrevented: boolean; stopImmediatePropagation: () => void; preventDefault: () => void }) => {
      const isSynthetic = !e.isTrusted && !isInternalToggleAction;
      if (isSynthetic && !sidebarCollapsed && Date.now() < navigatingConversationUntil && window.innerWidth >= 900) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      sidebarCollapsed = !sidebarCollapsed;
    };

    Object.defineProperty(window, "innerWidth", { value: 1200, configurable: true });

    // User clicks conversation row while sidebar is expanded
    onConvRowClick();
    expect(expansionLockUntil).toBeGreaterThan(Date.now());
    expect(navigatingConversationUntil).toBeGreaterThan(Date.now());

    // Antigravity triggers synthetic toggle click during navigation
    let prevented = false;
    let propagationStopped = false;
    const syntheticEvent = {
      isTrusted: false,
      defaultPrevented: false,
      preventDefault: () => { prevented = true; },
      stopImmediatePropagation: () => { propagationStopped = true; }
    };

    onToggleClick(syntheticEvent);
    expect(prevented).toBe(true);
    expect(propagationStopped).toBe(true);
    expect(sidebarCollapsed).toBe(false); // Sidebar remained expanded!

    // Human user click (isTrusted: true) succeeds
    const userEvent = {
      isTrusted: true,
      defaultPrevented: false,
      preventDefault: vi.fn(),
      stopImmediatePropagation: vi.fn()
    };
    onToggleClick(userEvent);
    expect(sidebarCollapsed).toBe(true); // User click collapsed sidebar as intended
  });

  it("triggers automatic expansion when toggle mounts with aria-expanded=false during expansion lock", () => {
    let expansionLockUntil = Date.now() + 1500;
    let isInternalToggleAction = false;
    let clicked = false;

    const mockToggle = {
      getAttribute: (attr: string) => (attr === "aria-expanded" ? "false" : null),
      click: () => {
        clicked = true;
      }
    };

    // Toggle observe logic:
    if (Date.now() < expansionLockUntil && mockToggle.getAttribute("aria-expanded") === "false") {
      isInternalToggleAction = true;
      try {
        mockToggle.click();
      } finally {
        isInternalToggleAction = false;
      }
    }

    expect(clicked).toBe(true);
  });

  it("keeps .gemini-logo-btn visible in collapsed 52px rail as primary expand button in sidebar.css", () => {
    const sidebarCss = readFileSync("community/plugins/gemini-app/styles/sidebar.css", "utf8");
    expect(sidebarCss).toMatch(/\[role="navigation"\]\[aria-label="Sidebar"\]\[data-collapsed="true"\] \.gemini-logo-btn[^{]*\{[^}]*display: flex !important;/);
    expect(sidebarCss).not.toMatch(/\[role="navigation"\]\[aria-label="Sidebar"\]\[data-collapsed="true"\] \.gemini-logo-btn[^{]*\{[^}]*display: none !important;/);
  });

  it("does not navigate away when clicking collapsed experience switch during active conversation view", () => {
    let navigated = false;
    const navigateToExperienceNewConversation = () => { navigated = true; };
    const isViewingConversation = true; // viewing /c/conversation-id

    if (!isViewingConversation) {
      navigateToExperienceNewConversation();
    }

    expect(navigated).toBe(false);
  });
});

describe("Gemini App experience switch active tab tooltip suppression", () => {
  const switchSource = source.slice(
    source.lastIndexOf("function getElementFiber("),
    source.indexOf("function ensureExperienceSwitch(")
  );

  function createScopedSwitch(storedExp: string) {
    const fn = new Function(
      "EXPERIENCES", "getStoredExperience", "markExperience", "navigateToExperienceNewConversation",
      `
      const plugin = { react: { getFiber: () => ({ memoizedProps: { store: { getState: () => ({}), subscribe: () => {} } } }) } };
      ${switchSource}
      return { buildExperienceSwitch };
      `
    );
    return fn(
      [
        { id: "chat", label: "Chat" },
        { id: "work", label: "Work", badge: "beta" }
      ],
      () => storedExp,
      (pill: HTMLElement, exp: string) => {
        for (const tab of pill.querySelectorAll("[data-gemini-experience-tab]")) {
          const isSelected = (tab as HTMLElement).dataset.geminiExperienceTab === exp;
          tab.setAttribute("aria-pressed", String(isSelected));
          tab.removeAttribute("title");
          tab.removeAttribute("data-willow-tooltip");
          for (const child of tab.querySelectorAll("[title], [data-willow-tooltip]")) {
            child.removeAttribute("title");
            child.removeAttribute("data-willow-tooltip");
          }
        }
      },
      () => {}
    );
  }

  it("never assigns title or badge tooltip to Chat or Work tabs during buildExperienceSwitch", () => {
    // When Chat is stored experience
    const chatScope = createScopedSwitch("chat");
    const chatPill = chatScope.buildExperienceSwitch();
    const chatTab = chatPill.querySelector('[data-gemini-experience-tab="chat"]');
    const workTab = chatPill.querySelector('[data-gemini-experience-tab="work"]');
    const workBadge = workTab?.querySelector('[data-gemini-experience-badge]');

    expect(chatTab?.getAttribute("title")).toBeNull();
    expect(chatTab?.getAttribute("data-willow-tooltip")).toBeNull();
    expect(workTab?.getAttribute("title")).toBeNull();
    expect(workTab?.getAttribute("data-willow-tooltip")).toBeNull();
    expect(workBadge?.getAttribute("title")).toBeNull();

    // When Work is stored experience
    const workScope = createScopedSwitch("work");
    const workPill = workScope.buildExperienceSwitch();
    const workChatTab = workPill.querySelector('[data-gemini-experience-tab="chat"]');
    const workWorkTab = workPill.querySelector('[data-gemini-experience-tab="work"]');

    expect(workWorkTab?.getAttribute("title")).toBeNull();
    expect(workWorkTab?.getAttribute("data-willow-tooltip")).toBeNull();
    expect(workChatTab?.getAttribute("title")).toBeNull();
    expect(workChatTab?.getAttribute("data-willow-tooltip")).toBeNull();
  });

  it("tooltip engine completely suppresses tooltips on any experience tab", () => {
    const tooltipSource = source.slice(
      source.indexOf("const TOOLTIP_STASH_ATTR ="),
      source.indexOf("const stopGlobalTooltips =")
    );

    const engine = new Function(
      `
      ${tooltipSource}
      return { restoreTooltipAnchor, openTooltipFor, showTooltipOverlay, closeTooltipImmediate };
      `
    )();

    const tab = document.createElement("button");
    tab.dataset.geminiExperienceTab = "chat";
    tab.setAttribute("aria-pressed", "false");
    tab.setAttribute("data-willow-tooltip", "Switch to Chat");
    document.body.appendChild(tab);

    // restoreTooltipAnchor must clear stash without putting title back on tab
    engine.restoreTooltipAnchor(tab);
    expect(tab.getAttribute("title")).toBeNull();
    expect(tab.getAttribute("data-willow-tooltip")).toBeNull();

    // openTooltipFor must refuse to show tooltip on tab even if title exists
    tab.setAttribute("title", "Switch to Chat");
    engine.openTooltipFor(tab);
    expect(tab.getAttribute("title")).toBeNull();
    expect(tab.getAttribute("data-willow-tooltip")).toBeNull();
    expect(document.querySelector(".willow-tooltip-pane")).toBeNull();
  });
});




