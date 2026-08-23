# Codex 用户消息导航轨 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Pi 对话中交付持久化书签和 Codex 同款用户消息导航轨。

**Architecture:** `PiRuntime` 负责用户 entry ID 和 append-only 书签事件；renderer 的 transcript 把 entry ID、书签恢复到消息状态。`ThreadScrollLayout` 保持滚动/虚拟化所有权，导航轨只消费其显式暴露的目标定位与可见状态。

**Tech Stack:** Electron IPC、Pi SessionManager、React 19、TypeScript、Vitest、IntersectionObserver、CSS。

**Spec:** `docs/superpowers/specs/2026-08-23-codex-user-message-navigation-rail-design.md`

## Global Constraints

- 不新增依赖，不直接读写 Pi JSONL。
- 自定义条目使用 `pi-desktop-turn-bookmark` 和 `{ userEntryId, bookmarked }`。
- 使用现有 `ThreadScrollLayout` 作为唯一滚动容器。
- 视觉、交互、动画与无障碍以安装版 Codex 导航轨源码为准。

---

### Task 1: 会话书签与用户 entry ID

**Files:**
- Modify: `src/shared/ipc-channels.ts`
- Modify: `src/shared/types/index.ts`
- Modify: `src/main/pi-runtime.ts`
- Modify: `src/main/pi-runtime.test.ts`
- Modify: `src/main/ipc/handlers/composer.ts`
- Modify: `src/preload/pi-app-api.ts`
- Modify: `src/preload/index.d.ts`

**Interfaces:**
- Produces: `piApp.composer.setUserMessageBookmarked(userEntryId, bookmarked): Promise<string[]>`.
- Produces: `PiSessionSnapshot.bookmarkedUserEntryIds` and `TranscriptUpdate` user entry ID updates.

- [ ] **Step 1: Write failing main-process tests**

```ts
it('persists the latest bookmark state for a user entry', async () => {
  await runtime.setUserMessageBookmarked('user-1', true);
  await runtime.setUserMessageBookmarked('user-1', false);
  await expect(runtime.openSession(path)).resolves.toMatchObject({ bookmarkedUserEntryIds: [] });
});
```

- [ ] **Step 2: Extend the typed IPC bridge and runtime**

```ts
const turnBookmarkEntryType = 'pi-desktop-turn-bookmark';
session.sessionManager.appendCustomEntry(turnBookmarkEntryType, { bookmarked, userEntryId });
```

- [ ] **Step 3: Restore the last bookmark event per `userEntryId` and emit the real user entry ID at `message_end`**

- [ ] **Step 4: Run**

```bash
pnpm vitest run src/main/pi-runtime.test.ts
```

### Task 2: 导航 item 状态与滚动定位 API

**Files:**
- Modify: `src/renderer/src/features/conversation/model/transcript.ts`
- Test: `src/renderer/src/features/conversation/model/transcript.test.ts`
- Modify: `src/renderer/src/features/conversation/components/thread-scroll-layout/index.tsx`
- Test: `src/renderer/src/features/conversation/components/thread-scroll-layout/index.test.tsx`

**Interfaces:**
- Produces: user messages with stable `entryId` after the user message end update.
- Produces: `ThreadScrollLayout` navigation props for user items, current visible item IDs, and target scrolling.

- [ ] **Step 1: Test user entry ID backfill and navigation target position**

```ts
expect(applyComposerUpdate(messages, { entryId: 'user-1', type: 'user' })).toMatchObject([{ entryId: 'user-1', role: 'user' }]);
```

- [ ] **Step 2: Implement the transcript backfill and scroll layout target resolver**

- [ ] **Step 3: Test virtualized target navigation and current visible range**

- [ ] **Step 4: Run**

```bash
pnpm vitest run src/renderer/src/features/conversation/model/transcript.test.ts src/renderer/src/features/conversation/components/thread-scroll-layout/index.test.tsx
```

### Task 3: Codex-style navigation rail

**Files:**
- Create: `src/renderer/src/features/conversation/components/thread-user-message-navigation-rail/index.tsx`
- Create: `src/renderer/src/features/conversation/components/thread-user-message-navigation-rail/style.css`
- Create: `src/renderer/src/features/conversation/components/thread-user-message-navigation-rail/index.test.tsx`
- Modify: `src/renderer/src/features/conversation/components/index.ts`
- Modify: `src/renderer/src/features/conversation/style.css`

**Interfaces:**
- Consumes: ordered user navigation items, visible IDs, target navigation callback, bookmark callback.
- Produces: a portal navigation rail with click, hover, keyboard, pointer scrubbing and reduced-motion behavior.

- [ ] **Step 1: Test the four-item threshold, active marker and click behavior**

```tsx
render(<ThreadUserMessageNavigationRail items={items} onNavigate={onNavigate} />);
expect(screen.getAllByRole('button')).toHaveLength(4);
fireEvent.click(screen.getByRole('button', { name: 'Jump to user message 2' }));
expect(onNavigate).toHaveBeenCalledWith(items[1], 'smooth');
```

- [ ] **Step 2: Implement Codex marker geometry and tooltip preview**

- [ ] **Step 3: Implement pointer scrubbing, `Alt+Up`/`Alt+Down`, target flash and reduced-motion fallback**

- [ ] **Step 4: Run**

```bash
pnpm vitest run src/renderer/src/features/conversation/components/thread-user-message-navigation-rail/index.test.tsx
```

### Task 4: Conversation integration and verification

**Files:**
- Modify: `src/renderer/src/features/conversation/index.tsx`
- Test: `src/renderer/src/features/conversation/index.test.tsx`
- Modify: `src/renderer/src/features/conversation/style.test.ts`

**Interfaces:**
- Consumes: restored bookmark IDs and user entry ID updates.
- Produces: a full conversation page that renders the navigation rail and writes bookmark state through `piApp`.

- [ ] **Step 1: Test restoration, bookmark toggle and rail wiring from the conversation page**
- [ ] **Step 2: Integrate the rail without altering the empty-conversation path**
- [ ] **Step 3: Run focused verification**

```bash
pnpm vitest run src/main/pi-runtime.test.ts src/renderer/src/features/conversation/model/transcript.test.ts src/renderer/src/features/conversation/components/thread-scroll-layout/index.test.tsx src/renderer/src/features/conversation/components/thread-user-message-navigation-rail/index.test.tsx src/renderer/src/features/conversation/index.test.tsx src/renderer/src/features/conversation/style.test.ts
pnpm typecheck
git diff --check
```

- [ ] **Step 4: Commit**

```bash
git add src/main src/preload src/shared src/renderer docs/superpowers/specs/2026-08-23-codex-user-message-navigation-rail-design.md docs/superpowers/plans/2026-08-23-codex-user-message-navigation-rail.md
git commit -m "feat: add Codex-style user message navigation rail"
```
