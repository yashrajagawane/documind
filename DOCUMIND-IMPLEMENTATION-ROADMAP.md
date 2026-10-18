# DocuMind — 8-Phase Frontend Improvement Roadmap

**Target Repository:** `yashrajagawane/documind`  
**Document Purpose:** Detailed, dependency-aware implementation plan based on the Comprehensive Frontend & UI/UX Audit.  
**Execution Policy:** Strictly sequential. One phase at a time upon explicit authorization. Zero application code modified during Phase 0.

---

## Roadmap Overview

| Phase | Title | Primary Objective | Estimated Complexity | Status |
|---|---|---|:---:|:---:|
| **Phase 1** | Critical Security and Authentication Reliability | Stored XSS defense, 401 auto-refresh coordinator, auth upload guard | **Medium** | ✅ **Completed** |
| **Phase 2** | Functional Correctness and Error Handling | Safe mutations, deletion confirmation, user feedback, error recovery | **Low** | ✅ **Completed** |
| **Phase 3** | Modern Full-Viewport Workspace Redesign | 3-pane split-screen workspace (sidebar, preview, chat) replacing 48rem card | **High** | ✅ **Completed** |
| **Phase 4** | Chat Experience and Workflow Continuity | Auto-scroll, AbortController cancellation, per-document chat continuity | **Medium** | ✅ **Completed** |
| **Phase 5** | Responsive Design and Accessibility | Mobile stacking, ARIA semantics, keyboard navigation, contrast compliance | **Medium** | ✅ **Completed** |
| **Phase 6** | Auth Form Polish and Product Onboarding | Password visibility toggle, validation affordances, contextual empty states | **Low** | ✅ **Completed** |
| **Phase 7** | Frontend Data Management and Performance | React Query integration, visibility-aware polling, cache invalidation | **Medium** | ✅ **Completed** |
| **Phase 8** | Routing, Deep Linking, and Final Quality Assurance | URL document navigation (`?doc=<id>`), deep links, complete test pass | **Medium** | ✅ **Completed** |

---

## Phase 1 — Critical Security and Authentication Reliability

### 1. Objective
Eliminate critical XSS vulnerabilities in markdown rendering, implement seamless token refresh with race-condition prevention, and prevent unauthenticated actions from masquerading as successful.

### 2. Problems Addressed
- **BUG-01 (Stored XSS Risk)**: `MarkdownRenderer.tsx` passes `marked.parse` HTML directly to `dangerouslySetInnerHTML` without sanitization. Malicious document content or adversarial model outputs could execute arbitrary scripts.
- **BUG-02 (Session Expiry Lockout)**: Tokens expire after 60 minutes. Because `apiFetch` does not intercept 401s to invoke `/auth/refresh`, all user interactions abruptly fail, requiring a manual sign-out and re-login.
- **BUG-03 (Silent False-Positive Upload)**: In `page.tsx`, `handleUpload` returns silently when `accessToken` is null/expired, causing `UploadZone.tsx` to display a misleading green `✓ Uploaded` checkmark for non-existent uploads.

### 3. Exact Files and Components Likely to Change
- `frontend/package.json` & `frontend/package-lock.json`: Add `dompurify` and `@types/dompurify` (or `isomorphic-dompurify`).
- `frontend/components/MarkdownRenderer.tsx`: Wrap parsed HTML with `DOMPurify.sanitize`.
- `frontend/components/MarkdownRenderer.test.tsx`: Add test cases for sanitizing dangerous HTML/scripts and attributes.
- `frontend/lib/api.ts`: Add 401 interception, token refresh queueing, and coordinated single-flight refresh promises.
- `frontend/lib/auth-context.tsx`: Expose proactive and reactive token setter/refresh hooks synchronized with `api.ts`.
- `frontend/app/page.tsx`: Update `handleUpload` to throw an explicit error when unauthenticated.
- `frontend/components/UploadZone.test.tsx`: Verify rejection and error state when upload handler throws.

### 4. Implementation Tasks in Execution Order
1. **Sanitize Markdown Output**:
   - Install `dompurify` and `@types/dompurify`.
   - Update `MarkdownRenderer.tsx` to sanitize the output of `marked.parse(content)` before returning HTML. Configure safe URI schemes (`http`, `https`, `mailto`) and allow necessary heading attributes (`id`, `data-section`, `class`).
   - Add unit tests verifying that `<script>`, `onerror`, `javascript:`, and iframe injections are stripped while standard markdown tables and headings remain intact.
