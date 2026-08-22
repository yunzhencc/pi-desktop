import type { IpcMainInvokeEvent } from 'electron';
import { ipcMain } from 'electron';

type IpcHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;
type IpcListener = (...args: unknown[]) => void;

const handlers = new Set<string>();

export function registerHandler(channel: string, handler: IpcHandler): void {
  if (handlers.has(channel))
    ipcMain.removeHandler(channel);

  handlers.add(channel);
  ipcMain.handle(channel, handler);
}

export function registerListener(channel: string, listener: IpcListener): void {
  ipcMain.on(channel, listener);
}
