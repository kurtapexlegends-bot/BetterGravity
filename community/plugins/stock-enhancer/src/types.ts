// Native Pro (Stock Enhancer) — Types & Ambient Declarations

export interface StockEnhancerSettings {
  enableProgressRing: boolean;
  enableSpeedMetric: boolean;
  enableJumpToBottom: boolean;
  enableScrollOptimization: boolean;
  instantBootup: boolean;
  startMaximized: boolean;
  soundNotifications: boolean;
  soundOnCompletion: boolean;
  soundOnApproval: boolean;
  soundTone: "chime" | "ping" | "bell";
  soundVolume: number;
  notifyInBackgroundOnly: boolean;
  desktopNotification: boolean;
  grillNotifications: boolean;
  grillQuickActions: boolean;
  customCompletionSound: string;
  customApprovalSound: string;
  testSound?: () => string;
  testToast?: () => string;
  terminalSplitMode: "auto" | "vertical" | "horizontal";
}

export interface ContextMetrics {
  used: number;
  limit?: number;
  percentage?: number;
  remaining?: number;
  systemTokens?: number;
  userTokens?: number;
  modelTokens?: number;
  toolTokens?: number;
}

export interface PromptOption {
  text: string;
  element: HTMLElement | null;
}

export interface QuestionPrompt {
  id: string;
  question: string;
  options: PromptOption[];
  hasWriteIn?: boolean;
  writeInPlaceholder?: string;
  continueBtn?: HTMLElement | null;
  skipBtn?: HTMLElement | null;
  card?: HTMLElement | null;
}

export interface ProjectRecord {
  projectId: string;
  label: string;
  conversations: any[];
  count: number;
}

export interface MoveConversationResult {
  success: boolean;
  message?: string;
}

declare global {
  const plugin: any;
  const BetterGravity: any;

  interface Window {
    __betterGravityBridge?: any;
    __bettergravityConversationProjectMap?: Map<string, string>;
    __bettergravityTriggerListRerender?: () => void;
    webkitAudioContext?: typeof AudioContext;
  }
}