2. **Coordinated 401 Interception & Token Refresh**:
   - In `frontend/lib/api.ts`, create a module-scoped refresh promise lock (`refreshPromise: Promise<string | null> | null = null`) so that multiple parallel 401 errors await a single `/auth/refresh` request rather than hammering the endpoint (which would trigger refresh token family reuse revocation).
   - If `/auth/refresh` returns 200 with a new access token, update the in-memory token and replay the queued requests.
   - If `/auth/refresh` returns 401/403 (expired or revoked session), clear session state and dispatch an auth expired event.
3. **Hardened Upload Authentication Guard**:
   - Modify `handleUpload` in `page.tsx` to explicitly throw an error (e.g., `throw new Error("Authentication required. Please sign in.")`) instead of returning `undefined` when `!accessToken`.
   - Ensure `UploadZone.tsx` transitions the queue item to `status: "error"` with the actual error message.

### 5. Dependencies on Previous Phases
None (Foundational Phase).

### 6. Security and Compatibility Considerations
- Maintain backend cookie contract: `documind_refresh` HttpOnly cookie on path `/api/v1/auth`. Never read or write refresh tokens in JavaScript storage (`localStorage` / `sessionStorage`).
- Access tokens remain strictly in-memory.
- Ensure `DOMPurify` does not strip custom attributes needed for citation anchors (`data-section` and `id="sec-..."`).

### 7. Tests and Validation Required
- `npm test`: Run existing and new Vitest tests.
- Verify XSS payload sanitization in `MarkdownRenderer.test.tsx`.
- Simulate 401 response and verify that replay succeeds after mocked refresh.
- Run `npm run typecheck` and `npm run lint`.

### 8. Definition of Done
- Malicious HTML payloads in markdown render as sanitized, harmless text.
- Expired access tokens automatically refresh via cookie without interrupting user workflows or triggering token-family reuse errors.
- Unauthenticated uploads display explicit error status rather than false success.
- All tests pass with zero lint or TypeScript warnings.

### 9. Risks and Rollback Considerations
- **Risk**: Overly strict DOMPurify config could break code block syntax styling or table rendering.
- **Rollback**: Adjust `DOMPurify.sanitize` config options (`ADD_ATTR`, `ALLOWED_TAGS`).

### 10. Expected Outcome
The application is fortified against script injection and session expiration disconnects.

### 11. Estimated Complexity
**Medium**

### 12. Recommended Git Commit Message
```git
fix(security): sanitize markdown output and coordinate session token refresh

- Add DOMPurify sanitization to MarkdownRenderer to protect against stored XSS
- Implement coordinated 401 interceptor with single-flight refresh in api.ts
- Prevent false-positive upload success by raising explicit error on missing auth
- Add regression unit tests for sanitization and auth failure handling
```

---

## Phase 2 — Functional Correctness and Error Handling

### 1. Objective
Guarantee robust document lifecycle mutations (deletion, retries, downloads/exports) with user confirmation, user-facing error reporting, and loading/disabled states.

### 2. Problems Addressed
- **BUG-04 (Unhandled Promise Rejections)**: `handleRemove` (Delete) and `handleDownload` (Export) lack `try/catch` blocks in `page.tsx`. Network drops or 500 errors cause silent failures without user notification.
- **Accidental Deletion**: Clicking "Delete" in `DocumentList.tsx` immediately executes permanent deletion with no confirmation dialog. Its location adjacent to "Preview" makes misclicks frequent.
- **Missing Mutation Loading States**: No visual feedback indicates when an export is preparing or when a document deletion is processing.

### 3. Exact Files and Components Likely to Change
- `frontend/app/page.tsx`: Add comprehensive `try/catch/finally` blocks and loading indicators for deletion and export.
- `frontend/components/DocumentList.tsx`: Add an accessible confirmation modal / 2-step confirmation for deletion, displaying the target filename and consequence warning.
- `frontend/components/DocumentList.test.tsx`: Test deletion confirmation modal interactions and retry triggers.
- `frontend/components/DocumentPreview.tsx`: Add disabled and loading states for export buttons (`Markdown`, `JSON`, `HTML`, `TXT`).

### 4. Implementation Tasks in Execution Order
1. **Deletion Confirmation Modal / Dialog**:
   - In `DocumentList.tsx`, introduce a confirmation state holding the document to be deleted.
   - Render a confirmation modal dialog (`<dialog>` or accessible backdrop) showing: *"Delete '[Document Name]'? This will permanently remove the document, its extracted tables, and indexed vectors. This action cannot be undone."*
   - Provide explicit "Cancel" and "Delete Document" actions.
