// Native Pro (Stock Enhancer) — Web Audio Synthesis & Notification Engine
import { settings } from "./config";
import { navigateToConversation } from "./shared";

let audioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) audioCtx = new AudioCtxClass();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  } catch {}
  return audioCtx;
}

export function closeAudioContext(): void {
  if (audioCtx) {
    try { audioCtx.close(); } catch {}
    audioCtx = null;
  }
}

export function playSingleNote(ctx: AudioContext, startTime: number, freq: number, duration: number, vol: number, wave: OscillatorType = "sine"): void {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(vol, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration);
  } catch {}
}

export function sendDesktopNotification(title: string, body: string, cascadeId?: string): void {
  if (!settings.desktopNotification) return;
  try {
    if (typeof window.Notification !== "undefined") {
      const show = () => {
        const notif = new Notification(title, { body, silent: true });
        notif.onclick = () => {
          try {
            window.focus();
            if (cascadeId) navigateToConversation(cascadeId);
          } catch {}
        };
      };
      if (Notification.permission === "granted") {
        show();
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then((p) => {
          if (p === "granted") show();
        });
      }
    }
  } catch {}
}

export function playSynthesizedAlert(type: "complete" | "approval"): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const vol = Math.max(0, Math.min(Number(settings.soundVolume || 75) / 100, 1)) * 0.28;
  const now = ctx.currentTime;
  const tone = settings.soundTone || "chime";

  if (type === "approval") {
    // Two-tone alert (D5 -> A5)
    playSingleNote(ctx, now, 587.33, 0.14, vol * 0.9, "sine");
    playSingleNote(ctx, now + 0.12, 880, 0.28, vol, "sine");
  } else {
    // Completion chime
    if (tone === "ping") {
      playSingleNote(ctx, now, 1046.5, 0.35, vol, "sine");
      playSingleNote(ctx, now, 2093, 0.2, vol * 0.4, "sine");
    } else if (tone === "bell") {
      playSingleNote(ctx, now, 440, 0.7, vol * 0.8, "sine");
      playSingleNote(ctx, now, 1210, 0.45, vol * 0.3, "triangle");
      playSingleNote(ctx, now, 2420, 0.25, vol * 0.15, "sine");
    } else {
      // Default: Gentle 3-note harmonic arpeggio (C5 -> E5 -> G5)
      playSingleNote(ctx, now, 523.25, 0.14, vol * 0.8, "sine");
      playSingleNote(ctx, now + 0.10, 659.25, 0.14, vol * 0.85, "sine");
      playSingleNote(ctx, now + 0.20, 783.99, 0.35, vol, "sine");
    }
    sendDesktopNotification("Antigravity: Task Complete", "The agent has finished generating.");
  }
}

export function playAlertSound(type: "complete" | "approval" = "complete", force = false): void {
  if (!force) {
    if (!settings.soundNotifications) return;
    if (type === "complete" && !settings.soundOnCompletion) return;
    if (type === "approval" && !settings.soundOnApproval) return;
    const isOutside = !document.hasFocus() || document.hidden || document.visibilityState === "hidden";
    if (settings.notifyInBackgroundOnly && !isOutside) return;
  }

  const customPath = (type === "approval" ? settings.customApprovalSound : settings.customCompletionSound)?.trim();
  if (customPath) {
    try {
      const uri = customPath.startsWith("http") || customPath.startsWith("file://")
        ? customPath
        : `file:///${customPath.replace(/\\/g, "/")}`;
      const audio = new Audio(uri);
      audio.volume = Math.max(0, Math.min(Number(settings.soundVolume || 75) / 100, 1));
      audio.play().then(() => {
        if (type === "complete") {
          sendDesktopNotification("Antigravity: Task Complete", "The agent has finished generating.");
        }
      }).catch(() => playSynthesizedAlert(type));
      return;
    } catch {}
  }

  playSynthesizedAlert(type);
}
