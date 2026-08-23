import { describe, expect, it } from 'vitest';
import {
  appendAssistantMessage,
  appendErrorMessage,
  appendRunningWork,
  appendSubmittedUserMessage,
  applyComposerUpdate,
  restoreSessionMessages,
  settleRunningWork,
  updateUserMessageText,
  upsertToolActivity,
} from './transcript';

describe('conversation transcript model', () => {
  it('restores worked duration before assistant replies without explicit work entries', () => {
    expect(restoreSessionMessages({
      messages: [
        { role: 'user', text: 'Build it', timestamp: 1_000 },
        { role: 'assistant', text: 'Done', timestamp: 4_000 },
      ],
      path: '/sessions/one.jsonl',
    })).toMatchObject([
      { role: 'user', startedAtMs: 1_000, text: 'Build it' },
      { completedAtMs: 4_000, role: 'work', startedAtMs: 1_000, workStatus: 'worked' },
      { role: 'assistant', text: 'Done', timestamp: 4_000 },
    ]);
  });

  it('adds and settles one running work marker', () => {
    const withUser = appendSubmittedUserMessage([], 'Build it', 1_000);
    const running = appendRunningWork(appendRunningWork(withUser, 2_000), 3_000);

    expect(running.filter(message => message.role === 'work')).toHaveLength(1);
    expect(settleRunningWork(running, 5_000)).toMatchObject([
      { role: 'user' },
      { completedAtMs: 5_000, done: true, role: 'work', startedAtMs: 2_000, workStatus: 'worked' },
    ]);
  });

  it('replaces a pending assistant snapshot in place', () => {
    const messages = appendAssistantMessage(
      appendAssistantMessage([{ id: 1_000, role: 'user', startedAtMs: 1_000, text: 'Build it', timestamp: 1_000 }], { done: false, text: 'Fir' }, 2_000),
      { done: false, text: 'First' },
      3_000,
    );

    expect(messages.filter(message => message.role === 'assistant')).toEqual([
      { done: false, id: 2_000, role: 'assistant', text: 'First', timestamp: undefined },
    ]);
  });

  it('updates a running tool activity with completed output', () => {
    const running = upsertToolActivity([], { args: { command: 'git status' }, status: 'running', toolCallId: 'tool-1', toolName: 'bash' }, 1_000);
    const completed = upsertToolActivity(running, { output: 'clean', status: 'completed', toolCallId: 'tool-1', toolName: 'bash' }, 2_000);

    expect(completed).toEqual([
      { done: true, id: 1_000, role: 'activity', text: 'bash', toolArgs: { command: 'git status' }, toolCallId: 'tool-1', toolName: 'bash', toolOutput: 'clean', toolStatus: 'completed' },
    ]);
  });

  it('assigns distinct ids to tool calls received in the same millisecond', () => {
    const first = upsertToolActivity([], { status: 'completed', toolCallId: 'tool-1', toolName: 'bash' }, 1_000);
    const messages = upsertToolActivity(first, { status: 'completed', toolCallId: 'tool-2', toolName: 'read' }, 1_000);

    expect(messages.map(message => message.id)).toEqual([1_000, 1_001]);
  });

  it('assigns the final assistant reply a distinct id after a tool call', () => {
    const activity = upsertToolActivity([], { status: 'completed', toolCallId: 'tool-1', toolName: 'bash' }, 1_000);
    const messages = appendAssistantMessage(activity, { done: true, text: 'Done' }, 1_000);

    expect(messages.map(message => message.id)).toEqual([1_000, 1_001]);
  });

  it('appends errors and updates user message text', () => {
    const messages = appendErrorMessage([{ id: 1_000, role: 'user', text: 'Old' }], 'Failed', 2_000);

    expect(updateUserMessageText(messages, 1_000, 'New')).toMatchObject([
      { id: 1_000, role: 'user', text: 'New' },
      { id: 2_000, role: 'error', text: 'Failed' },
    ]);
  });

  it('applies composer updates through one pure transition entrypoint', () => {
    const running = applyComposerUpdate([], { startedAtMs: 1_000, status: 'running', type: 'status' }, 9_000);
    const failed = applyComposerUpdate(running, { text: 'Nope', type: 'error' }, 2_000);

    expect(failed).toMatchObject([
      { done: false, role: 'work', startedAtMs: 1_000 },
      { id: 2_000, role: 'error', text: 'Nope' },
    ]);
  });

  it('assigns the persisted entry ID to the newest pending user message', () => {
    const messages = appendSubmittedUserMessage([], 'Build it', 1_000);

    expect(applyComposerUpdate(messages, { entryId: 'user-1', type: 'user' })).toMatchObject([
      { entryId: 'user-1', role: 'user', text: 'Build it' },
    ]);
  });
});