2. **Safe Mutation Handlers in `page.tsx`**:
   - Wrap `handleRemove` in `try/catch/finally`. Display actionable error messages in `message` state if the delete API fails.
   - Wrap `handleDownload` in `try/catch/finally`. Set an export loading indicator (e.g. `exportingFormat`) to disable export buttons and inform the user.
   - If the currently previewed document is deleted, clean up `preview`, `messages`, and `highlightSection` states gracefully.
3. **Export Loading State in `DocumentPreview.tsx`**:
   - Pass `exporting: boolean` prop to disable buttons and display `"Exporting…"` during blob generation.

### 5. Dependencies on Previous Phases
Builds upon Phase 1's reliable API client and error handling foundation.

### 6. Security and Compatibility Considerations
- Ensure deletion confirmation prevents double-submissions by disabling buttons upon first click.
- Confirmation modal must trap focus and close on `Escape` key.

### 7. Tests and Validation Required
- Vitest tests in `DocumentList.test.tsx`:
  - Clicking "Delete" opens confirmation dialog.
  - Clicking "Cancel" preserves document.
  - Clicking "Confirm" calls `onDelete`.
- Verify error state displays when `apiFetch` rejects during delete.
- `npm run typecheck` and `npm run lint`.

### 8. Definition of Done
- No destructive action occurs without explicit user confirmation.
- Network failures during delete or export surface clear, non-technical error messages.
- Export and delete triggers present visible loading feedback and prevent duplicate requests.

### 9. Risks and Rollback Considerations
- **Risk**: Modal z-index or styling collisions.
- **Rollback**: Revert to inline confirmation prompt ("Click again to confirm delete") if modal overlays conflict with existing layout.

### 10. Expected Outcome
The document management loop is safe, resilient to network anomalies, and transparent in its feedback.

### 11. Estimated Complexity
**Low**

### 12. Recommended Git Commit Message
```git
fix(frontend): add document deletion confirmation and harden mutation error handling

- Add accessible confirmation dialog before document deletion in DocumentList
- Wrap delete and export handlers in try/catch blocks with visible error alerts
- Add disabled and loading states to export buttons during file generation
- Expand DocumentList unit test coverage for confirmation modal flows
```

---

## Phase 3 — Modern Full-Viewport Workspace Redesign

### 1. Objective
Replace the narrow 48rem (768px) centered column with an expansive, full-viewport 3-pane document workspace that enables simultaneous document viewing, table inspection, and AI chat.

### 2. Problems Addressed
- **Information Architecture Collapse**: Stacking uploads, document lists, 28rem previews, and chat panels in a single narrow column requires continuous scrolling up and down.
- **Inability to Cross-Reference**: Users cannot see the document text or tables while typing in or reading the AI chat panel.
- **Wasted Screen Real Estate**: >60% of modern 1080p/1440p displays is blank black space around a centered card.

### 3. Exact Files and Components Likely to Change
- `frontend/app/globals.css`: Add CSS grid/flex tokens for full-height app shell (`--sidebar-width`, split-pane containers, modern typography and surface elevation).
- `frontend/app/page.tsx`: Refactor `DocumentWorkspace` layout into a 3-region workspace:
  - Left: Navigation Sidebar (`DocumentList`, Upload trigger, User header/sign-out).
  - Center: Main Document Viewer (`DocumentPreview`, tabs, tables, raw view, stats).
  - Right: Persistent Chat & Citation Panel (`ChatPanel`).
- `frontend/components/DocumentList.tsx`: Adapt layout for a sidebar list format with compact status chips.
- `frontend/components/DocumentPreview.tsx`: Optimize for flexible center pane with responsive header.
- `frontend/components/ChatPanel.tsx`: Optimize height and scrolling for persistent right pane.

### 4. Implementation Tasks in Execution Order
1. **Design Tokens & Shell Layout in `globals.css`**:
   - Define a root workspace container: `100vh`, `display: flex` or `display: grid; grid-template-columns: 280px 1fr 420px; height: 100vh; overflow: hidden;`.
   - Update typography to modern system stack (Inter, system-ui, -apple-system).
   - Ensure clean borders, surface contrasts, and independent scroll regions for each pane.
2. **Sidebar Migration**:
   - Move branding, user email, document list, and ingestion dropzone/modal trigger into the left sidebar.
   - Style document items with active selection indicator, compact status chips, and hover actions.
