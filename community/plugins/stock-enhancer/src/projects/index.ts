// Native Pro (Stock Enhancer) — Projects Domain Exports
import { syncBridgeProjects } from "./helpers";
import { setupConversationMoveEnhancer } from "./dnd";

export * from "./helpers";
export * from "./modal";
export * from "./dnd";

export function initProjectsDomain(): void {
  syncBridgeProjects();
  setupConversationMoveEnhancer();
}
