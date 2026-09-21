// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const source = readFileSync("community/plugins/gemini-app/index.js", "utf8");

describe("Codex Feature 2: 1-Click Desktop Screen Snipping in Composer", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div data-testid="agent-input-box">
        <div class="rounded-2xl bg-card-border">
          <div class="bg-card">
            <button data-testid="add-context-button">Add</button>
            <div contenteditable="true" role="textbox"></div>
          </div>
        </div>
      </div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = "";
    const overlay = document.getElementById("gemini-screen-snipper");
    if (overlay) overlay.remove();
  });

  it("mounts snip button in composer toolbar", () => {
    const snipCode = source.slice(
      source.indexOf("let activeSnipOverlay = null;"),
      source.indexOf("const ANTIGRAVITY_BUILTIN_SKILLS =")
    );

    const box = document.querySelector('[data-testid="agent-input-box"]') as HTMLElement;
    const anchor = box.querySelector('[data-testid="add-context-button"]') as HTMLElement;

    const fn = new Function(
      "window", "document", "INPUT_BOX",
      `${snipCode}\nreturn { ensureSnipButton };`
    )(window, document, '[data-testid="agent-input-box"]');

    fn.ensureSnipButton(box, anchor);

    const btn = box.querySelector('[data-testid="composer-snip-button"]');
    expect(btn).not.toBeNull();
    expect(btn?.getAttribute("aria-label")).toBe("Snip screen to composer");
  });

  it("activates snipping overlay on startScreenSnip and handles selection drag", () => {
    const snipCode = source.slice(
      source.indexOf("let activeSnipOverlay = null;"),
      source.indexOf("const ANTIGRAVITY_BUILTIN_SKILLS =")
    );

    const fn = new Function(
      "window", "document", "INPUT_BOX",
      `${snipCode}\nreturn { startScreenSnip };`
    )(window, document, '[data-testid="agent-input-box"]');

    fn.startScreenSnip();

    const overlay = document.getElementById("gemini-screen-snipper");
    expect(overlay).not.toBeNull();

    const selection = overlay?.querySelector(".gemini-snip-selection") as HTMLElement;
    expect(selection).not.toBeNull();

    // Mouse drag
    overlay?.dispatchEvent(new MouseEvent("mousedown", { clientX: 100, clientY: 100, button: 0 }));
    overlay?.dispatchEvent(new MouseEvent("mousemove", { clientX: 300, clientY: 250, button: 0 }));

    expect(selection.style.width).toBe("200px");
    expect(selection.style.height).toBe("150px");

    // Press Escape to cancel
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.getElementById("gemini-screen-snipper")).toBeNull();
  });
});