3. **Center Document Viewer Workspace**:
   - Give the center pane independent vertical scrolling (`overflow-y: auto`).
   - Position document title, word counts, and export actions in a clean sticky header.
   - Maintain tabs for Rendered Markdown, Raw Source, and Extracted Tables.
4. **Right-Pane Persistent Chat**:
   - Pin the `ChatPanel` to the right with full-height layout: header at top, scrollable conversation history in middle, sticky message form at bottom.
5. **Responsive Collapse Rules**:
   - Tablet (768px–1024px): Collapse to 2 columns (sidebar collapsible, center/right toggle or stacked).
   - Mobile (<768px): Single pane with bottom navigation or top drawer to switch between Document List, Preview, and Chat.

### 5. Dependencies on Previous Phases
Relies on Phase 2's mutation safety and error feedback to avoid layout-breaking alerts.

### 6. Security and Compatibility Considerations
- No backend API changes.
- Existing component props remain backward compatible.

### 7. Tests and Validation Required
- Vitest tests: Ensure all components render in their new container contexts.
- Verify that clicking a document in the sidebar immediately populates the center pane.
- Run `npm run build` and `npm run typecheck`.

### 8. Definition of Done
- Desktop view presents a 3-pane layout without vertical page jumping.
- Center and right panes scroll independently.
- User can read document sections and query the AI simultaneously.
- Zero horizontal overflow.

### 9. Risks and Rollback Considerations
- **Risk**: Fixed-height layouts (`100vh`) can cause issues on mobile browser address bar expansions.
- **Mitigation**: Use `100dvh` (dynamic viewport height) and media queries.

### 10. Expected Outcome
DocuMind immediately transforms into a professional, high-density AI document intelligence workspace.

### 11. Estimated Complexity
**High**

### 12. Recommended Git Commit Message
```git
feat(frontend): implement full-viewport split-pane document workspace

- Replace 48rem centered card with responsive 3-pane desktop workspace
- Implement dedicated left sidebar for document navigation and account controls
- Restructure center pane for independent document preview and table inspection
- Pin ChatPanel to persistent right column for simultaneous reading and querying
- Configure dynamic viewport heights and responsive tablet/mobile fallbacks
```

---

## Phase 4 — Chat Experience and Workflow Continuity

### 1. Objective
Refine the AI conversation experience with smooth auto-scrolling during token streaming, client-side generation cancellation (AbortController), per-document conversation memory, and starter prompt suggestions.

### 2. Problems Addressed
- **Off-Screen Streaming**: As the assistant generates multi-paragraph responses, text streams off the bottom of the container, forcing users to continuously scroll manually.
- **No Generation Cancel**: Users cannot abort a long or mistakenly initiated query; the submit button remains disabled until completion.
- **Wiped Chat History**: Switching documents immediately clears `messages` to `[]`, discarding prior research.
- **Cold-Start Friction**: A newly previewed document displays an empty chat panel with no suggestions or starter queries.

### 3. Exact Files and Components Likely to Change
- `frontend/components/ChatPanel.tsx`: Auto-scroll hook, AbortController cancellation button, starter prompt chips.
- `frontend/components/ChatPanel.test.tsx`: Test auto-scroll behavior, abort handler, and starter prompt clicks.
- `frontend/app/page.tsx`: Manage conversation histories mapped by `documentId` (`Record<string, ChatMessage[]>`).
- `frontend/lib/api.ts`: Pass `AbortSignal` into `apiStreamSSE`.

### 4. Implementation Tasks in Execution Order
1. **Streaming Auto-Scroll with User Scroll Awareness**:
   - Add a sentinel element `<div ref={messagesEndRef} />` at the bottom of the message list.
   - Scroll into view on new tokens unless the user has manually scrolled upward to read earlier content. Re-engage auto-scroll when user returns to bottom.
2. **Client-Side Generation Abort (AbortController)**:
   - Accept an optional `signal?: AbortSignal` in `apiStreamSSE`.
   - In `ChatPanel.tsx` / `page.tsx`, create an `AbortController` on question submit.
   - When `asking === true`, replace the submit button with a prominent "■ Stop" button. Clicking it aborts the fetch signal, appends `"(generation stopped)"` to the message, and unlocks the input.
3. **Per-Document Chat History Memory**:
   - In `page.tsx`, change `messages` state to a map: `chatHistories: Record<string, ChatMessage[]>`.
   - When switching to document `docId`, load `chatHistories[docId] || []`.
   - Prevent cross-contamination while preserving active discussions.
