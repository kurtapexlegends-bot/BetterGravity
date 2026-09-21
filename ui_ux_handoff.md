# BetterGravity UI/UX Architecture & Technical Handoff Specification (/init)

## 1. Overview & Architecture Philosophy

This document serves as the authoritative technical specification, architectural handoff, and developer initialization runbook (`/init`) for BetterGravity:
- **Cupertino Dark Theme**: [`community/themes/cupertino-dark.css`](file:///c:/SIDEPROJECTS/BetterGravity/community/themes/cupertino-dark.css)
- **Gemini App Integration**: [`community/plugins/gemini-app`](file:///c:/SIDEPROJECTS/BetterGravity/community/plugins/gemini-app)
- **Fork Chat Integration**: [`community/plugins/fork-chat`](file:///c:/SIDEPROJECTS/BetterGravity/community/plugins/fork-chat)

### Core Directives & Design Philosophy
The system implements macOS/iOS Human Interface Guidelines (HIG) visual physics:
1. **Multi-Tier Surface Hierarchy**: True dark canvas (`#0c0c0e`), elevated containers (`#1e1e24`), and glassmorphic overlays.
2. **Directional Specular Lighting**: 1px top highlight shaders simulating a virtual top-down light source.
3. **Apple HIG Kinetic Curves**: Liquid spring transitions (`cubic-bezier(0.16, 1, 0.3, 1)` and `cubic-bezier(0.34, 1.56, 0.64, 1)`) across all layout transitions.
4. **Zero Verification Theater**: Deterministic test assertions and runtime state verification. No synthetic polling loops or MutationObserver thrashing.
5. **Runtime Parity**: Continuous sync between local repository code and the active `%APPDATA%\BetterGravity` runtime.

---

## 2. Design Tokens & System Variables

The design token system resides in [`cupertino-dark.css`](file:///c:/SIDEPROJECTS/BetterGravity/community/themes/cupertino-dark.css) and exposes tokens consumed across all plugins:

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

---

## 3. Comprehensive Workspace Component Layout

```text
+-------------------------------------------------------------------------------------------------------------------------+
|                                                      TITLEBAR                                                           |
|  [Window Controls]  [Breadcrumbs: Workspace > Project / File.ts]                 [#gemini-web-header-btn] [More Actions] |
+-------------------------------+-------------------------------------------------------------+---------------------------+
|            SIDEBAR            |                     CONVERSATION STREAM                     |      AUXILIARY PANE       |
|                               |                                                             |     (In-Built Browser)    |
|  [Expanded 288px / Rail 52px] |  +-------------------------------------------------------+  |                           |
|  [Logo & Expand/Collapse]     |  | User Message Bubble                                   |  |                           |
|                               |  +-------------------------------------------------------+  |                           |
|  [Chat | Work Sliding Switch] |                                                             |                           |
|  - Liquid Spring Capsule      |  +-------------------------------------------------------+  |  [CDP DOM Inspector /     |
|  - Drag / Touch Gesture       |  | Assistant Response Bubble                             |  |   Live Webview /          |
|                               |  |                                                       |  |   Process Console]        |
|  [+ New Chat (Pinned)]        |  |  +-------------------------------------------------+  |  |                           |
|                               |  |  | Code Block Header: [Lang] [Copy / Fork Button]  |  |  |                           |
|  Shortcuts Section [v]        |  |  |-------------------------------------------------|  |  |                           |
|  - CSS Grid Accordion         |  |  | Code Editor Syntax Surface                      |  |  |                           |
|  - History, Skills, Browser   |  |  +-------------------------------------------------+  |  |                           |
|                               |  |                                                       |  |                           |
|  ---------------------------  |  |  [Glassmorphic Quote Floating Popover]                |  |                           |
|  Conversation List (Virtual)  |  +-------------------------------------------------------+  |                           |
|  - Staged opacity reveal      |                                                             |                           |
|  - Zero scroll mutation loops |-------------------------------------------------------------|                           |
|                               |                          COMPOSER                           |                           |
|  ---------------------------  |  +-------------------------------------------------------+  |                           |
|  Footer (User Pill / Gear)    |  | Textarea / File Context Chips           [Send Action] |  |  (Enforced Min-Width      |
|  - 92px column-reverse rail   |  +-------------------------------------------------------+  |   >= 320px)               |
+-------------------------------+-------------------------------------------------------------+---------------------------+
```

---

## 4. Root-Cause Analyses & Permanent Architectural Fixes

### 4.1 Left Sidebar 52px Icon Rail Collapse Bug
- **Symptom**: When clicking `[data-testid="sidebar-toggle"]`, the outer container shrank to 52px, but internal elements remained wide: Chat and Work overlapped into `"ChWo"`, the section header squished into `"SH"`, icons were clipped, and the user card overflowed.
- **Root Cause**:
  1. Outer container width was driven by `html:has([data-testid="sidebar-toggle"][aria-expanded="false"])`.
  2. Inner child rules only targeted `[role="navigation"][data-collapsed="true"]` or `html[data-sidebar-collapsed="true"]`.
  3. In Antigravity's host environment, `aria-expanded="false"` is set immediately on the button without `data-collapsed` being immediately present on the navigation container.
- **Permanent Solution**:
  - Enhanced all collapsed selectors in [`sidebar.css`](file:///c:/SIDEPROJECTS/BetterGravity/community/plugins/gemini-app/styles/sidebar.css) with `html:has([data-testid="sidebar-toggle"][aria-expanded="false"])`.
  - In 52px mode:
    - `.gemini-experience-tabs-wrap` and `[data-gemini-experience-slider]` are hidden (`display: none !important; opacity: 0;`).
    - `.gemini-experience-collapsed-btn` smoothly scales to 1.
    - `#gemini-scroll-nav-header` is completely hidden (`display: none !important;`).
    - All nav items convert to 32×32 circular buttons with `margin: 0.5px auto !important; justify-content: center !important;`.
    - All labels (`span.truncate`, `span:last-child`, `.willow-sidenav-text`) are hidden.
    - User pill collapses to a centered 32×32 avatar circle with `.gemini-user-text` hidden.
  - In [`index.js`](file:///c:/SIDEPROJECTS/BetterGravity/community/plugins/gemini-app/index.js), `toggleObserver` and `isSidebarCollapsed` immediately synchronize `data-sidebar-collapsed` and `data-collapsed`.

### 4.2 Liquid Smooth Buttery Sliding Animation (Chat ↔ Work)
- **Symptom**: Slider jumpiness, stiff decelerations, and sub-pixel misalignment when toggling between Chat and Work.
- **Root Cause**:
  1. Slider translation for Work was set to `calc(100% - 2px)`, under-translating by 2px because percentage translates in CSS are relative to the slider's own width.
  2. Tab text colors lacked transition synchronization with the moving capsule.
- **Permanent Solution**:
  - Corrected Work transform in [`sidebar.css`](file:///c:/SIDEPROJECTS/BetterGravity/community/plugins/gemini-app/styles/sidebar.css) to exact `translate3d(100%, 0, 0)`.
  - Tuned the slider kinetic curve to Apple HIG liquid easing (`cubic-bezier(0.16, 1, 0.3, 1)`) over `320ms`.
  - Added active squish response on pointer drag (`scaleX` stretch in [`index.js`](file:///c:/SIDEPROJECTS/BetterGravity/community/plugins/gemini-app/index.js)) and subtle interaction brightness response.
  - Added synchronized 240ms cubic-bezier text and badge crossfades.

### 4.3 Smooth Shortcuts Accordion Expand / Collapse
- **Symptom**: Shortcuts section snapped in and out abruptly without animation when clicking the section header.
- **Root Cause**: While [`sidebar.css`](file:///c:/SIDEPROJECTS/BetterGravity/community/plugins/gemini-app/styles/sidebar.css) defined a CSS Grid accordion (`grid-template-rows: 1fr` ↔ `0fr`), [`index.js`](file:///c:/SIDEPROJECTS/BetterGravity/community/plugins/gemini-app/index.js) in `ensureScrollNav()` continuously stamped inline `display: none !important;`, killing the CSS Grid interpolation.
- **Permanent Solution**:
  - Removed the inline `display: none` override in `ensureScrollNav()`.
  - Accordion height interpolates smoothly via CSS Grid (`grid-template-rows: 1fr` ↔ `0fr`) over `280ms cubic-bezier(0.16, 1, 0.3, 1)`.
  - The chevron indicator rotates `-90deg` smoothly using the same kinetic curve.

### 4.4 Code Block Layout & Double-Nested Cards Fix
- **Symptom**: Code blocks rendered as cramped horizontal rows or wrapped in redundant double card containers in the conversation stream.
- **Root Cause**: Host flex rules on parent message wrappers lacked `flex-direction: column` constraints for code children, and theme rules double-applied borders and background cards on both the container and inner pre/code tags.
- **Permanent Solution**:
  - Added strict block-flow rules in [`conversation.css`](file:///c:/SIDEPROJECTS/BetterGravity/community/plugins/gemini-app/styles/conversation.css) and [`cupertino-dark.css`](file:///c:/SIDEPROJECTS/BetterGravity/community/themes/cupertino-dark.css).
  - Enforced `width: 100%`, `display: flex; flex-direction: column;`, and stripped duplicate inner backgrounds.

### 4.5 Shortcuts Mutation Observer Loop Guard
- **Symptom**: Toggling the sidebar or shortcuts triggered recursive DOM mutation loops and high CPU usage.
- **Root Cause**: `ensureScrollNav()` in [`index.js`](file:///c:/SIDEPROJECTS/BetterGravity/community/plugins/gemini-app/index.js) called `replaceChildren` unconditionally on every observation tick.
- **Permanent Solution**:
  - Added array equality guard before DOM replacement:
    ```js
    const current = [...block.children];
    if (wanted.length !== current.length || wanted.some((row, i) => current[i] !== row)) {
      block.replaceChildren(...wanted);
    }
    ```

---

## 5. File & Runtime Sync Matrix

| Repository Source File | `%APPDATA%\BetterGravity` Runtime Target | Description |
| :--- | :--- | :--- |
| [`community/themes/cupertino-dark.css`](file:///c:/SIDEPROJECTS/BetterGravity/community/themes/cupertino-dark.css) | `%APPDATA%\BetterGravity\themes\cupertino-dark.css` | Surface hierarchy, specular shaders, Apple HIG physics |
| [`community/plugins/gemini-app/index.js`](file:///c:/SIDEPROJECTS/BetterGravity/community/plugins/gemini-app/index.js) | `%APPDATA%\BetterGravity\plugins\gemini-app\index.js` | Sidebar state orchestration, drag physics, DOM guards |
| [`community/plugins/gemini-app/styles/sidebar.css`](file:///c:/SIDEPROJECTS/BetterGravity/community/plugins/gemini-app/styles/sidebar.css) | `%APPDATA%\BetterGravity\plugins\gemini-app\styles\sidebar.css` | 52px rail styling, slider spring kinetics, CSS Grid accordion |
| [`community/plugins/gemini-app/styles/conversation.css`](file:///c:/SIDEPROJECTS/BetterGravity/community/plugins/gemini-app/styles/conversation.css) | `%APPDATA%\BetterGravity\plugins\gemini-app\styles\conversation.css` | Message stream layout, code block containers, bubble sizing |
| [`community/plugins/fork-chat/index.js`](file:///c:/SIDEPROJECTS/BetterGravity/community/plugins/fork-chat/index.js) | `%APPDATA%\BetterGravity\plugins\fork-chat\index.js` | Fork action injection, scroll listener lifecycle |

---

## 6. Verification & Automated Test Matrix

Run the comprehensive test suite:
```powershell
npx vitest run packages/runtime/tests/catalog.test.ts packages/runtime/tests/theme-bundle.test.ts packages/runtime/tests/gemini-navigation.test.ts packages/runtime/tests/fork-chat.test.ts packages/runtime/tests/gemini-app-performance.test.ts packages/runtime/tests/fork-chat-settings.test.ts packages/runtime/tests/gemini-app-streaming.test.ts
```

### Baseline Test Results
```text
Test Files  7 passed (7)
     Tests  131 passed (131)
```

---

## 7. Developer `/init` Quickstart & Runbook

### Deploying Changes to Live Antigravity Runtime
After editing repository files, synchronize them immediately to `%APPDATA%\BetterGravity`:
```powershell
Copy-Item -Path "community\plugins\gemini-app\*" -Destination "$env:APPDATA\BetterGravity\plugins\gemini-app\" -Recurse -Force
Copy-Item -Path "community\themes\*" -Destination "$env:APPDATA\BetterGravity\themes\" -Recurse -Force
```
Then reload the Antigravity window with **`Ctrl+R`**.

### Emergency Revert Runbook
To completely discard uncommitted changes and revert both repo and runtime to the last git commit:
```powershell
# 1. Discard uncommitted repo changes
git restore .

# 2. Re-sync restored files to runtime
Copy-Item -Path "community\plugins\gemini-app\*" -Destination "$env:APPDATA\BetterGravity\plugins\gemini-app\" -Recurse -Force
Copy-Item -Path "community\themes\*" -Destination "$env:APPDATA\BetterGravity\themes\" -Recurse -Force
```
