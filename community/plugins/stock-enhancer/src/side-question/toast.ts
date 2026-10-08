// Native Pro (Stock Enhancer) — Interactive Question Toasts
import { APPROVAL_SELECTOR, settings } from "../config";
import { playAlertSound } from "../shared";
import type { QuestionPrompt } from "../types";
import { activeOverlayHandle, setActiveOverlayHandle, showDesktopQuestionOverlay } from "./overlay";

export * from "./overlay";

export function isOutsideApp(): boolean {
  return !document.hasFocus() || document.hidden || document.visibilityState === "hidden";
}

export function extractQuestionPrompt(): QuestionPrompt | null {
  const continueBtn = document.querySelector('[data-testid="interaction-continue-button"]') as HTMLElement | null;
  const skipBtn = document.querySelector('[data-testid="interaction-skip-button"]') as HTMLElement | null;
  const confirmationBtn = document.querySelector('[data-testid="confirmation-confirm"], [aria-label*="Allow using this MCP tool"]') as HTMLElement | null;

  if (!continueBtn && !confirmationBtn && !document.querySelector(APPROVAL_SELECTOR)) {
    return null;
  }

  const card = continueBtn?.closest('.relative.flex.flex-col.p-px.rounded-2xl.bg-card-border.w-full') ||
               continueBtn?.closest('.bg-card')?.parentElement ||
               continueBtn?.closest('[role="dialog"]') ||
               continueBtn?.closest('.chat-confirmation-widget2') ||
               confirmationBtn?.closest('.chat-confirmation-widget2') ||
               confirmationBtn?.closest('[role="dialog"]') ||
               document.querySelector('.chat-confirmation-widget2, [role="dialog"]') as HTMLElement | null;

  let questionText = "";
  if (card) {
    const heading = card.querySelector('h1, h2, h3, h4, [class*="font-semibold"], [class*="font-medium"], [class*="text-base"]') as HTMLElement | null;
    if (heading) {
      questionText = heading.innerText?.trim() || "";
    }
    if (!questionText) {
      const p = card.querySelector('p');
      if (p) questionText = p.innerText?.trim() || "";
    }
  }

  if (!questionText) {
    questionText = continueBtn ? "Choose an option to continue." : "The agent is waiting for your tool or action approval.";
  }

  const options: { text: string; element: HTMLElement | null }[] = [];
  let hasWriteIn = false;
  let writeInPlaceholder = "Other (write your answer)";

  if (card) {
    const writeInEl = card.querySelector('[data-testid="ask-question-writein"]');
    if (writeInEl) {
      hasWriteIn = true;
      writeInPlaceholder = writeInEl.getAttribute("placeholder") || "Other (write your answer)";
    }

    const optionLabels = card.querySelectorAll('[role="radiogroup"] label, label:has(input[type="radio"]), label:has(input[type="checkbox"])');
    for (const el of optionLabels) {
      if (el.querySelector('[data-testid="ask-question-writein"]')) {
        continue;
      }
      const span = el.querySelector("span:last-child") || el.querySelector("span:not([class*='bg-border'])") as HTMLElement | null;
      let txt = (span?.innerText || (el as HTMLElement).innerText || "").trim();
      txt = txt.replace(/^[0-9]+[.:\s\)]*/, "").trim();
      if (txt && !options.some((o) => o.text === txt)) {
        options.push({ text: txt, element: el as HTMLElement });
      }
    }

    if (options.length === 0) {
      const inputs = card.querySelectorAll('input[type="radio"], input[type="checkbox"]');
      for (const input of inputs) {
        if (input.closest('label:has([data-testid="ask-question-writein"])')) continue;
        const parent = input.closest('label') || input.parentElement;
        let txt = parent?.innerText?.trim() || (input as HTMLInputElement).value;
        txt = txt.replace(/^[0-9]+[.:\s\)]*/, "").trim();
        if (txt && !options.some((o) => o.text === txt)) {
          options.push({ text: txt, element: input as HTMLElement });
        }
      }
    }
  }

  const promptId = questionText.slice(0, 50) + `:${options.length}:${hasWriteIn}`;
  return {
    id: promptId,
    question: questionText,
    options,
    hasWriteIn,
    writeInPlaceholder,
    continueBtn: continueBtn || confirmationBtn,
    skipBtn,
    card
  };
}

export function selectOptionElement(labelOrInput: HTMLElement | null): void {
  if (!labelOrInput) return;
  const input = labelOrInput.tagName === "INPUT" ? (labelOrInput as HTMLInputElement) : labelOrInput.querySelector("input");

  labelOrInput.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
  labelOrInput.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
  labelOrInput.click();

  if (input) {
    input.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
    input.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
    input.click();

    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "checked")?.set;
    if (setter) {
      setter.call(input, true);
    } else {
      input.checked = true;
    }
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

export function triggerQuestionSubmit(): void {
  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    const submitBtn = (document.querySelector('[data-testid="interaction-continue-button"]') ||
                      document.querySelector('[data-testid="confirmation-confirm"]') ||
                      document.querySelector('[aria-label*="Allow using this MCP tool"]')) as HTMLButtonElement | null;
    if (submitBtn && !submitBtn.disabled) {
      submitBtn.click();
      clearInterval(interval);
    } else if (attempts >= 15) {
      if (submitBtn) submitBtn.click();
      clearInterval(interval);
    }
  }, 60);
}