4. **Starter Prompt Chips for Fresh Documents**:
   - When `messages.length === 0`, render 3 clickable query suggestion chips:
     - *"Summarize this document"*
     - *"Extract key tables and numerical data"*
     - *"What are the main findings and conclusions?"*
   - Clicking a chip populates the input and automatically submits the question.

### 5. Dependencies on Previous Phases
Requires Phase 3's dedicated right-hand chat column.

### 6. Security and Compatibility Considerations
- Chat history is stored in React memory only; do not store confidential document excerpts in unencrypted browser storage without authorization.
- Explicitly handle `AbortError` in `apiStreamSSE` so it is not treated as a network failure.

### 7. Tests and Validation Required
- Vitest tests:
  - Verify abort button triggers controller abort.
  - Verify starter prompt chips trigger `onAsk`.
  - Verify switching documents restores document-specific messages.
- `npm run typecheck`.

### 8. Definition of Done
- Assistant answers stream smoothly without requiring manual scroll tracking.
- Users can stop generation at any moment.
- Conversation context is preserved across document switches.
- New documents offer immediate, one-click starter queries.

### 9. Risks and Rollback Considerations
- **Risk**: Aggressive auto-scrolling can hijack user cursor if they are attempting to copy text from an earlier message.
- **Mitigation**: Detect user scroll offset from bottom (`scrollHeight - scrollTop - clientHeight > 50px`) and pause auto-scrolling until returned to bottom.

### 10. Expected Outcome
A fluent, controllable, and responsive conversational experience matching top-tier AI applications.

### 11. Estimated Complexity
**Medium**

### 12. Recommended Git Commit Message
```git
feat(frontend): enhance chat streaming with auto-scroll, abort control, and starter prompts

- Add smart auto-scroll hook to chat history during live SSE token streaming
- Implement AbortController support in apiStreamSSE with interactive Stop button
- Preserve conversation history per document across workspace navigation
- Add contextual starter prompt chips for newly selected documents
```

---

## Phase 5 — Responsive Design and Accessibility

### 1. Objective
Ensure full WCAG AA accessibility compliance, keyboard navigability, semantic screen-reader announcements, and graceful responsive layouts across mobile, tablet, and desktop viewports.

### 2. Problems Addressed
- **Mobile Action Smashing**: On screens <640px, document list action buttons (`Viewing`, `Retry`, `Delete`) wrap irregularly and collide with long document titles and status badges.
- **Screen Reader Opacity**: File dropzone uses `role="button"` on a container with an `aria-hidden` file input; screen readers announce generic buttons rather than standard file picker dialogs.
- **Missing ARIA Roles**: Tabs in `DocumentPreview` lack `role="tabpanel"` and `aria-controls`; `StatusBadge` progress bars lack standard `role="progressbar"` attributes (`aria-valuenow`).
- **Contrast Ratios**: Small secondary text (`#9ca3af` at 12px) on dark backgrounds fails WCAG AAA contrast standards.

### 3. Exact Files and Components Likely to Change
- `frontend/components/DocumentList.tsx`: Responsive flex-wrap/stacking layout and accessible action buttons.
- `frontend/components/UploadZone.tsx`: Accessible native file input labeling and screen-reader announcements.
- `frontend/components/StatusBadge.tsx`: Standard `role="progressbar"` attributes and screen-reader status text.
- `frontend/components/DocumentPreview.tsx`: `role="tablist"` / `role="tabpanel"` pairing with arrow-key navigation.
- `frontend/app/globals.css`: Contrast adjustments, visible focus indicators (`:focus-visible`), and mobile breakpoint styles.

### 4. Implementation Tasks in Execution Order
1. **Mobile Layout Breakpoints in `globals.css`**:
   - In `DocumentList`: below 640px, stack title and badges above an aligned action button row.
   - In `UploadZone`: allow file names in queue to wrap or truncate with tooltip to avoid chip collision.
   - In `DocumentPreview`: stack tab navigation and format toggles cleanly.
2. **Accessible File Upload Zone**:
   - Ensure the hidden file input has an explicit `id="file-upload-input"` and the container or browse trigger has `<label htmlFor="file-upload-input">`.
   - Remove confusing `aria-hidden="true"` from the actual input element so keyboard focus and screen readers recognize native file selection.
3. **Status Badge ARIA Progressbar**:
   - Update `StatusBadge.tsx`:
     ```tsx
     <div
       className="progress-track"
       role="progressbar"
       aria-label={`Processing progress for ${stage || status}`}
       aria-valuenow={progress}
       aria-valuemin={0}
       aria-valuemax={100}
     >
     ```
