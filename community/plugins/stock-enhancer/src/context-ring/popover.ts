// Native Pro (Stock Enhancer) — Context Popover Breakdown & Actions
import {
  escapeHtml,
  findAgentService,
  formatTokens,
  getActiveConversationId,
  getActiveModelLimit,
  getAudioContext,
  getConversationTitle,
  navigateToConversation,
  performFork,
  playSingleNote,
  positionFloatingElement
} from "../shared";
import { settings } from "../config";
import { fetchMetrics, getCachedMetrics, updateRingUI } from "./index";

let activePopover: HTMLElement | null = null;

export function closeContextPopover(): void {
  if (activePopover) {
    activePopover.remove();
    activePopover = null;
  }
}

export function isPopoverOpen(): boolean {
  return activePopover !== null;
}

export async function toggleContextPopover(anchor: HTMLElement): Promise<void> {
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

  // Handle Compact Click
  const compactBtn = popover.querySelector(".ag-stock-compact-btn") as HTMLButtonElement | null;
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

    // Subtle audio feedback if sounds enabled
    try {
      if (settings.soundNotifications) {
        const ctx = getAudioContext();
        if (ctx) {
          const now = ctx.currentTime;
          playSingleNote(ctx, now, 523.25, 0.08, 0.1, "sine");
          playSingleNote(ctx, now + 0.08, 659.25, 0.12, 0.12, "sine");
        }
      }
    } catch {}

    try {
      const activeSessionId = getActiveConversationId();
      let res: any = null;
      if (plugin?.account?.compactContext) {
        res = await plugin.account.compactContext(activeSessionId);
      }

      await fetchMetrics(true);

      const reclaimedPercent = res?.reclaimedPercentage ?? (res?.reclaimedTokens && res?.originalTokens ? Math.round((res.reclaimedTokens / res.originalTokens) * 100) : 0);
      const successLabel = reclaimedPercent ? `✔ -${reclaimedPercent}% Reclaimed` : `✔ Compacted!`;

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

      // Update ring and popover stats in real time
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

        if (barFill) (barFill as HTMLElement).style.width = `${newPct}%`;
      }

      // Success chime
      try {
        if (settings.soundNotifications) {
          const ctx = getAudioContext();
          if (ctx) {
            const now = ctx.currentTime;
            playSingleNote(ctx, now, 587.33, 0.1, 0.12, "sine");
            playSingleNote(ctx, now + 0.09, 880, 0.22, 0.15, "sine");
          }
        }
      } catch {}

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

  // Handle Fork Click
  const forkBtn = popover.querySelector(".ag-stock-fork-btn") as HTMLButtonElement | null;
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
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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
export function setupPopoverDocumentDismissal(): void {
  const onDocClick = (e: MouseEvent) => {
    if (activePopover && !activePopover.contains(e.target as Node) && !(e.target as HTMLElement).closest(".ag-stock-ring-sibling, .ag-stock-ring-side, .ag-stock-ring-hitbox, .ag-stock-ring-container")) {
      closeContextPopover();
    }
  };
  document.addEventListener("click", onDocClick, true);
  plugin.onDispose(() => document.removeEventListener("click", onDocClick, true));
}
