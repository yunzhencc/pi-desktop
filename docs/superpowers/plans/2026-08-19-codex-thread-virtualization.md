# Codex Thread Virtualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render Pi chat turns with Codex-style virtualization and bottom-anchored scrolling.

**Architecture:** A pure layout module computes estimated/measured turn offsets and the overscanned viewport range. A React scroll component measures mounted turns, keeps an anchor when sizes change, and follows streaming output only while already near the bottom. HomePage supplies its existing message state as turns.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, browser ResizeObserver.

**Spec:** docs/superpowers/specs/2026-08-19-codex-thread-virtualization-design.md

## Global Constraints

- Retain the existing TranscriptUpdate IPC and HomePage message state.
- Do not add a virtual-list dependency.
- Keep the existing plain-text message UI; Codex-only item types are out of scope.
- Test all non-trivial layout and scroll branches before their production code.

---

### Task 1: Pure turn-layout virtualizer

**Files:**

- Create: src/renderer/src/components/thread-virtualizer.ts
- Create: src/renderer/src/components/thread-virtualizer.test.ts

**Interfaces:**

- Produces: buildThreadLayout(turns, measuredHeights, gapPx, defaultHeightPx): ThreadLayout.
- Produces: visibleThreadRange({ distanceFromBottomPx, layout, overscanCount, viewportHeightPx }): ThreadRange.
- Produces: preserveAnchorDistance({ anchorKey, distanceFromBottomPx, nextLayout, previousLayout }): number | null.
- Consumed by: ThreadScrollLayout in Task 2.

- [ ] **Step 1: Write the failing layout tests**

~~~
it('uses measured heights and returns an overscanned bottom-anchored range', () => {
  const layout = buildThreadLayout([{ key: 'one' }, { key: 'two' }, { key: 'three' }], new Map([['two', 80]]), 10, 40);

  expect(layout.totalHeightPx).toBe(180);
  expect(visibleThreadRange({ distanceFromBottomPx: 0, layout, overscanCount: 1, viewportHeightPx: 50 })).toEqual({ startIndex: 0, endIndex: 3 });
});

it('keeps the anchor turn at the same visual position after a height change', () => {
  const previous = buildThreadLayout([{ key: 'one' }, { key: 'two' }], new Map(), 8, 40);
  const next = buildThreadLayout([{ key: 'one' }, { key: 'two' }], new Map([['one', 80]]), 8, 40);

  expect(preserveAnchorDistance({ anchorKey: 'two', distanceFromBottomPx: 12, previousLayout: previous, nextLayout: next })).toBe(52);
});
~~~

- [ ] **Step 2: Run the test to verify it fails**

Run: pnpm exec vitest run src/renderer/src/components/thread-virtualizer.test.ts

Expected: FAIL because thread-virtualizer does not exist.

- [ ] **Step 3: Write the minimal implementation**

~~~
export interface ThreadTurn { key: string; estimatedHeightPx?: number }
export interface ThreadLayout { bottomOffsetsPx: number[]; heightsPx: number[]; totalHeightPx: number; turnIndexByKey: Map<string, number>; turnKeys: string[] }
export interface ThreadRange { startIndex: number; endIndex: number }

export function buildThreadLayout(turns: ThreadTurn[], measuredHeights: ReadonlyMap<string, number>, gapPx: number, defaultHeightPx: number): ThreadLayout {
  // Fill heights from measuredHeights, then estimatedHeightPx, then defaultHeightPx.
  // Build top offsets and convert them to bottom offsets for bottom-anchored binary searches.
}
~~~

Implement the range lookup with a local binary-search helper over bottomOffsetsPx; return an exclusive endIndex. Return null from preserveAnchorDistance if the anchor is absent from either layout.

- [ ] **Step 4: Run the tests to verify they pass**

Run: pnpm exec vitest run src/renderer/src/components/thread-virtualizer.test.ts

Expected: PASS.

- [ ] **Step 5: Commit**

~~~
git add src/renderer/src/components/thread-virtualizer.ts src/renderer/src/components/thread-virtualizer.test.ts
git commit -m "feat: add thread layout virtualizer"
~~~

### Task 2: Bottom-anchored measured scroll surface

**Files:**

- Create: src/renderer/src/components/thread-scroll-layout.tsx
- Create: src/renderer/src/components/thread-scroll-layout.test.tsx

**Interfaces:**

- Consumes: buildThreadLayout, visibleThreadRange, and preserveAnchorDistance from Task 1.
- Produces: ThreadScrollLayout<T extends ThreadTurn>({ children, turns }: { children: (turn: T) => ReactNode; turns: T[] }): JSX.Element.
- Consumed by: HomePage in Task 3.

- [ ] **Step 1: Write the failing scroll behavior tests**