4. **Accessible TabPanels in `DocumentPreview.tsx`**:
   - Assign `id="tab-markdown"` and `aria-controls="panel-markdown"` to tab buttons.
   - Assign `role="tabpanel" id="panel-markdown" aria-labelledby="tab-markdown"` to content panels.
5. **Focus Ring & Contrast Hardening**:
   - Elevate secondary text color from `#9ca3af` to `#d1d5db` where rendered at 12px/0.75rem.
   - Enforce distinct, high-contrast `:focus-visible` rings for all interactive elements.

### 5. Dependencies on Previous Phases
Applies to components restructured in Phases 2 and 3.

### 6. Security and Compatibility Considerations
Strictly adheres to standard HTML5 semantics and WAI-ARIA authoring practices. Zero browser-specific hacks.

### 7. Tests and Validation Required
- Keyboard-only navigation test: Tab through all interactive elements (Upload, Document select, Delete, Preview tabs, Chat input) with visible focus.
- Vitest tests: Validate updated component attributes in `StatusBadge.test.tsx` and `DocumentPreview.test.tsx`.
- Lighthouse Accessibility audit pass (target >95).

### 8. Definition of Done
- Application is fully functional on viewports from 360px to 4K.
- Screen readers announce file pickers, tab panels, and progress bars accurately.
- All interactive controls have distinct focus outlines.

### 9. Risks and Rollback Considerations
- **Risk**: Native `<label>` click events bubbling twice if parent container also has click handler.
- **Mitigation**: Rely on standard label-to-input association without duplicate container synthetic click dispatchers.

### 10. Expected Outcome
A universally accessible application usable by keyboard and assistive technology users on any device.

### 11. Estimated Complexity
**Medium**

### 12. Recommended Git Commit Message
```git
feat(a11y): improve responsive breakpoints and implement WCAG accessibility standards

- Add responsive mobile layouts for document list actions and upload queues
- Wire standard ARIA progressbar attributes and semantic screen-reader text
- Connect tablist and tabpanel relationships with keyboard focus management
- Elevate text contrast tokens and enforce clear focus-visible outlines
```

---

## Phase 6 — Authentication Form Polish and Product Onboarding

### 1. Objective
Refine authentication forms to eliminate login friction (password length visibility, show/hide toggle), provide clear error guidance, and introduce helpful empty states.

### 2. Problems Addressed
- **12-Character Password Friction**: Backend enforces a 12-character minimum on passwords. Users have no upfront guidance and frequently encounter validation failures without clear explanation.
- **Typo Vulnerability**: No "show password" eye toggle exists, making typing 12+ character secure passwords error-prone on mobile and desktop.
- **Unhelpful Empty States**: Empty document lists display only a plain gray sentence with no visual cue.

### 3. Exact Files and Components Likely to Change
- `frontend/app/page.tsx`: Add password visibility toggle, real-time length hint, and streamlined switch between login/register.
- `frontend/components/DocumentList.tsx`: Illustrated empty state with direct upload call-to-action.
- `frontend/app/globals.css`: Styling for password input with embedded toggle icon and empty-state graphics.

### 4. Implementation Tasks in Execution Order
1. **Password Visibility Toggle & Helper Hint**:
   - In `page.tsx`, add `showPassword` boolean state.
   - Embed an accessible show/hide toggle button inside the password input container.
   - Render a dynamic helper text under the password field:
     - Gray: *"12 characters minimum required"*
     - Green checkmark when `password.length >= 12`.
2. **Clear Authentication Error Mapping**:
   - Translate backend 409 and 422 error codes into human-friendly explanations (e.g., *"This email is already registered. Did you mean to sign in?"*).
3. **Engaging Empty State in `DocumentList.tsx`**:
   - When `documents.length === 0`, render an inviting empty state container with an icon, welcoming copy, and a button that focuses or triggers file selection.

### 5. Dependencies on Previous Phases
Builds on Phase 3's sidebar and layout structure.

### 6. Security and Compatibility Considerations
- Password inputs toggle strictly between `type="password"` and `type="text"`.
- Never log or persist plain-text passwords in memory outside React form state.

### 7. Tests and Validation Required
- Vitest tests:
  - Toggle button toggles password input type.
  - Length indicator updates dynamically.
- `npm run typecheck` and `npm run lint`.

### 8. Definition of Done
- Users can clearly see password length requirements and toggle visibility to fix typos.
- Empty workspaces provide clear guidance on how to begin.

### 9. Risks and Rollback Considerations
- **Risk**: Input layout shift when embedding the visibility button.
- **Mitigation**: Use absolute positioning with `padding-right: 2.5rem` on the input.

