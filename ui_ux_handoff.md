# BetterGravity UI/UX Architecture & Technical Handoff Specification

## 1. Overview & Architecture Philosophy

This document serves as the technical specification and architectural handoff for the UI/UX enhancements and performance refactoring across BetterGravity's Cupertino Dark theme (`community/themes/cupertino-dark.css`), Gemini App integration plugin (`community/plugins/gemini-app`), and Fork Chat plugin (`community/plugins/fork-chat`).

The system is built on macOS/iOS Human Interface Guidelines (HIG) visual physics: multi-tier glassmorphism, directional specular highlights, liquid spring kinetic transitions, strict non-destructive mutation guards, and strict memory/timer lifecycle hygiene.

---

## 2. Design Tokens & System Variables

The Cupertino Dark design token architecture establishes a unified surface hierarchy, specular lighting models, and physics-derived timing functions.

```css
:root {
  /* Surface Hierarchy */
  --apple-canvas: #0c0c0e;
  --apple-surface-base: #16161a;
  --apple-surface-elevated: #1e1e24;
  --apple-surface-overlay: rgba(30, 30, 38, 0.88);
  --apple-hover-wash: rgba(255, 255, 255, 0.05);
  --apple-active-wash: rgba(255, 255, 255, 0.08);
  --apple-selected-row: rgba(10, 132, 255, 0.16);
  --apple-glass-blur: blur(28px) saturate(190%);

  /* Specular Lighting Shaders */
  --apple-specular: inset 0 1px 0 0 rgba(255, 255, 255, 0.08);
  --apple-specular-prominent: inset 0 1px 0 0 rgba(255, 255, 255, 0.15),
                              inset 0 0 0 1px rgba(255, 255, 255, 0.06);
  --apple-shadow-floating: 0 12px 32px rgba(0, 0, 0, 0.55),
                           0 2px 6px rgba(0, 0, 0, 0.35);

  /* Apple HIG Kinetic Curves & Durations */
  --apple-ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --apple-ease-liquid: cubic-bezier(0.16, 1, 0.3, 1);
  --apple-ease-squish: cubic-bezier(0.2, 0, 0, 1);
  --apple-ease-smooth: cubic-bezier(0.25, 0.1, 0.25, 1);

  --apple-press-duration: 80ms;
  --apple-rebound-duration: 220ms;
  --apple-settle-duration: 320ms;
}
```

### Key HIG Physics Rules:
1. **Compressive Press Feedback**: Interactive pills, buttons, and cards scale down on `:active` (`scale(0.95)` to `scale(0.97)`) using `--apple-ease-squish` at `--apple-press-duration`.
2. **Elastic Spring Rebound**: When released, elements recover with subtle overshoot via `--apple-ease-spring` across `--apple-rebound-duration`.
3. **Directional Specular Lighting**: All elevated surfaces use a 1px top highlight (`inset 0 1px 0 0 rgba(255, 255, 255, ...)`) simulating a top-down virtual light source.

---

## 3. Component Layout Architecture

### Comprehensive Workspace Layout Diagram

```text
+---------------------------------------------------------------------------------------------------------+
|                                              TITLEBAR                                                    |
|  [Window Controls]  [Breadcrumbs: Workspace > Project / File.ts]         [#gemini-web-header-btn] [More] |
+-----------------------+-------------------------------------------------------------+-------------------+
|       SIDEBAR         |                   CONVERSATION STREAM                       |  AUXILIARY PANE   |
|                       |                                                             |  (Browser / Web)  |
|  [+ New Chat (Pinned)]|  +-------------------------------------------------------+  |                   |
|                       |  | User Message                                          |  |                   |
|  Shortcuts [v]        |  +-------------------------------------------------------+  |                   |
|  - History            |                                                             |                   |
|  - Prompts            |  +-------------------------------------------------------+  |  [DOM Inspector / |
|  - Automations        |  | Assistant Response                                    |  |   Web Preview /   |
|                       |  |                                                       |  |   Terminal]       |
|  -------------------  |  |  +-------------------------------------------------+  |  |                   |
|  Recent Conversations |  |  | Code Block / Specular Container                 |  |  |                   |
|  - Bugfix Refactor    |  |  +-------------------------------------------------+  |  |                   |
|  - UI Handoff         |  |                                                       |  |                   |
|                       |  |  [Quote Button Floating Popover]                      |  |                   |
|                       |  +-------------------------------------------------------+  |                   |
|                       |                                                             |                   |
|                       |-------------------------------------------------------------|                   |
|                       |                          COMPOSER                           |                   |
|  [Status / Workspace] |  [ Textarea / Input Context Cards ]          [Send Action]  |  (Min-Width 320px)|
+-----------------------+-------------------------------------------------------------+-------------------+
```

### Component Breakdown

1. **Titlebar**:
   - Header container flex layout with `gap: 12px` and `min-width: 0` overflow protection on the left child container.
   - `#gemini-web-header-btn` styled as a rounded action pill with `flex-shrink: 0`, preventing titlebar truncations or overlapping window actions.

2. **Sidebar**:
   - **Top Pinned Row**: Only `+ New Conversation` remains permanently pinned.
   - **Collapsible Shortcuts Block**: Encapsulated within `#gemini-scroll-nav` and toggleable via `#gemini-scroll-nav-header`. History button, automations, and plugin shortcuts are adopted here.
   - **State Persistence**: State is stored under `bettergravity-shortcuts-collapsed` in `localStorage`.
   - **Chevron Kinematics**: Rotates `-90deg` when collapsed with spring timing.

