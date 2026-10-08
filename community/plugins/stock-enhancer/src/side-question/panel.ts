// Native Pro (Stock Enhancer) — Native Side Question Follow-Up & Composer Insertion

export function insertToMainComposer(text: string): void {
  const input = (document.querySelector('[role="combobox"][contenteditable="true"]') ||
                 document.querySelector('[data-testid="agent-input-box"] [contenteditable="true"]')) as HTMLElement | null;
  if (!input) return;
  input.focus();
  try {
    document.execCommand("insertText", false, text);
  } catch (_) {
    input.textContent = (input.textContent || "") + text;
  }
}

export function dispatchNativeSideQuestion(questionText: string): boolean {
  const input = (document.querySelector('[role="combobox"][contenteditable="true"]') ||
                 document.querySelector('[data-testid="agent-input-box"] [contenteditable="true"]')) as any;
  if (!input) return false;

  const k = Object.keys(input).find(k => k.startsWith('__reactFiber'));
  let f = k ? input[k] : null;
  let hs: any = null;
  for (let i = 0; f && i < 35; i++, f = f.return) {
    if (typeof f.memoizedProps?.handleSubmit === 'function') {
      hs = f.memoizedProps.handleSubmit;
      break;
    }
  }

  if (!hs) return false;

  const items = [
    {
      chunk: {
        case: "item",
        value: {
          scopeItem: {
            case: "recipe",
            value: { recipeId: "btw", title: "btw" }
          }
        }
      }
    },
    {
      chunk: {
        case: "text",
        value: questionText
      }
    }
  ];

  try {
    hs(items, [], () => {}, {}, undefined, undefined);
    return true;
  } catch (e) {
    console.debug("[StockEnhancer] Failed to dispatch side question:", e);
    return false;
  }
}

export function getCleanAnswerText(el: HTMLElement | null): string {
  if (!el) return "";
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("style, script, .ag-native-side-followup-wrap").forEach(n => n.remove());
  return clone.textContent?.trim() || "";
}

export function updateNativeSideQuestionUI(): void {
  const panel = document.querySelector('[data-testid="side-question-panel"]') as HTMLElement | null;
  if (!panel) return;

  const questionEl = panel.querySelector('[data-testid="side-question-question"]') as HTMLElement | null;
  const answerEl = panel.querySelector('[data-testid="side-question-answer"]') as HTMLElement | null;
  if (!questionEl || !answerEl) return;

  const isThinking = !!panel.querySelector('.animate-pulse') ||
                     (answerEl.textContent || "").trim() === "Thinking...";

  let followupWrap = panel.querySelector(".ag-native-side-followup-wrap") as HTMLElement | null;
  if (!followupWrap) {
    followupWrap = document.createElement("div");
    followupWrap.className = "ag-native-side-followup-wrap";
    followupWrap.innerHTML = `
      <div class="ag-native-side-input-row">
        <input type="text" class="ag-native-side-input" placeholder="Ask a follow-up on this answer... (Enter to send)" />
        <button type="button" class="ag-native-side-send-btn" title="Send follow-up">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
        <button type="button" class="ag-native-side-action-btn ag-native-side-insert-btn" title="Insert answer into main composer">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 10 4 15 9 20"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/></svg>
          <span>Insert</span>
        </button>
      </div>
      <div class="ag-native-side-status-row" style="display:none;">
        <div class="ag-native-side-spinner"></div>
        <span>Antigravity is answering...</span>
      </div>
    `;

    const input = followupWrap.querySelector(".ag-native-side-input") as HTMLInputElement | null;
    const sendBtn = followupWrap.querySelector(".ag-native-side-send-btn") as HTMLButtonElement | null;
    const insertBtn = followupWrap.querySelector(".ag-native-side-insert-btn") as HTMLButtonElement | null;

    const submitFollowup = () => {
      if (!input) return;
      const text = input.value.trim();
      const currentThinking = !!panel.querySelector('.animate-pulse') || (answerEl.textContent || "").trim() === "Thinking...";
      if (!text || currentThinking) return;

      const currentQ = questionEl.textContent?.replace(/^Side Question:\s*/i, "").trim() || "";
      const shortQ = currentQ.length > 120 ? currentQ.slice(0, 117) + "..." : currentQ;
      const prompt = `Follow-up to "${shortQ}": ${text}`;

      input.value = "";
      const ok = dispatchNativeSideQuestion(prompt);
      if (!ok) {
        input.value = text;
      }
    };

    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submitFollowup();
      }
    });

    sendBtn?.addEventListener("click", () => {
      submitFollowup();
    });

    insertBtn?.addEventListener("click", () => {
      const currentAns = getCleanAnswerText(answerEl);
      if (currentAns) {
        insertToMainComposer(currentAns);
      }
    });

    panel.appendChild(followupWrap);
  }

  // Update dynamic states on existing wrap without re-rendering innerHTML
  const input = followupWrap.querySelector(".ag-native-side-input") as HTMLInputElement | null;
  const sendBtn = followupWrap.querySelector(".ag-native-side-send-btn") as HTMLButtonElement | null;
  const statusRow = followupWrap.querySelector(".ag-native-side-status-row") as HTMLElement | null;

  if (input && sendBtn && statusRow) {
    input.disabled = isThinking;
    sendBtn.disabled = isThinking;
    statusRow.style.display = isThinking ? "flex" : "none";
    if (isThinking) {
      input.placeholder = "Antigravity is thinking... please wait";
    } else {
      input.placeholder = "Ask a follow-up on this answer... (Enter to send)";
    }
  }
}

export function setupNativeSideQuestionEnhancer(): void {
  updateNativeSideQuestionUI();

  const obs = new MutationObserver(() => {
    updateNativeSideQuestionUI();
  });

  const targetNode = document.body || document.documentElement;
  obs.observe(targetNode, {
    childList: true,
    subtree: true
  });

  plugin.onDispose(() => {
    obs.disconnect();
    for (const wrap of document.querySelectorAll(".ag-native-side-followup-wrap")) {
      wrap.remove();
    }
  });
}
