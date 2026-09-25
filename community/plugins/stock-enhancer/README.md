# Native Pro (Stock Enhancer)

A stock-preserving enhancement suite for Google Antigravity. Native Pro keeps 100% of Antigravity's original appearance, colors, and layout, while adding critical ergonomic and performance features:

- **Context Progress Ring**: Miniature circular indicator positioned directly beside the model selector chevron (`^`), displaying context utilization with dynamic risk thresholds (Optimal, Moderate, High Usage).
- **Interactive Context Popover**: One-click detailed breakdown of tokens (System instructions, User prompts, Assistant replies, and Tool executions) with quick actions to **Compact Context** or **Fork Conversation**.
- **Instant Bootup**: Eliminates artificial splash delays and unveils the interactive workspace immediately.
- **Smooth Streaming & Scroll De-jitter**: Batches DOM layout measurements with `requestAnimationFrame` to eliminate stutter during active token streaming, while respecting manual scroll positions when reading.
- **Instant Chat Switching**: Keeps a bounded, memory-safe LRU cache (capped to 3 recent conversations) to switch between sidebar chats without layout thrashing.
- **Jump to Latest Pill**: Subtle floating quick-nav button that appears when scrolled up in conversations.
- **Response Speed Readout**: Discreet `tok/s` token generation speed metric on assistant messages.

## Zero Cosmetic Skinning

This plugin introduces zero theme CSS overrides and modifies zero native color tokens. It natively adapts to both dark and light modes.