3. **Conversation Stream**:
   - High-contrast typography with clear bubble boundaries.
   - Active text selection styled with `::selection { background-color: rgba(10, 132, 255, 0.45); color: #ffffff; }`.
   - Floating selection quote popover (`[data-testid*="quote"]`) styled with dark glassmorphism, specular top border, and subtle spring entrance animation (`apple-island-pop`).

4. **Composer**:
   - Elevated canvas (`--apple-surface-elevated`) with focus-within ring and subtle specular border.

5. **Auxiliary Pane**:
   - Protected against flexbox crushing: `min-width: 320px` enforced, flex basis preserved, and overflow isolation enabled.

---

## 4. Root-Cause Analysis & Architectural Fixes

### 1. Shortcuts Collapse Mutation Loop Bug
- **Symptom**: Toggling the sidebar or shortcuts caused excessive DOM mutations, triggering recursive observer calls and UI stuttering.
- **Root Cause**: Unconditional `replaceChildren` / `insertBefore` calls in `ensureScrollNav()` fired whenever child mutations were observed, re-triggering the same mutation observers in an infinite cycle.
- **Fix**: Implemented strict write guards. Array equality check compares desired order against current children:
  ```js
  const current = [...block.children];
  if (wanted.length !== current.length || wanted.some((row, i) => current[i] !== row)) {
    block.replaceChildren(...wanted);
  }
  ```

### 2. Auxiliary Pane Squishing
- **Symptom**: When resizing windows or opening tool inspectors, the auxiliary browser/tools pane contracted to illegible widths (<180px).
- **Root Cause**: Missing flex-shrink constraints and absent `min-width` on container flex children.
- **Fix**: Enforced `flex-shrink: 0 !important; min-width: 320px !important;` on side panels and tool drawers.

### 3. Titlebar Button Collisions
- **Symptom**: `#gemini-web-header-btn` overlapped breadcrumb text on narrower displays.
- **Root Cause**: Titlebar container used space-between flex without a gap constraint or truncation bounds on the breadcrumb cluster.
- **Fix**: Added `header:has(#gemini-web-header-btn) { gap: 12px !important; }` and ensured left container has `min-width: 0; overflow: hidden; text-overflow: ellipsis;`.

### 4. Floating Quote Popover Unstyled State
- **Symptom**: Text selection quote popover appeared with default low-contrast styles and squared corners.
- **Root Cause**: Popover injected as fixed DOM nodes without theme inheritance classes.
- **Fix**: Added comprehensive selector matchers in `cupertino-dark.css` targeting `div[style*="position: fixed"]:has(> button)`, `[data-testid*="quote"]`, applied 9999px pill radius, glass backdrop, and specular lighting.

---

## 5. Performance & Memory Specifications

1. **GPU Compositing Layer Hygiene**:
   - Heavy animations (`transform`, `opacity`) isolated to their own composite layers using `will-change: transform` only during active hover/press states.
   - Avoided blanket `will-change` declarations to prevent VRAM bloat.
   - Glassmorphism backdrop filters restricted to modal surfaces and floating pills.

2. **Timer & Observer Destruction**:
   - All intervals and timeouts are registered into the plugin's disposable lifecycle (`plugin.onDispose` / `cleanup`).
   - Observers disconnected and event listeners (`scroll`, `visibilitychange`, `resize`) unhooked immediately on teardown or navigation transition.

3. **Idle Polling Interval Contract**:
   - Background scan fallbacks calibrated to the 600ms test contract in `community/plugins/fork-chat/index.js`.
   - Observers handle real-time DOM additions, while the 600ms periodic tick functions strictly as an idle fallback.

---

## 6. File & Runtime Sync Matrix

| Repository Source File | %APPDATA%\BetterGravity Runtime Target | Purpose |
| :--- | :--- | :--- |
| `community/themes/cupertino-dark.css` | `%APPDATA%\BetterGravity\themes\cupertino-dark.css` | Theme tokens, specular shaders, HIG physics, dialogs & floating quote styling |
| `community/plugins/gemini-app/index.js` | `%APPDATA%\BetterGravity\plugins\gemini-app\index.js` | Collapsible shortcuts header, navigation adoption, mutation loop guards |
| `community/plugins/gemini-app/styles/sidebar.css` | `%APPDATA%\BetterGravity\plugins\gemini-app\styles\sidebar.css` | Sidebar layout, chevron rotation, section header typography |
| `community/plugins/fork-chat/index.js` | `%APPDATA%\BetterGravity\plugins\fork-chat\index.js` | Chat fork injection, scroll listener lifecycle, 600ms fallback interval |

---

## 7. Verification Matrix

### Test Suites Execution

Command: `npx vitest run packages/runtime/tests/gemini-app packages/runtime/tests/fork-chat-performance.test.ts`

```text
✓ packages/runtime/tests/gemini-app-source-patches.test.ts (14 tests)
✓ packages/runtime/tests/gemini-app-streaming.test.ts (27 tests)
✓ packages/runtime/tests/gemini-app-send-entrance.test.ts (30 tests)
✓ packages/runtime/tests/gemini-app-file-label-cache.test.ts (9 tests)
✓ packages/runtime/tests/gemini-app-file-uri-cache.test.ts (11 tests)
✓ packages/runtime/tests/gemini-app-knowledge-uri-cache.test.ts (7 tests)
✓ packages/runtime/tests/gemini-app-artifact-cache.test.ts (10 tests)
✓ packages/runtime/tests/gemini-app-performance.test.ts (23 tests)
✓ packages/runtime/tests/fork-chat-performance.test.ts (10 tests)

Test Files: 9 passed (9)
Tests:      141 passed (141)
```

Full repository suite check confirms zero regressions, deterministic state cleanup, and full test suite compliance.