### 10. Expected Outcome
Friction-free onboarding and registration with zero ambiguity regarding security requirements.

### 11. Estimated Complexity
**Low**

### 12. Recommended Git Commit Message
```git
feat(frontend): add password visibility toggle, validation hints, and empty states

- Add password visibility toggle and real-time 12-character validation indicator
- Clarify authentication error messages for duplicate emails and invalid formats
- Implement illustrated empty state with direct upload call-to-action
```

---

## Phase 7 — Frontend Data Management and Performance

### 1. Objective
Leverage `@tanstack/react-query` (already present in `package.json`) to introduce automatic caching, eliminate unconstrained background polling, and ensure bulletproof synchronization during rapid document switching.

### 2. Problems Addressed
- **Wasted Background Polling**: `page.tsx` polls `GET /documents` every 2.5s via `setInterval` indefinitely, even when the user switches to another browser tab.
- **Stale Preview Desynchronization**: When a processing document completes, the list updates, but any active preview for that document does not update automatically.
- **Unused Dependencies**: `@tanstack/react-query` is installed in `package.json` and wrapped in `AppProviders.tsx`, but completely unused in application code.

### 3. Exact Files and Components Likely to Change
- `frontend/app/page.tsx`: Replace manual `useEffect` fetch loops with TanStack Query hooks (`useQuery`, `useMutation`).
- `frontend/lib/api.ts`: Ensure query functions integrate cleanly with query keys.
- `frontend/components/DocumentList.tsx`: Receive cached queries and optimistic updates.
- `frontend/components/AppProviders.tsx`: Configure sensible default query client settings (`staleTime`, `refetchOnWindowFocus`).

### 4. Implementation Tasks in Execution Order
1. **Configure QueryClient Defaults in `AppProviders.tsx`**:
   - Set `staleTime: 10_000` (10 seconds), `refetchOnWindowFocus: true`, and exponential backoff retries.
2. **Convert Document List to `useQuery`**:
   - Query key: `["documents", accessToken]`.
   - Add `refetchInterval`: poll every 3000ms **only if** documents exist with `status !== "ready" && status !== "failed"`.
   - React Query automatically pauses polling when the browser tab is hidden/inactive (`document.visibilityState === "hidden"`), saving server CPU and database connections.
3. **Convert Preview to `useQuery`**:
   - Query key: `["document-preview", selectedId, accessToken]`.
   - Enabled only when `selectedId` is non-null.
   - When a document's status transitions to `ready`, automatically invalidate and refetch the preview.
4. **Convert Upload & Delete to `useMutation`**:
   - On upload success: invalidate `["documents"]`.
   - On delete success: remove from cache and clear selection.

### 5. Dependencies on Previous Phases
Relies on Phase 1's 401 interceptor (so React Query queries seamlessly recover from token refreshes) and Phase 2's mutation safety.

### 6. Security and Compatibility Considerations
- Ensure query keys always include `accessToken` or user identifier so switching accounts in the same browser window never exposes another user's cached document data.
- Call `queryClient.clear()` explicitly upon `signOut()`.

### 7. Tests and Validation Required
- Vitest tests: Update mocks to wrap component tests in `QueryClientProvider`.
- Test that polling ceases when all documents reach terminal states.
- Run `npm test`, `npm run typecheck`, and `npm run build`.

### 8. Definition of Done
- Manual `setInterval` loops are replaced with visibility-aware React Query hooks.
- Document and preview states remain synchronized without manual refreshes.
- Switching between previously viewed documents loads previews instantly from cache.

### 9. Risks and Rollback Considerations
- **Risk**: Test fixtures lacking `QueryClientProvider` wrappers failing.
- **Mitigation**: Update shared test render helpers in `tests/setup.ts` or custom render wrapper.

### 10. Expected Outcome
High-efficiency, leak-free data synchronization with instant perceived loading for cached documents.

### 11. Estimated Complexity
**Medium**

### 12. Recommended Git Commit Message
```git
feat(frontend): integrate React Query for visibility-aware polling and preview caching

- Replace manual setInterval polling with visibility-aware React Query refetch
- Implement automatic preview cache invalidation when processing reaches ready state
- Wire mutations for upload and deletion with cache synchronization
- Ensure query cache is purged on logout to prevent cross-account data leakage
```

---

## Phase 8 — Routing, Deep Linking, and Final Quality Assurance

