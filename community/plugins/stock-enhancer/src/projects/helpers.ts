// Native Pro (Stock Enhancer) — Project Registry & Move Conversation Execution
import { CONVERSATION_VIEW_SELECTOR } from "../config";
import { getAntigravityLsClient, playAlertSound, refreshBackendSummaries, resetLsClientPollTime } from "../shared";
import type { MoveConversationResult, ProjectRecord } from "../types";

export function getSidebarSectionsProvider(): any {
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
      const key = Object.keys(el as any).find((k) => k.startsWith("__reactFiber"));
      if (!key) continue;
      let f = (el as any)[key];
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
      let f = (el as any)[key];
      while (f) {
        const provider = f.memoizedProps?.syncedState?.sidebarSectionsProvider;
        if (provider && typeof provider.getState === "function") {
          return provider;
        }
        f = f.return;
      }
    }
  } catch {}
  return null;
}

export let cachedBridgeProjects: any[] = [];

export function syncBridgeProjects(): void {
  try {
    const bridge = window.__betterGravityBridge;
    if (bridge && typeof bridge.getProjects === "function") {
      bridge.getProjects().then((projs: any) => {
        if (Array.isArray(projs) && projs.length > 0) {
          cachedBridgeProjects = projs;
        }
      }).catch(() => {});
    }
  } catch {}
}

export function getAvailableProjectsList(): ProjectRecord[] {
  const provider = getSidebarSectionsProvider();
  const list: ProjectRecord[] = [];

  // 1. Projects loaded from runtime bridge via SQLite
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

  // 2. Sections/Projects discovered from in-memory Redux / syncedState provider
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
    } catch {}
  }

  // 3. Projects discovered directly from DOM sidebar tree
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

  // 4. Fallback: If still empty or partial, populate known project workspaces from local SQLite registry
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

export async function executeMoveConversation(conversationId: string, targetProjectId: string): Promise<MoveConversationResult> {
  if (!conversationId) return { success: false, message: "No conversation selected" };

  try {
    const projects = getAvailableProjectsList();
    const targetProj = projects.find((p) => p.projectId === targetProjectId);
    const targetLabel = targetProj?.label || (targetProjectId === "outside-of-project" ? "" : "Project");

    // 1. Mutate SQLite database via runtime bridge
    const bridge = window.__betterGravityBridge;
    if (bridge && typeof bridge.moveConversation === "function") {
      const res = await bridge.moveConversation(conversationId, targetProjectId);
      if (!res?.success) {
        console.warn("[StockEnhancer] moveConversation bridge warning:", res?.message);
      }
    }

    // 2. Synchronize in-memory BetterGravity conversationProjectMap & overrides
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

    // 3. Re-parent inside in-memory sidebarSectionsProvider state and fire emitter
    const provider = getSidebarSectionsProvider();
    if (provider) {
      const state = provider.getState();
      const sections = state?.sidebarSections || [];
      let foundConvoItem: any = null;

      // Extract conversation from existing source section
      for (const sec of sections) {
        if (Array.isArray(sec.conversations)) {
          const idx = sec.conversations.findIndex((c: any) => (c.conversationId || c.id) === conversationId);
          if (idx !== -1) {
            foundConvoItem = sec.conversations.splice(idx, 1)[0];
            break;
          }
        }
      }

      // Add conversation to target section
      if (foundConvoItem && targetProjectId !== "outside-of-project") {
        let targetSec = sections.find((s: any) => (s.uri || s.projectId) === targetProjectId);
        if (targetSec) {
          if (!Array.isArray(targetSec.conversations)) targetSec.conversations = [];
          targetSec.conversations.unshift(foundConvoItem);
        }
      }

      // Notify React sidebar to update
      try {
        if (typeof provider.emitter?.fire === "function") {
          provider.emitter.fire(provider.getState());
        }
        if (typeof provider.refresh === "function") {
          provider.refresh();
        }
      } catch {}
    }

    // 4. Trigger UI list rerender
    try {
      if (typeof window.__bettergravityTriggerListRerender === "function") {
        window.__bettergravityTriggerListRerender();
      }
      window.dispatchEvent(new Event("resize"));
    } catch {}

    // 5. Instantly re-parent the DOM element in the sidebar for 0ms visual confirmation
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
    } catch {}

    // 6. Refresh LS client backend summaries
    try {
      const client = getAntigravityLsClient();
      if (client && typeof client.getAllCascadeTrajectories === "function") {
        resetLsClientPollTime();
        await refreshBackendSummaries();
      }
    } catch {}

    // Play subtle complete sound
    playAlertSound("complete");
    return { success: true };
  } catch (err) {
    console.error("[StockEnhancer] Failed to execute moveConversation:", err);
    return { success: false, message: String(err) };
  }
}
