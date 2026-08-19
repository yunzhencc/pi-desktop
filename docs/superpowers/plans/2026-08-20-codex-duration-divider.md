# Codex Duration Divider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render conversation duration as a persistent, full-width Codex-style divider rather than content inside an assistant message.

**Architecture:** Restore each historical assistant turn with its start time taken from the preceding user turn and its completion time from the assistant message timestamp. Render that duration before the assistant article within the same virtualized turn, preserving the active one-second refresh and completed frozen value.

**Tech Stack:** React, TypeScript, react-intl, Vitest, OverlayScrollbars virtualized transcript.

**Spec:** User request in this task: align persistent duration UI with Codex.

## Global Constraints

- Reuse existing session message timestamps; do not add a second persistence format.
- Use existing `react-intl` duration strings.
- Do not render a disclosure control without activity details to disclose.

---

### Task 1: Restore historical duration metadata

**Files:**
- Modify: `src/renderer/src/pages/home.tsx:67-75`
- Test: `src/renderer/src/pages/home.test.tsx`

**Consumes:** `PiSessionSnapshot.messages` ordered user/assistant messages with `timestamp`.

**Produces:** Completed assistant `Message` records with `startedAtMs` from their preceding user record and `completedAtMs` from their own timestamp.

- [ ] **Step 1: Write the failing test**

```text
act(() => window.dispatchEvent(new CustomEvent('session-changed', {
  detail: { messages: [
    { role: 'user', text: 'Earlier request', timestamp: 1_000 },
    { role: 'assistant', text: 'Earlier reply', timestamp: 66_000 },
  ] },
})));
expect(screen.getByText('耗时 1分 5秒')).not.toBeNull();
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/renderer/src/pages/home.test.tsx --testNamePattern 'restores completed duration'`

Expected: FAIL because opened assistant messages have no `completedAtMs`.

- [ ] **Step 3: Implement the minimum restore mapping**

```text
let latestUserStartedAtMs: number | undefined;
return session.messages.map((message, index) => {
  if (message.role === 'user') latestUserStartedAtMs = message.timestamp || undefined;
  return message.role === 'assistant'
    ? { completedAtMs: message.timestamp || undefined, done: true, id: index, role: message.role, startedAtMs: latestUserStartedAtMs, text: message.text }
    : { done: true, id: index, role: message.role, startedAtMs: message.timestamp || undefined, text: message.text };
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/renderer/src/pages/home.test.tsx --testNamePattern 'restores completed duration'`

Expected: PASS.

### Task 2: Render duration as the turn divider

**Files:**
- Modify: `src/renderer/src/pages/home.tsx:222-240`
- Modify: `src/renderer/src/global.css:864-879`
- Test: `src/renderer/src/pages/home.test.tsx`

**Consumes:** Completed or active assistant `Message` duration metadata.

**Produces:** A full-width duration divider rendered before each assistant article, with its own horizontal rule.

- [ ] **Step 1: Write the failing test**

```text
const divider = screen.getByText('耗时 1分 5秒').closest('[data-duration-divider]');
expect(divider).not.toBeNull();
expect(divider?.nextElementSibling).toHaveClass('chat-message-assistant');
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/renderer/src/pages/home.test.tsx --testNamePattern 'renders completed duration as a divider'`

Expected: FAIL because `WorkedFor` is nested inside `.chat-message-assistant`.

- [ ] **Step 3: Implement the minimum independent divider**

```text
{message.role === 'assistant' && <WorkedFor {...message} />}
<article className={`chat-message chat-message-${message.role}`}>…</article>
```

```text
return <div className="chat-worked-for" data-duration-divider><p>{label}</p><div /></div>;
```

```text
.chat-worked-for { width: 100%; color: var(--text-tertiary); }
.chat-worked-for > div { border-top: 1px solid var(--border-subtle); }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/renderer/src/pages/home.test.tsx --testNamePattern 'renders completed duration as a divider'`

Expected: PASS.

### Task 3: Verify the integrated behavior

**Files:**
- Test: `src/renderer/src/pages/home.test.tsx`

- [ ] **Step 1: Run the home-page test file**

Run: `pnpm exec vitest run src/renderer/src/pages/home.test.tsx`

Expected: PASS.

- [ ] **Step 2: Run repository checks**

Run: `pnpm exec vitest run && pnpm run typecheck && pnpm run lint && git diff --check`

Expected: all tests and typecheck pass; lint has no errors.
