import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface ContextMetrics {
  readonly used: number;
  readonly limit: number;
  readonly ratio: number;
  readonly percentage: number;
  readonly remaining: number;
  readonly modelName: string;
  readonly stepCount: number;
  readonly userTokens: number;
  readonly modelTokens: number;
  readonly toolTokens: number;
  readonly systemTokens: number;
  readonly sessionId: string;
  readonly riskLevel: "LOW" | "MODERATE" | "HIGH";
  readonly riskMessage: string;
}

interface CacheRecord {
  transcriptPath: string;
  mtimeMs: number;
  size: number;
  metrics: ContextMetrics;
}

let cachedRecord: CacheRecord | null = null;
let lastBrainScanTime = 0;
let lastDiscoveredSessionId = "";
let lastDiscoveredTranscriptPath = "";
const BRAIN_SCAN_INTERVAL_MS = 15000;

export function readContextMetrics(requestedSessionId?: string): ContextMetrics {
  const homedir = os.homedir();
  const brainDir = path.join(homedir, ".gemini", "antigravity", "brain");
  let targetSessionId = (requestedSessionId || "").trim();
  let transcriptPath = "";

  if (targetSessionId) {
    const candidate = path.join(brainDir, targetSessionId, ".system_generated", "logs", "transcript.jsonl");
    if (fs.existsSync(candidate)) {
      transcriptPath = candidate;
    }
  }

  if (!transcriptPath && fs.existsSync(brainDir)) {
    const now = Date.now();
    if (lastDiscoveredTranscriptPath && fs.existsSync(lastDiscoveredTranscriptPath)) {
      transcriptPath = lastDiscoveredTranscriptPath;
      targetSessionId = lastDiscoveredSessionId;
    }

    if (!transcriptPath || now - lastBrainScanTime > BRAIN_SCAN_INTERVAL_MS) {
      lastBrainScanTime = now;
      try {
        const entries = fs.readdirSync(brainDir, { withFileTypes: true });
        let newestTime = 0;
        for (const entry of entries) {
          if (entry.isDirectory() && entry.name !== "tempmediaStorage") {
            const tPath = path.join(brainDir, entry.name, ".system_generated", "logs", "transcript.jsonl");
            if (fs.existsSync(tPath)) {
              try {
                const stat = fs.statSync(tPath);
                const mtime = stat.mtimeMs;
                if (mtime > newestTime) {
                  newestTime = mtime;
                  targetSessionId = entry.name;
                  transcriptPath = tPath;
                }
              } catch {}
            }
          }
        }
        if (transcriptPath) {
          lastDiscoveredSessionId = targetSessionId;
          lastDiscoveredTranscriptPath = transcriptPath;
        }
      } catch {}
    }
  }

  // Fast-path: If the transcript file exists and mtime + size haven't changed, return cached metrics immediately
  if (transcriptPath && fs.existsSync(transcriptPath)) {
    try {
      const stat = fs.statSync(transcriptPath);
      if (
        cachedRecord &&
        cachedRecord.transcriptPath === transcriptPath &&
        cachedRecord.mtimeMs === stat.mtimeMs &&
        cachedRecord.size === stat.size
      ) {
        return cachedRecord.metrics;
      }
    } catch {}
  }

  let userTokens = 0;
  let modelTokens = 0;
  let toolTokens = 0;
  const systemTokens = 8500;
  let stepCount = 0;
  let detectedModel = "";

  if (transcriptPath && fs.existsSync(transcriptPath)) {
    try {
      const content = fs.readFileSync(transcriptPath, "utf8");
      const lines = content.split("\n");

      // Scan bottom-up for model detection matching user's ModelDetector
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (!line) continue;
        // Only match explicit model selection events
        const modelEventMatch = line.match(/(?:Model Selection`? from [^ ]+ to|"modelName":\s*"|"model":\s*")([A-Za-z0-9. ()-]+)/i);
        if (modelEventMatch && modelEventMatch[1]) {
          detectedModel = modelEventMatch[1].trim();
          break;
        }
      }

      // Compute exact token counts matching user's ContextAnalyzer
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const step = JSON.parse(trimmed);
          stepCount++;
          const type = step.type || "UNKNOWN";
          const contentStr = typeof step.content === "string"
            ? step.content
            : (step.content ? JSON.stringify(step.content) : "");
          const estimated = Math.ceil(contentStr.length / 4);

          if (type === "USER_INPUT") {
            userTokens += estimated;
          } else if (type === "PLANNER_RESPONSE") {
            modelTokens += estimated;
          } else {
            toolTokens += estimated;
          }
        } catch {}
      }
    } catch {}
  }

  if (!detectedModel) {
    try {
      const settingsPath = path.join(homedir, ".gemini", "settings.json");
      if (fs.existsSync(settingsPath)) {
        const parsed = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
        if (parsed?.model?.name) detectedModel = parsed.model.name;
      }
    } catch {}
  }

  if (!detectedModel) {
    try {
      const cockpitFile = path.join(homedir, ".antigravity_cockpit", "server.json");
      if (fs.existsSync(cockpitFile)) {
        const serverData = JSON.parse(fs.readFileSync(cockpitFile, "utf8"));
        if (serverData.default_model) detectedModel = serverData.default_model;
      }
    } catch {}
  }

  if (!detectedModel) {
    detectedModel = "Gemini 3.8 Flash";
  }

  const lower = detectedModel.toLowerCase();
  let limitTokens = 1048576; // 1M default

  if (lower.includes("pro")) {
    limitTokens = 2097152; // 2M
  } else if (lower.includes("claude") || lower.includes("sonnet")) {
    limitTokens = 200000;
  } else if (lower.includes("gpt-4") || lower.includes("gpt4") || lower.includes("openai") || lower.includes("deepseek")) {
    limitTokens = 128000;
  }

  const used = systemTokens + userTokens + modelTokens + toolTokens;
  const ratio = Math.min(Math.max(used / limitTokens, 0), 1);
  const percentage = Math.min(100, Math.round((used / limitTokens) * 1000) / 10);
  const remaining = Math.max(0, limitTokens - used);

  let riskLevel: "LOW" | "MODERATE" | "HIGH" = "LOW";
  const formatLimit = limitTokens >= 1000000 ? `${(limitTokens / 1000000).toFixed(1)}M` : `${Math.round(limitTokens / 1000)}k`;
  let riskMessage = `🟢 Low Risk: Optimal context recall & reasoning precision for ${detectedModel}.`;

  if (percentage >= 70) {
    riskLevel = "HIGH";
    riskMessage = `🔴 High Risk (>70% of ${formatLimit} tokens): ${detectedModel} is prone to hallucinations. Compact session!`;
  } else if (percentage >= 50) {
    riskLevel = "MODERATE";
    riskMessage = `🟡 Moderate Risk (50-70% of ${formatLimit} tokens): Attention density dilutes beyond 50% capacity.`;
  }

  const metrics: ContextMetrics = {
    used,
    limit: limitTokens,
    ratio,
    percentage,
    remaining,
    modelName: detectedModel,
    stepCount,
    userTokens,
    modelTokens,
    toolTokens,
    systemTokens,
    sessionId: targetSessionId,
    riskLevel,
    riskMessage
  };

  if (transcriptPath && fs.existsSync(transcriptPath)) {
    try {
      const stat = fs.statSync(transcriptPath);
      cachedRecord = {
        transcriptPath,
        mtimeMs: stat.mtimeMs,
        size: stat.size,
        metrics
      };
    } catch {}
  }

  return metrics;
}

