// Native Pro (Stock Enhancer) — Split Terminal Stacking & Orientation Toggle
import { settings } from "../config";

let terminalSplitUserOverride: "vertical" | "horizontal" | null = null;

export function isTerminalSplitVertical(containerWidth: number): boolean {
  if (terminalSplitUserOverride === "vertical") return true;
  if (terminalSplitUserOverride === "horizontal") return false;
  const mode = settings.terminalSplitMode || "auto";
  if (mode === "vertical") return true;
  if (mode === "horizontal") return false;
  return containerWidth < 460;
}

export function updateTerminalSplitLayout(): void {
  const splitRow = document.querySelector(".flex.flex-row.w-full.h-full.min-w-0.min-h-0") as HTMLElement | null;
  if (!splitRow) return;

  const children = Array.from(splitRow.children);
  const terminalPanes = children.filter(c => !c.classList.contains("cursor-col-resize") && !c.classList.contains("cursor-row-resize") && !c.classList.contains("ag-terminal-split-divider"));

  if (terminalPanes.length >= 2) {
    const containerWidth = splitRow.clientWidth || 300;
    const shouldBeVertical = isTerminalSplitVertical(containerWidth);

    if (shouldBeVertical) {
      if (!splitRow.classList.contains("ag-terminal-split-vertical")) {
        splitRow.classList.add("ag-terminal-split-vertical");
        splitRow.style.setProperty("flex-direction", "column", "important");

        const divider = splitRow.querySelector('div[class*="cursor-col-resize"]') as HTMLElement | null;
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

        const divider = splitRow.querySelector(".ag-terminal-split-divider") as HTMLElement | null;
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

export function ensureTerminalOrientationButton(): void {
  const terminalHeaders = Array.from(
    document.querySelectorAll('div[aria-label="Terminal header"], div[class*="items-center"][class*="justify-between"]')
  ).filter(h => h.getAttribute("aria-label") === "Terminal header" || h.querySelector('[data-testid="terminal-add-button"]') || Array.from(h.querySelectorAll("span")).some(s => s.textContent?.trim() === "Terminals"));

  for (const header of terminalHeaders) {
    if (header.querySelector(".ag-terminal-orientation-btn")) continue;

    const actionGroup = header.querySelector(".flex.items-center.gap-1:last-child") || header.lastElementChild;
    if (!actionGroup) continue;

    const splitRow = document.querySelector(".flex.flex-row.w-full.h-full.min-w-0.min-h-0") as HTMLElement | null;
    const containerWidth = splitRow?.clientWidth || 260;
    const isVertical = isTerminalSplitVertical(containerWidth);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ag-terminal-orientation-btn";
    btn.setAttribute("aria-label", "Toggle Split Stacking");
    btn.setAttribute("title", isVertical ? "Switch to Side-by-Side Split" : "Switch to Stacked Top/Bottom Split");
    btn.style.setProperty("app-region", "no-drag");

    const renderIcon = (vertical: boolean) => {
      btn.innerHTML = vertical
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2"/>
            <path d="M3 12h18"/>
          </svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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

export function setupSplitTerminalEnhancer(): void {
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
      (split as HTMLElement).style.removeProperty("flex-direction");
    }
  });
}
