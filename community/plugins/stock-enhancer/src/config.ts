// Native Pro (Stock Enhancer) — Configuration & Constants
import type { StockEnhancerSettings } from "./types";

export const CIRCUMFERENCE = 2 * Math.PI * 9; // radius = 9, circumference ≈ 56.5487
export const INPUT_BOX_SELECTOR = '[data-testid="agent-input-box"]';
export const MODEL_TRIGGER_SELECTOR = '[data-testid="model-selector-trigger"]';
export const CONVERSATION_VIEW_SELECTOR = '[data-testid="conversation-view"]';

export const APPROVAL_SELECTOR = [
  '[data-testid="interaction-continue-button"]',
  '.chat-confirmation-widget2',
  '[data-testid="confirmation-confirm"]',
  '[aria-label*="Allow using this MCP tool"]'
].join(",");

export const MODEL_LIMITS: Record<string, number> = {
  "claude-3-5-sonnet": 200000,
  "claude-3-7-sonnet": 200000,
  "claude-3-opus": 200000,
  "claude-3-5-haiku": 200000,
  "gpt-4o": 128000,
  "gpt-4o-mini": 128000,
  "o1": 200000,
  "o1-mini": 128000,
  "o1-preview": 128000,
  "o3-mini": 200000,
  "gemini-2.0-flash": 1048576,
  "gemini-2.0-pro": 2097152,
  "gemini-1.5-pro": 2097152,
  "gemini-1.5-flash": 1048576,
  "deepseek-r1": 64000,
  "deepseek-v3": 64000
};

let testSoundHandler: (() => string) | null = null;
let testToastHandler: (() => string) | null = null;

export function registerConfigActionHandlers(handlers: {
  testSound?: () => string;
  testToast?: () => string;
}): void {
  if (handlers.testSound) testSoundHandler = handlers.testSound;
  if (handlers.testToast) testToastHandler = handlers.testToast;
}

export const settings: StockEnhancerSettings = plugin.settings.define({
  enableProgressRing: {
    type: "boolean",
    label: "Context Progress Ring",
    description: "Display a miniature circular context ring beside the model selector chevron.",
    default: true
  },
  enableSpeedMetric: {
    type: "boolean",
    label: "Response Speed Metric",
    description: "Display tokens/sec and generation duration on completed assistant messages.",
    default: true
  },
  enableJumpToBottom: {
    type: "boolean",
    label: "Jump to Bottom Pill",
    description: "Show a floating jump-to-bottom arrow when scrolled up in conversations.",
    default: true
  },
  enableScrollOptimization: {
    type: "boolean",
    label: "Smooth Streaming & Scroll De-jitter",
    description: "Batch DOM measurements to eliminate layout thrashing during active token streaming.",
    default: true
  },
  instantBootup: {
    type: "boolean",
    label: "Instant Window Reveal",
    description: "Bypass artificial splash fade delays to make the editor interactive instantly.",
    default: true
  },
  startMaximized: {
    type: "boolean",
    label: "Start Maximized",
    description: "Ensure the editor window opens maximized to fill the full screen.",
    default: true
  },
  soundNotifications: {
    type: "boolean",
    label: "Audio & Desktop Alerts",
    description: "Play pleasant chimes and send notifications when the agent finishes or needs approval.",
    default: true
  },
  soundOnCompletion: {
    type: "boolean",
    label: "Sound on Completion",
    description: "Play audio alert when the agent finishes its response or tasks.",
    default: true
  },
  soundOnApproval: {
    type: "boolean",
    label: "Sound on Approval Needed",
    description: "Play audio alert when the agent halts for your input or tool approval.",
    default: true
  },
  soundTone: {
    type: "select",
    label: "Alert Sound Tone",
    description: "Harmonic tone style synthesized directly via Web Audio.",
    default: "chime",
    options: [
      { value: "chime", label: "Gentle Chime (Dual/Triple tone)" },
      { value: "ping", label: "Subtle Ping (Crisp glass)" },
      { value: "bell", label: "Harmonic Bell (Warm resonance)" }
    ]
  },
  soundVolume: {
    type: "number",
    label: "Alert Volume (%)",
    description: "Volume level from 0 (silent) to 100.",
    default: 75,
    min: 0,
    max: 100
  },
  notifyInBackgroundOnly: {
    type: "boolean",
    label: "Alert Only in Background",
    description: "Only play audio and send alerts when Antigravity is minimized or Alt-Tabbed.",
    default: true
  },
  desktopNotification: {
    type: "boolean",
    label: "Windows Desktop Notification",
    description: "Show a native Windows banner notification when you are in another app.",
    default: true
  },
  grillNotifications: {
    type: "boolean",
    label: "Interactive Question Toasts",
    description: "Show rich actionable toast with choices when agent asks questions while in background.",
    default: true
  },
  grillQuickActions: {
    type: "boolean",
    label: "Remote Quick-Choice Buttons",
    description: "Allow answering directly from Windows notification buttons without switching windows.",
    default: true
  },
  customCompletionSound: {
    type: "string",
    label: "Custom Completion Sound (.wav/.mp3)",
    description: "Optional absolute file path to your own completion audio file.",
    default: "",
    placeholder: "C:/path/to/completion.wav"
  },
  customApprovalSound: {
    type: "string",
    label: "Custom Approval Sound (.wav/.mp3)",
    description: "Optional absolute file path to your own approval audio file.",
    default: "",
    placeholder: "C:/path/to/approval.wav"
  },
  testSound: {
    type: "action",
    label: "Preview Sound",
    action: "Test Sound",
    onSelect: () => {
      if (testSoundHandler) return testSoundHandler();
      return "Sound preview played!";
    }
  },
  testToast: {
    type: "action",
    label: "Preview Question Toast",
    action: "Test Toast",
    onSelect: () => {
      if (testToastHandler) return testToastHandler();
      return "Preview question toast with quick-action buttons sent!";
    }
  },
  terminalSplitMode: {
    type: "select",
    label: "Split Terminal Layout",
    description: "Layout for split terminal panes: auto stacks vertically when narrow, vertical always stacks top-and-bottom.",
    default: "auto",
    options: [
      { value: "auto", label: "Smart Responsive (Auto-stack when narrow)" },
      { value: "vertical", label: "Always Stack Vertically (Top & Bottom)" },
      { value: "horizontal", label: "Always Horizontal (Side by Side)" }
    ]
  }
});
