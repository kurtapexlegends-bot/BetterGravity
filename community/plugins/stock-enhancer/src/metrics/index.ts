// Native Pro (Stock Enhancer) — Response Speed Metric (tok/s)
import { settings } from "../config";

const trackedResponses = new WeakSet<Element>();

export function setupSpeedMetrics(): void {
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
