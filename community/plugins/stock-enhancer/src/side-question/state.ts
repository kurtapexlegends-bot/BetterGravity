// Native Pro (Stock Enhancer) — Execution State & Approval Tracker
import { APPROVAL_SELECTOR, INPUT_BOX_SELECTOR, settings } from "../config";
import { ensureNativeProCore } from "../context-ring";
import { checkConversationSwitch } from "../scroll";
import { playAlertSound } from "../shared";
import { activeOverlayHandle, checkAndDispatchQuestionToast } from "./toast";

export function isInputBoxBusy(): boolean {
  const inputBox = document.querySelector(INPUT_BOX_SELECTOR) || document.querySelector('[data-testid="agent-input-box"]');
  const hasInputBusy = inputBox ? inputBox.querySelector('[data-tooltip-id="input-send-button-cancel-tooltip"], [data-testid="stop-button"], [data-testid="cancel-button"], [aria-label="Stop execution"], button svg.animate-spin') !== null : false;
  const hasViewBusy = document.querySelector(
    '[data-testid="conversation-view"] .animate-spin, [data-testid="conversation-view"] [data-testid="status-loading-spinner"], [data-testid="conversation-view"] [data-status="thinking"], [data-testid="conversation-view"] [data-status="running"], [data-testid="conversation-view"] button[aria-label*="Stop"], [data-testid="conversation-view"] [data-testid="stop-button"]'
  ) !== null;
  return hasInputBusy || hasViewBusy;
}

let isAgentBusy = false;
let stateWatcherTimer: any = 0;

export function setupStateWatcher(): void {
  const checkState = () => {
    try {
      ensureNativeProCore();

      const busy = isInputBoxBusy();
      const approval = document.querySelector(APPROVAL_SELECTOR) !== null;

      // 1. Conversation Switch & Core UI
      checkConversationSwitch();

      // 2. Approval / Question Check
      checkAndDispatchQuestionToast();

      // 3. Completion Trigger: was running, now stopped without pending approval
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
    }
  };
  window.addEventListener("blur", onBlur);
  window.addEventListener("focus", onFocus);
  plugin.onDispose(() => {
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("focus", onFocus);
  });
}
