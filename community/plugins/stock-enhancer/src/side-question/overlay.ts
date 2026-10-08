// Native Pro (Stock Enhancer) — Desktop Question Overlay & Surface
import { settings } from "../config";
import type { QuestionPrompt } from "../types";
import { handleWriteInSubmit, selectOptionElement, triggerQuestionSubmit } from "./toast";

export function toastOverlaySurface(Overlay: any, data: any): HTMLElement {
  const container = document.createElement("div");
  container.className = "bg-toast-container";
  const question = String(data?.question || "Decision required").replace(/</g, "&lt;");
  const options = Array.isArray(data?.options) ? data.options : [];
  const hasWriteIn = Boolean(data?.hasWriteIn);
  const writeInPlaceholder = String(data?.writeInPlaceholder || "Other (write your answer)").replace(/</g, "&lt;");

  let optionsHtml = "";
  for (let i = 0; i < options.length; i++) {
    const text = String(options[i]?.text || "").replace(/</g, "&lt;");
    optionsHtml += `
      <button class="bg-toast-btn" data-index="${i}" type="button" title="${text}">
        <span class="bg-toast-btn-num">${i + 1}</span>
        <span class="bg-toast-btn-text">${text}</span>
      </button>
    `;
  }

  let writeInHtml = "";
  if (hasWriteIn) {
    writeInHtml = `
      <div class="bg-toast-writein-container">
        <div class="bg-toast-writein-input-wrap">
          <input type="text" class="bg-toast-writein-input" placeholder="${writeInPlaceholder}" />
          <button class="bg-toast-writein-submit" type="button" title="Submit custom answer">Send</button>
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="bg-toast-card">
      <div class="bg-toast-header">
        <span class="bg-toast-badge">Decision Needed</span>
        <button class="bg-toast-close" type="button" title="Dismiss">✕</button>
      </div>
      <div class="bg-toast-question">${question}</div>
      <div class="bg-toast-options">${optionsHtml}</div>
      ${writeInHtml}
      <div class="bg-toast-footer">Click outside or press card to bring editor into focus</div>
    </div>
  `;

  const onDocClick = (e: MouseEvent) => {
    const rect = container.getBoundingClientRect();
    const inside = (
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
    );
    if (!inside) {
      document.removeEventListener("click", onDocClick, true);
      Overlay.close();
    }
  };
  setTimeout(() => {
    document.addEventListener("click", onDocClick, true);
  }, 100);

  const btns = container.querySelectorAll(".bg-toast-btn");
  for (const btn of btns) {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute("data-index") || "0", 10);
      Overlay.send({ action: "select", index: idx });
      Overlay.close();
    });
  }

  const writeInInput = container.querySelector(".bg-toast-writein-input") as HTMLInputElement | null;
  const writeInBtn = container.querySelector(".bg-toast-writein-submit") as HTMLButtonElement | null;
  if (writeInInput && writeInBtn) {
    const submitCustom = () => {
      const text = writeInInput.value.trim();
      if (text) {
        Overlay.send({ action: "writein", text });
        Overlay.close();
      }
    };
    writeInBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      submitCustom();
    });
    writeInInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.stopPropagation();
        submitCustom();
      }
    });
  }

  const closeBtn = container.querySelector(".bg-toast-close");
  closeBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    Overlay.close();
  });

  const card = container.querySelector(".bg-toast-card");
  card?.addEventListener("click", (e: any) => {
    if (
      e.target.closest(".bg-toast-btn") ||
      e.target.closest(".bg-toast-close") ||
      e.target.closest(".bg-toast-writein-container")
    ) {
      return;
    }
    Overlay.focusOwner();
    Overlay.close();
  });

  return container;
}

