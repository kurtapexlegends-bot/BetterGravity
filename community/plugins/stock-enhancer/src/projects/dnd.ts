// Native Pro (Stock Enhancer) — Drag-and-Drop Move & Row Actions
import { getConversationTitle } from "../shared";
import { executeMoveConversation, getAvailableProjectsList } from "./helpers";
import { openMoveProjectPickerModal } from "./modal";

export function findConversationElementId(el: any): { element: HTMLElement; id: string } | null {
  if (!el) return null;
  // Ignore anything inside toast notifications, main chat view, or main editor workspace
  if (el.closest?.(".ag-convo-toast, .ag-convo-toast-stack, [data-testid=\"conversation-view\"], main")) return null;

  // 1. Sidebar row checks
  const row = el.closest('[data-testid="conversation-row-sidebar"], [data-testid="conversation-row-history"], nav a[href*="/c/"], aside a[href*="/c/"]');
  if (row) {
    if (row.closest(".ag-convo-toast, .ag-convo-toast-stack, [data-testid=\"conversation-view\"], main")) return null;
    const directId = row.getAttribute("data-cascade-id") || row.getAttribute("data-conversation-id");
    if (directId) return { element: row, id: directId };
    const link = row.matches?.('a[href*="/c/"]') ? row : row.querySelector?.('a[href*="/c/"]');
    const href = link?.getAttribute("href") || "";
    const m = href.match(/\/c\/([a-zA-Z0-9_-]+)/);
    if (m && m[1]) return { element: row, id: m[1] };
  }

  // 2. Class/hierarchy checks strictly outside main conversation view
  let curr = el;
  while (curr && curr !== document.body) {
    if (curr.classList?.contains("ag-convo-toast") || curr.classList?.contains("ag-convo-toast-stack") || curr.getAttribute?.("data-testid") === "conversation-view") {
      return null;
    }
    const cid = curr.getAttribute?.("data-cascade-id") || curr.getAttribute?.("data-conversation-id");
    if (cid && !curr.closest('[data-testid="conversation-view"]')) return { element: curr, id: cid };

    // Check fiber for cascadeId or conversationId
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

export function findProjectDropTarget(target: any): HTMLElement | null {
  if (!target) return null;
  // 1. Recents / Standalone section header or Chat tab
  const recents = target.closest?.(
    '[data-gemini-experience-tab="chat"], [data-testid="section-header"]'
  );
  if (recents && (recents.innerText?.includes("Recent") || recents.getAttribute?.("data-gemini-experience-tab") === "chat")) {
    return recents;
  }

  // 2. Direct project header, project card, section link, or project group container
  const directHeader = target.closest?.(
    '.group\\/header, [id^="header-"], a[href*="section="], [data-project-card="true"], [data-testid*="project-card"], [class*="project-card"], [data-testid*="project-header"], [data-testid="project-group"], button:has([class*="truncate"]):has(svg)'
  );
  if (directHeader) return directHeader;

  // 3. Dropping onto another conversation row in the sidebar
  const row = target.closest?.('[data-testid="conversation-row-sidebar"], [data-testid="conversation-row-history"]');
  if (row && !row.closest?.('[data-testid="conversation-view"], main')) {
    return row;
  }

  return null;
}

export function resolveProjectIdFromTarget(targetEl: any): string {
  if (!targetEl) return "";

  // 1. Check if target is Recents / General Chat / Chat tab
  if (
    targetEl.matches?.('[data-gemini-experience-tab="chat"]') ||
    (targetEl.innerText && (targetEl.innerText.includes("Recent") || targetEl.innerText.includes("General Chat")))
  ) {
    return "outside-of-project";
  }

  // 2. Direct section href link: e.g. a[href*="section="]
  const link = targetEl.matches?.('a[href*="section="]') ? targetEl : targetEl.querySelector?.('a[href*="section="]');
  if (link) {
    const match = link.getAttribute('href')?.match(/section=([^&]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
  }

  // 3. Header ID: e.g. id="header-<projectId>" or data-id="header-<projectId>"
  const headerId = targetEl.id || targetEl.getAttribute?.("data-id") || "";
  if (headerId.startsWith("header-")) {
    return headerId.replace(/^header-/, "");
  }

  // 4. Dropped onto another conversation row -> determine its project ID
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

  // 5. React Fiber memoizedProps
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

  // 6. Match card/header title against available project records
  const cardTitle = targetEl.innerText?.split("\n")?.[0]?.trim();
  if (cardTitle) {
    const projects = getAvailableProjectsList();
    const match = projects.find((p) => p.label?.toLowerCase() === cardTitle.toLowerCase());
    if (match) return match.projectId;
  }

  return "";
}

let activeDraggedConversationId: string | null = null;

export function setupConversationMoveEnhancer(): void {
  // Ensure ONLY sidebar conversation rows have HTML5 draggable enabled.
  // NEVER make the main conversation view or workspace elements draggable!
  const makeRowsDraggable = () => {
    const rows = document.querySelectorAll(
      '[data-testid="conversation-row-sidebar"], [data-testid="conversation-row-history"], nav a[href*="/c/"], aside a[href*="/c/"]'
    );
    for (const r of rows) {
      if (r.closest(".ag-convo-toast, .ag-convo-toast-stack, [data-testid=\"conversation-view\"], main")) continue;
      if (!r.hasAttribute("draggable")) {
        r.setAttribute("draggable", "true");
      }
    }
    // Strictly prevent native drag on conversation view or chat containers
    const convoView = document.querySelector('[data-testid="conversation-view"]');
    if (convoView && convoView.getAttribute("draggable") === "true") {
      convoView.removeAttribute("draggable");
    }
  };

  // Inject direct "Move to Project" button (.ag-convo-move-btn) on sidebar rows
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

  // 1. Hook HTML5 Drag-and-Drop
  document.addEventListener("dragstart", (e: DragEvent) => {
    const found = findConversationElementId(e.target);
    if (!found) {
      // Disallow drag on anything inside main chat or toasts
      if ((e.target as HTMLElement)?.closest?.('[data-testid="conversation-view"], .ag-convo-toast, .ag-convo-toast-stack, main')) {
        e.preventDefault();
      }
      return;
    }

    activeDraggedConversationId = found.id;
    try {
      e.dataTransfer?.setData("text/plain", found.id);
      e.dataTransfer?.setData("application/x-bettergravity-convo", found.id);
      if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
    } catch {}
  }, true);

  document.addEventListener("dragend", () => {
    activeDraggedConversationId = null;
    for (const el of document.querySelectorAll(".ag-project-drop-hover")) {
      el.classList.remove("ag-project-drop-hover");
    }
  }, true);

  document.addEventListener("dragover", (e: DragEvent) => {
    const projectCard = findProjectDropTarget(e.target);
    if (!projectCard) return;

    if (!activeDraggedConversationId) {
      const types = Array.from(e.dataTransfer?.types || []);
      if (!types.includes("text/plain") && !types.includes("application/x-bettergravity-convo")) {
        return;
      }
    }

    e.preventDefault();
    try { if (e.dataTransfer) e.dataTransfer.dropEffect = "move"; } catch {}

    projectCard.classList.add("ag-project-drop-target");
    if (!projectCard.classList.contains("ag-project-drop-hover")) {
      projectCard.classList.add("ag-project-drop-hover");
    }
  }, true);

  document.addEventListener("dragleave", (e: DragEvent) => {
    const projectCard = findProjectDropTarget(e.target);
    if (!projectCard) return;

    const related = e.relatedTarget as Node | null;
    if (!related || !projectCard.contains(related)) {
      projectCard.classList.remove("ag-project-drop-hover");
    }
  }, true);

  document.addEventListener("drop", async (e: DragEvent) => {
    const projectCard = findProjectDropTarget(e.target);
    if (!projectCard) return;

    e.preventDefault();
    e.stopPropagation();

    projectCard.classList.remove("ag-project-drop-hover");

    let cid = activeDraggedConversationId;
    if (!cid) {
      try {
        cid = e.dataTransfer?.getData("application/x-bettergravity-convo") ||
              e.dataTransfer?.getData("text/plain") || null;
      } catch {}
    }

    if (!cid) return;

    const targetProjectId = resolveProjectIdFromTarget(projectCard);
    if (cid && targetProjectId) {
      projectCard.classList.add("ag-project-drop-success");
      setTimeout(() => projectCard.classList.remove("ag-project-drop-success"), 700);
      await executeMoveConversation(cid, targetProjectId);
    }
  }, true);

  // 2. Hook Kebab Menu (···) and Right-Click Context Menus
  let pendingConversationContext: { id: string; title: string; element: HTMLElement } | null = null;

  const injectMoveMenuItem = (targetMenu: Element, cid: string, title: string) => {
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
      try { targetMenu.remove(); } catch {}
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

    const activeRow = pendingConversationContext?.element ||
                      document.querySelector('[data-testid="conversation-row-sidebar"]:hover, [data-testid="conversation-row-history"]:hover');
    const found = activeRow ? findConversationElementId(activeRow) : null;
    const cid = pendingConversationContext?.id || found?.id;
    const title = pendingConversationContext?.title || (found ? getConversationTitle(found.id) : "");

    if (cid) {
      injectMoveMenuItem(menu, cid, title);
    }
  };

  // Intercept right-clicks on any conversation element
  document.addEventListener("contextmenu", (e) => {
    const found = findConversationElementId(e.target);
    if (!found) return;

    const title = getConversationTitle(found.id) || found.element.textContent?.split("\n")[0]?.trim() || "";
    pendingConversationContext = { id: found.id, title, element: found.element };
    setTimeout(handleMenuAppearance, 50);
    setTimeout(handleMenuAppearance, 150);
  }, true);

  // Intercept clicks on kebab menus (···)
  document.addEventListener("click", (e: any) => {
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