export function handleWriteInSubmit(customText: string): void {
  const writeinTextarea = document.querySelector('[data-testid="ask-question-writein"]') as HTMLTextAreaElement | HTMLInputElement | null;
  if (writeinTextarea) {
    const parentLabel = writeinTextarea.closest("label");
    if (parentLabel) {
      selectOptionElement(parentLabel);
    }

    writeinTextarea.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set ||
                   Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (setter) {
      setter.call(writeinTextarea, customText);
    } else {
      writeinTextarea.value = customText;
    }
    writeinTextarea.dispatchEvent(new Event("input", { bubbles: true }));
    writeinTextarea.dispatchEvent(new Event("change", { bubbles: true }));

    triggerQuestionSubmit();
  }
}

export let activePromptToast: any = null;
let lastDispatchedPromptId = "";

export function closeActivePromptToast(): void {
  if (activePromptToast) {
    try { activePromptToast.close(); } catch {}
    activePromptToast = null;
  }
}

let hasActiveApproval = false;

export function checkAndDispatchQuestionToast(): void {
  try {
    const approval = document.querySelector(APPROVAL_SELECTOR) !== null;
    if (!approval) {
      if (hasActiveApproval) {
        hasActiveApproval = false;
        lastDispatchedPromptId = "";
        closeActivePromptToast();
        if (activeOverlayHandle) {
          try { activeOverlayHandle.close(); } catch {}
          setActiveOverlayHandle(null);
        }
      }
      return;
    }

    hasActiveApproval = true;

    // If user is currently focused inside Antigravity and setting requires background, defer until they tab out
    if (settings.notifyInBackgroundOnly && !isOutsideApp()) {
      if (activeOverlayHandle) {
        try { activeOverlayHandle.close(); } catch {}
        setActiveOverlayHandle(null);
        lastDispatchedPromptId = "";
      }
      return;
    }

    const prompt = extractQuestionPrompt();
    if (!prompt) return;

    if (prompt.id === lastDispatchedPromptId) {
      return;
    }

    lastDispatchedPromptId = prompt.id;
    plugin.log?.info?.("Dispatching question toast for:", prompt.id);
    playAlertSound("approval");
    sendInteractiveQuestionToast(prompt);
    showDesktopQuestionOverlay(prompt);
  } catch (err) {
    plugin.log?.error?.("checkAndDispatchQuestionToast error:", String(err));
  }
}

export function sendInteractiveQuestionToast(prompt: QuestionPrompt): void {
  if (!settings.desktopNotification) return;
  if (!settings.grillNotifications && prompt?.options?.length > 0) return;
  if (settings.notifyInBackgroundOnly && !isOutsideApp()) return;

  try {
    if (typeof Notification === "undefined") return;

    if (Notification.permission !== "granted") {
      if (Notification.permission !== "denied") {
        Notification.requestPermission();
      }
      return;
    }

    // Clean up any previously opened toast for older prompt
    closeActivePromptToast();

    const options = prompt.options || [];
    const maxActions = (typeof Notification !== "undefined" && (Notification as any).maxActions) ? (Notification as any).maxActions : 2;
    const actions: any[] = [];

    if (settings.grillQuickActions && options.length > 0) {
      for (let i = 0; i < Math.min(options.length, maxActions); i++) {
        const cleanTitle = options[i].text.replace(/^[0-9]+[.:\s]*/, '').trim().slice(0, 20);
        actions.push({
          action: `choice_${i}`,
          title: `${i + 1}. ${cleanTitle}`
        });
      }
    }

    let bodyText = prompt.question;
    if (options.length > 0) {
      bodyText += "\n\n" + options.map((opt, idx) => `[${idx + 1}] ${opt.text}`).join("\n");
    }

    const title = options.length > 0 ? "🍳 Grill Me: Decision Needed" : "Antigravity: Approval Needed";
    let notif: Notification;
    try {
      notif = new Notification(title, {
        body: bodyText.slice(0, 300),
        requireInteraction: true,
        actions: actions.length > 0 ? actions : undefined,
        silent: true // sound is synthesized harmonically by playAlertSound
      } as any);
    } catch {
      // Chromium renderer rejects actions without a ServiceWorker; fallback to standard rich notification
      notif = new Notification(title, {
        body: bodyText.slice(0, 300),
        requireInteraction: true,
        silent: true
      });
    }

    plugin.log?.info?.("Toast notification created:", title);

    (notif as any).onaction = (e: any) => {
      try {
        const action = e?.action || "";
        if (action.startsWith("choice_")) {
          const idx = parseInt(action.replace("choice_", ""), 10);
          if (Number.isFinite(idx) && options[idx]) {
            const el = options[idx].element;
            if (el) {
              el.click();
              if (el.tagName === "INPUT") {
                (el as HTMLInputElement).checked = true;
                el.dispatchEvent(new Event("change", { bubbles: true }));
              }
            }
            setTimeout(() => {
              const btn = prompt.continueBtn as HTMLButtonElement | null;
              if (btn && !btn.disabled) {
                btn.click();
              }
            }, 80);
          }
        }
      } catch (err) {
        plugin.log?.error?.("Failed to select option from toast action:", err);
      }
    };

    notif.onclick = () => {
      try {
        window.focus();
      } catch {}
    };

    notif.onclose = () => {
      if (activePromptToast === notif) activePromptToast = null;
    };

    activePromptToast = notif;
  } catch (err) {
    plugin.log?.error?.("Error showing interactive toast:", err);
  }
}

export function testInteractiveNotification(): string {
  const mockPrompt: QuestionPrompt = {
    id: "test_" + Date.now(),
    question: "Which database architecture should we use for real-time caching?",
    options: [
      { text: "Redis key-value cache with TTL eviction", element: null },
      { text: "SQLite persistent embedded cache", element: null },
      { text: "In-memory LRU cache map", element: null }
    ],
    continueBtn: null,
    skipBtn: null,
    card: null
  };
  sendInteractiveQuestionToast(mockPrompt);
  playAlertSound("approval", true);
  return "Preview question toast with quick-action buttons sent!";
}