~~~
it('does not force the reader back to bottom after they scroll away', () => {
  const { rerender } = render(<ThreadScrollLayout turns={[{ key: 'first' }, { key: 'second' }]}>{turn => <article>{turn.key}</article>}</ThreadScrollLayout>);
  const transcript = screen.getByRole('log');
  Object.defineProperties(transcript, { clientHeight: { value: 100 }, scrollHeight: { value: 260, configurable: true } });
  transcript.scrollTop = 20;
  fireEvent.scroll(transcript);

  rerender(<ThreadScrollLayout turns={[{ key: 'first' }, { key: 'second' }, { key: 'third' }]}>{turn => <article>{turn.key}</article>}</ThreadScrollLayout>);
  expect(transcript.scrollTop).toBe(20);
});

it('pins new content to the bottom while the reader is at the bottom', () => {
  const { rerender } = render(<ThreadScrollLayout turns={[{ key: 'first' }, { key: 'second' }]}>{turn => <article>{turn.key}</article>}</ThreadScrollLayout>);
  const transcript = screen.getByRole('log');
  Object.defineProperties(transcript, { clientHeight: { value: 100 }, scrollHeight: { value: 260, configurable: true } });
  transcript.scrollTop = 160;
  fireEvent.scroll(transcript);

  rerender(<ThreadScrollLayout turns={[{ key: 'first' }, { key: 'second' }, { key: 'third' }]}>{turn => <article>{turn.key}</article>}</ThreadScrollLayout>);
  expect(transcript.scrollTop).toBe(160);
});
~~~

- [ ] **Step 2: Run the test to verify it fails**

Run: pnpm exec vitest run src/renderer/src/components/thread-scroll-layout.test.tsx

Expected: FAIL because ThreadScrollLayout does not exist.

- [ ] **Step 3: Write the minimal scroll component**

~~~
export function ThreadScrollLayout<T extends ThreadTurn>({ children, turns }: {
  children: (turn: T) => ReactNode;
  turns: T[];
}) {
  // Keep a scroll-element ref and Map<string, number> of measured heights.
  // Observe rendered wrappers with ResizeObserver.
  // Render top and bottom spacers around only the visible turns.
  // When distanceFromBottomPx <= 24, scroll to the bottom after data/size updates.
}
~~~

Set role="log" and aria-live="polite" on the scroll element. On an update away from the bottom, preserve the measured anchor turn's position. Dispose ResizeObserver, scroll listeners, and animation-frame handles in effect cleanup. Use native scrollTop and scrollHeight; do not simulate scrolling with React state.

- [ ] **Step 4: Run the tests to verify they pass**

Run: pnpm exec vitest run src/renderer/src/components/thread-scroll-layout.test.tsx

Expected: PASS.

- [ ] **Step 5: Commit**

~~~
git add src/renderer/src/components/thread-scroll-layout.tsx src/renderer/src/components/thread-scroll-layout.test.tsx
git commit -m "feat: add anchored thread scroll layout"
~~~

### Task 3: Integrate Pi transcript turns

**Files:**

- Modify: src/renderer/src/pages/home.tsx
- Modify: src/renderer/src/pages/home.test.tsx
- Modify: src/renderer/src/global.css

**Interfaces:**

- Consumes: ThreadScrollLayout from Task 2.
- Preserves: window.api.composer.onUpdate and ChatComposer's onSubmitted(text) contract.
- Produces: a virtualized transcript within HomePage.

- [ ] **Step 1: Write the failing integration test**

~~~
it('renders submitted and streamed turns through the transcript log', () => {
  const onUpdate = vi.fn(() => () => {});
  vi.stubGlobal('api', { composer: { onUpdate } });
  render(<HomePage />);

  fireEvent.click(screen.getByRole('button', { name: 'Fake composer' }));
  expect(screen.getByRole('log')).toHaveTextContent('Build this');

  const receive = onUpdate.mock.calls[0]![0];
  receive({ type: 'assistant', text: 'Working', done: false });
  expect(screen.getByRole('log')).toHaveTextContent('Working');
});
~~~

- [ ] **Step 2: Run the test to verify it fails**

Run: pnpm exec vitest run src/renderer/src/pages/home.test.tsx

Expected: FAIL because the transcript does not expose the virtualized log contract.

- [ ] **Step 3: Integrate the layout and CSS**

~~~
const turns = messages.map(message => ({ key: String(message.id), message }));

<ThreadScrollLayout turns={turns}>
  {({ message }) => <article className={`chat-message chat-message-${message.role}`}>{message.text}</article>}
</ThreadScrollLayout>
~~~

Declare the local turn type as ThreadTurn & { message: Message } so the child callback does not perform a linear find. Replace chat-transcript's direct-list styling with the scroll-surface class while retaining current content width, padding, message appearance, and composer placement.

- [ ] **Step 4: Run integration and full verification**

Run: pnpm exec vitest run src/renderer/src/pages/home.test.tsx && pnpm exec vitest run && pnpm typecheck && pnpm build && git diff --check

Expected: all commands pass with no TypeScript errors or whitespace errors.

- [ ] **Step 5: Commit**

~~~
git add src/renderer/src/pages/home.tsx src/renderer/src/pages/home.test.tsx src/renderer/src/global.css
git commit -m "feat: virtualize chat transcript"
~~~
