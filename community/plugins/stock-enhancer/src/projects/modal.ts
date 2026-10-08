// Native Pro (Stock Enhancer) — Move to Project Picker Modal
import { escapeHtml } from "../shared";
import { cachedBridgeProjects, executeMoveConversation, getAvailableProjectsList } from "./helpers";

export async function openMoveProjectPickerModal(conversationId: string, conversationTitle: string): Promise<void> {
  const existing = document.querySelector(".ag-move-project-overlay");
  if (existing) existing.remove();

  if (cachedBridgeProjects.length === 0 && window.__betterGravityBridge?.getProjects) {
    try {
      const projs = await window.__betterGravityBridge.getProjects();
      if (Array.isArray(projs) && projs.length > 0) {
        cachedBridgeProjects.splice(0, cachedBridgeProjects.length, ...projs);
      }
    } catch {}
  }

  const projects = getAvailableProjectsList();

  // Identify which project current conversation is already in
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

  // Include Standalone / Outside of project option
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
      <button class="ag-move-project-close-btn" type="button" title="Close">✕</button>
    </div>
    <div class="ag-move-project-subtitle">
      Moving: <strong>${escapeHtml(conversationTitle || "Conversation")}</strong>
    </div>
    <div class="ag-move-project-list">
      ${allTargets.map((p) => {
        const isCurrent = p.projectId === currentProjectId;
        return `
          <button class="ag-move-project-item ${isCurrent ? 'ag-move-project-item-current' : ''}"
                  data-project-id="${escapeHtml(p.projectId)}"
                  ${isCurrent ? 'disabled title="Currently in this project"' : ''}
                  type="button">
            <span class="ag-move-project-item-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
            </span>
            <span class="ag-move-project-item-title">${escapeHtml(p.label || "Untitled Project")}</span>
            <span class="ag-move-project-item-badge">${isCurrent ? 'Current' : (p.projectId === "outside-of-project" ? 'General' : `${p.count} convos`)}</span>
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
