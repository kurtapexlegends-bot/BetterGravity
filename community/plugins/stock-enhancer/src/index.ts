// Native Pro (Stock Enhancer) — Slim Entrypoint Orchestrator
import { MODEL_TRIGGER_SELECTOR, registerConfigActionHandlers } from "./config";
import { applyInstantBootup, closeAudioContext, hideTooltip, playAlertSound } from "./shared";
import { closeContextPopover, ensureNativeProCore, fetchMetrics, setupNativeProLifecycle, updateRingUI } from "./context-ring";
import { setupInstantChatSwitching, setupScrollDejitter } from "./scroll";
import { setupSpeedMetrics } from "./metrics";
import { setupSplitTerminalEnhancer } from "./terminal";
import { closeActivePromptToast, setupNativeSideQuestionEnhancer, setupStateWatcher, testInteractiveNotification } from "./side-question";
import { initProjectsDomain } from "./projects";

registerConfigActionHandlers({
  testSound: () => { playAlertSound("complete", true); return "Sound preview played!"; },
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

const onVisibility = () => {
  if (!document.hidden) {
    ensureNativeProCore();
    fetchMetrics(true).then(() => {
      const ring = document.querySelector(".ag-stock-ring-sibling") as HTMLElement | null;
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
  const trigger = document.querySelector(MODEL_TRIGGER_SELECTOR) as HTMLElement | null;
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