### 1. Objective
Establish a persistent URL navigation model (e.g. `/documents/[id]` or query-param document state) so document views survive page refreshes, and execute a comprehensive final quality assurance regression pass.

### 2. Problems Addressed
- **Refresh State Reset**: The entire application lives on `/`. Refreshing the browser or sharing a URL unselects the active document and resets the view to an empty selection.
- **Back/Forward Button Inoperability**: Browser history does not track document selection. Clicking browser "Back" leaves the application entirely instead of returning to the previous document.
- **Final Regression Verification**: Comprehensive validation across all 8 phases.

### 3. Exact Files and Components Likely to Change
- `frontend/app/page.tsx` & optional `frontend/app/documents/[id]/page.tsx`: Implement route-driven or search-param-driven document selection (`?doc=<id>`).
- `frontend/components/DocumentList.tsx`: Update selection triggers to synchronize with URL router.
- `frontend/tests/*`: Full regression suite updates and end-to-end verification.

### 4. Implementation Tasks in Execution Order
1. **URL-Synchronized Document Selection**:
   - Utilize Next.js router (`useRouter`, `useSearchParams`, or dynamic route `/documents/[id]`) to mirror the selected document ID in the URL.
   - When loading with `?doc=<id>`, automatically load and preview the authorized document once document list query resolves.
   - If the ID does not exist or belongs to another tenant, gracefully fallback to the default list view with a clear notification.
2. **Comprehensive Verification Pass**:
   - **Frontend Unit Tests**: Run `npm test` (all Vitest suites).
   - **TypeScript Strict Check**: Run `npm run typecheck` (`tsc --noEmit`).
   - **ESLint**: Run `npm run lint` (`eslint .`).
   - **Production Build**: Run `npm run build` (`next build`).
   - **Backend Integration Check**: Run backend pytest suite (`pytest backend/tests`) to verify zero regressions in API contracts.
3. **Documentation Alignment**:
   - Update `docs/IMPLEMENTATION-PROGRESS.md` and `README.md` reflecting frontend architectural evolution.

### 5. Dependencies on Previous Phases
Requires all previous phases (1 through 7).

### 6. Security and Compatibility Considerations
- Ensure accessing an unauthorized document ID via URL does not leak existence; gracefully handle 404/403 with standard notification and default view.
- Maintain SSR compatibility for Next.js build.

### 7. Tests and Validation Required
- Vitest tests: Test URL param synchronization and invalid ID fallback.
- `npm test` -> 100% passing.
- `npm run typecheck` -> Exited 0.
- `npm run lint` -> Exited 0.
- `npm run build` -> Standalone production build successful.

### 8. Definition of Done
- Refreshing the browser preserves the active document selection and preview.
- Browser back/forward navigation navigates between document selections.
- All frontend and backend tests pass cleanly with zero warnings or errors.
- The project is fully qualified and ready for release.

### 9. Risks and Rollback Considerations
- **Risk**: Next.js App router `useSearchParams` requiring `<Suspense>` boundaries.
- **Mitigation**: Wrap search-param consumers in `<Suspense fallback={<LoadingShell />}>` as required by Next.js 16.

### 10. Expected Outcome
A complete, refresh-safe, fully accessible, and production-ready document intelligence application.

### 11. Estimated Complexity
**Medium**

### 12. Recommended Git Commit Message
```git
feat(frontend): implement URL-synchronized document navigation and complete QA pass

- Synchronize active document selection with URL parameters for refresh-safe navigation
- Handle invalid or unauthorized document URLs with graceful fallback
- Complete full-suite regression validation: lint, typecheck, Vitest, and production build
- Update project documentation to reflect final V1 frontend architecture
```

---

## Final QA Verification & Implementation Sign-off

| Verification Step | Command | Result | Details |
|---|---|:---:|---|
| **Frontend Unit & Component Tests** | `npm test -- --run` | ✅ **PASS** | 61 tests passing across 9 test files (0 failures) |
| **TypeScript Strict Checking** | `npm run typecheck` | ✅ **PASS** | `tsc --noEmit` exited 0 with 0 errors |
| **ESLint Static Code Quality** | `npm run lint` | ✅ **PASS** | `eslint .` exited 0 with 0 errors and 0 warnings |
| **Production Build Optimization** | `npm run build` | ✅ **PASS** | `next build` compiled and prerendered static pages cleanly |
| **Backend API Contract Tests** | `pytest backend/tests` | ✅ **PASS** | 42 tests passing with 0 errors |

**All 8 Phases of the DocuMind Frontend Improvement Plan have been implemented, tested, verified, and signed off.**
