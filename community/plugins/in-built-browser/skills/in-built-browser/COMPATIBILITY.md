# BetterGravity transport compatibility

The Browser skill below and the browser-use guides are imported from Codex's
bundled Browser plugin. Their browser-use guidance applies here. The following
adapter notes cover Codex-specific setup, transport, unavailable capabilities,
and the user's tab-sharing preference; they are BetterGravity additions, not
extracted Codex text.

- Use the enabled `in-built-browser` MCP tools. This host does not supply Codex's
  Node REPL `js` tool. Do not discover or bootstrap that tool. Translate the
  source's JavaScript examples with the table below, using the actual tool
  schemas for argument names. Existing browser and tab IDs serve the role of
  persistent JavaScript bindings. The bundled JavaScript client is optional for
  environments that already supply a persistent JavaScript execution tool.
- **Fast-Path Zero-Latency Execution:** The in-app browser ID is always `"iab"`.
  Do NOT call `get_browser` or `get_browser_documentation` during normal operation:
  doing so wastes 2 LLM roundtrips and dumps ~20,000 tokens of documentation into the context.
  Proceed directly to `list_tabs` or `create_tab` using `{"browser_id":"iab"}`. Only call
  `get_browser` / `get_browser_documentation` if troubleshooting an explicit connection failure.
- **Compound Execution Priority (5x-10x Faster):** Avoid turn-by-turn roundtrips (e.g. separate
  tool calls for click, wait, fill, submit). Use `playwright_evaluate` to batch multi-step DOM
  interactions into a single JavaScript snippet:
  ```js
  // Compound action: fill form and submit in a single turn
  const input = document.querySelector('#search');
  input.value = 'query';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('#submit-btn').click();
  return { submitted: true };
  ```
- **Context Hygiene & Fast Observation Hierarchy:**
  1. For fast textual comprehension, call `tabs_content` or `tab_content_export` (returns clean Markdown; lowest token cost, ~200-500 tokens).
  2. For discovering interactive elements, call `tab_ax_get_state` (returns semantic accessibility tree without visual clutter, ~500-1000 tokens).
  3. Avoid `tab_screenshot` and `playwright_dom_snapshot` unless visual/layout verification is explicitly requested.
- **Authenticated Session API Direct Fetch:** Inside `playwright_evaluate`, you have full access
  to the page's origin, cookies, and authorization headers. Run `window.fetch()` directly against
  the site's internal REST or GraphQL endpoints to fetch structured JSON instantly rather than
  scraping paginated DOM.
- This adapter supplies only the in-app browser in the current Antigravity
  conversation. Chrome, Edge, extension instances, and Codex's Settings →
  Computer use installation flow are unavailable here. An explicitly requested
  unavailable browser must be reported as unavailable. Never substitute it
  silently. `get_default_browser` and `get_browser_for_url` select this in-app
  browser when the user has not explicitly named another browser.
- Tools and this skill are registered only while the plugin is enabled. If
  disabled or if the user takes over, stop browser actions. Only the user can
  resume from the pane. Do not change plugin registration to recover access.
- Browser tool calls automatically reveal the pane, as requested for this
  integration. This replaces the source's background-visibility default.
- **BetterGravity tab-sharing policy:** the plugin setting **Same browser tabs
  across all conversations** is enabled by default. The same live tabs are
  available in every conversation. When disabled, tabs are separate for each
  conversation. Browser metadata and tab-list results report
  `sharedTabsAcrossConversations`; tab entries include `openedInConversationId`
  and `usedInCurrentConversation`.
- On first browser use in a new conversation, or one where you have not used
  the browser yet, call `list_tabs`. Reuse a tab the user explicitly asks for,
  or one whose observed URL/title/content is relevant to the current task.
  Otherwise call `create_tab`. Do not navigate or repurpose an unrelated
  active user tab just because it is selected. Relevance is a decision based
  on the user's task and observed tabs, not an automatic URL-match rule.
  Continue using the chosen tab for the same task; do not create a new tab
  for every tool call. These are the user's BetterGravity preferences.
- Tabs persist until closed in this host; there is no automatic end-of-turn
  cleanup. `mark_tab` records a deliverable/handoff mark but does not change
  that lifecycle. Preserve user tabs and leave requested deliverables open.
- Browser Developer mode controls the optional tab-scoped CDP tools. The Codex
  browser-auth broker, Chrome profile management, bot-detection reporting,
  WebMCP, page-asset bundles, and Google Workspace/YouTube exports are not
  supplied. Use only advertised capabilities. `tab_content_export` exports
  visible page text as Markdown in this adapter.
- `browser_annotations` is a BetterGravity addition for reading the user's
  visual page comments. It does not change how page content is trusted.
- Accessibility state is returned as a full snapshot in this adapter; the
  source's incremental AX diff optimization is not implemented. MCP returns
  observations and screenshots directly without a separate display call.

| Codex example | Direct MCP equivalent |
| --- | --- |
| `agent.browsers.get("iab")` | `get_browser({"id":"iab"})` |
| `agent.browsers.getDefault()` | `get_default_browser({})` |
| `agent.browsers.getForUrl(url)` | `get_browser_for_url({"url":url})` |
| `browser.documentation()` | `get_browser_documentation({"browser_id":id})` |
| `agent.documentation.get(name)` | `get_documentation({"name":name})` |
| `browser.tabs.list()`, `.new()`, `.get(id)` | `list_tabs`, `create_tab`, `get_tab` with `browser_id` |
| `tab.goto(url)`, `.screenshot()`, `.ax.write()` | `navigate_tab_url`, `tab_screenshot`, `tab_ax_get_state` with `browser_id` and `tab_id` |
| `tab.playwright.domSnapshot()` | `playwright_dom_snapshot` |
| `tab.playwright` locator operations | `playwright_locator_*` with a selector grounded in the observed page |
| `tab.cua`, `tab.dom_cua`, `tab.ax` | `cua_*`, `dom_cua_*`, `tab_ax_action` |
| `tab.playwright.evaluate(fn)` | `playwright_evaluate`: `script` is an async function body, e.g. `return document.title;`; scoped scripts receive `element` or `elements` |
| `nodeRepl.write(...)` / image display | Read the complete MCP text/image result; retain the source's observation and verification guidance |

The complete browser documentation includes the original API declarations and
the command-to-API mapping. These notes take precedence over the source only
where a host-specific detail above differs.