export const toastOverlayStyles = `
html, body {
  margin: 0; padding: 0; width: 100%; height: 100%;
  overflow: hidden; background: transparent !important;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  user-select: none;
}
.bg-toast-container {
  position: fixed;
  bottom: 28px;
  right: 28px;
  width: 410px;
  max-width: calc(100vw - 48px);
  z-index: 999999;
  animation: bgToastIn 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes bgToastIn {
  from { opacity: 0; transform: translateY(14px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.bg-toast-card {
  background: rgba(22, 22, 24, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 12px;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(20px);
  padding: 14px 16px;
  color: #f4f4f5;
  cursor: pointer;
}
.bg-toast-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.bg-toast-badge {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #a1a1aa;
}
.bg-toast-close {
  background: transparent;
  border: none;
  color: #71717a;
  font-size: 13px;
  cursor: pointer;
  padding: 2px 5px;
  border-radius: 4px;
  line-height: 1;
}
.bg-toast-close:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
}
.bg-toast-question {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  color: #ffffff;
  margin-bottom: 10px;
}
.bg-toast-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.bg-toast-btn {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 7px;
  padding: 7px 10px;
  color: #e4e4e7;
  font-size: 12px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.12s ease, border-color 0.12s ease;
}
.bg-toast-btn:hover {
  background: rgba(255, 255, 255, 0.14);
  border-color: rgba(255, 255, 255, 0.25);
  color: #ffffff;
}
.bg-toast-btn-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 17px;
  height: 17px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.14);
  font-size: 10px;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 1px;
}
.bg-toast-btn-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.4;
}
.bg-toast-btn:hover .bg-toast-btn-text {
  white-space: normal;
  word-break: break-word;
}
.bg-toast-writein-container {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
}
.bg-toast-writein-input-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  padding: 4px 8px;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.bg-toast-writein-input-wrap:focus-within {
  border-color: #3b82f6;
  background: rgba(255, 255, 255, 0.08);
}
.bg-toast-writein-input {
  flex: 1;
  background: transparent;
  border: none;
  color: #ffffff;
  font-size: 12px;
  outline: none;
  font-family: inherit;
  padding: 3px 0;
}
.bg-toast-writein-input::placeholder {
  color: #71717a;
}
.bg-toast-writein-submit {
  background: #2563eb;
  border: none;
  border-radius: 6px;
  color: #ffffff;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  cursor: pointer;
  transition: background-color 0.12s ease;
}
.bg-toast-writein-submit:hover {
  background: #1d4ed8;
}
.bg-toast-footer {
  margin-top: 8px;
  font-size: 10px;
  color: #71717a;
  text-align: center;
}
`;

export let activeOverlayHandle: any = null;

export function setActiveOverlayHandle(handle: any): void {
  activeOverlayHandle = handle;
}

export async function showDesktopQuestionOverlay(prompt: QuestionPrompt): Promise<void> {
  if (!plugin.overlay?.open) return;
  if (!settings.grillNotifications) return;

  if (activeOverlayHandle) {
    try { await activeOverlayHandle.close(); } catch {}
    activeOverlayHandle = null;
  }

  const optionsData = (prompt.options || []).slice(0, 4).map((o) => ({ text: o.text }));

  try {
    const handle = await plugin.overlay.open({
      script: toastOverlaySurface,
      styles: toastOverlayStyles,
      data: {
        question: prompt.question,
        options: optionsData,
        hasWriteIn: Boolean(prompt.hasWriteIn),
        writeInPlaceholder: prompt.writeInPlaceholder || "Other (write your answer)"
      },
      display: "primary"
    });

    if (handle?.ok) {
      activeOverlayHandle = handle;
      handle.onMessage((msg: any) => {
        if (msg?.action === "select" && typeof msg.index === "number") {
          const opt = prompt.options?.[msg.index];
          if (opt?.element) {
            selectOptionElement(opt.element);
            triggerQuestionSubmit();
          }
        } else if (msg?.action === "writein" && typeof msg.text === "string") {
          handleWriteInSubmit(msg.text);
        }
      });
    }
  } catch (err) {
    plugin.log?.error?.("Failed to show desktop question overlay:", err);
  }
}
