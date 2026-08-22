import type { ProvidersSnapshot } from '@shared/types';
import type { PiRuntime } from '../../pi-runtime';
import type { ProviderSettings } from '../../provider-settings';
import { IPC_CHANNELS } from '@shared/ipc-channels';
import { BrowserWindow } from 'electron';
import { isModelPickerScope, isProviderId } from '../../provider-settings';
import { registerHandler } from '../registry';

interface ProviderHandlerDependencies {
  piRuntime: PiRuntime;
  providerSettings: ProviderSettings;
}

function broadcastProvidersChanged(snapshot: ProvidersSnapshot): void {
  for (const window of BrowserWindow.getAllWindows())
    window.webContents.send(IPC_CHANNELS.ProvidersChanged, snapshot);
}

export function registerProviderHandlers({ piRuntime, providerSettings }: ProviderHandlerDependencies): void {
  registerHandler(IPC_CHANNELS.ProvidersGet, () => providerSettings.snapshot());
  registerHandler(IPC_CHANNELS.ProvidersApiKeySave, async (_event, providerId: unknown, apiKey: unknown) => {
    if (!isProviderId(providerId) || providerId === 'openai-codex' || typeof apiKey !== 'string')
      throw new TypeError('无效的模型供应商配置');
    const snapshot = await providerSettings.saveApiKey(providerId, apiKey);
    piRuntime.refreshModelSettings();
    broadcastProvidersChanged(snapshot);
    return snapshot;
  });
  registerHandler(IPC_CHANNELS.ProvidersRemove, async (_event, providerId: unknown) => {
    if (!isProviderId(providerId) || providerId === 'openai-codex')
      throw new TypeError('无效的模型供应商');
    const snapshot = await providerSettings.removeProvider(providerId);
    piRuntime.refreshModelSettings();
    broadcastProvidersChanged(snapshot);
    return snapshot;
  });
  registerHandler(IPC_CHANNELS.ProvidersChatGptLogin, async () => {
    const snapshot = await providerSettings.loginChatGPT();
    piRuntime.refreshModelSettings();
    broadcastProvidersChanged(snapshot);
    return snapshot;
  });
  registerHandler(IPC_CHANNELS.ProvidersPrimarySet, async (_event, providerId: unknown) => {
    if (!isProviderId(providerId))
      throw new TypeError('无效的主模型供应商');
    const snapshot = await providerSettings.setPrimaryProvider(providerId);
    piRuntime.refreshModelSettings();
    broadcastProvidersChanged(snapshot);
    return snapshot;
  });
  registerHandler(IPC_CHANNELS.ProvidersScopeSet, async (_event, scope: unknown) => {
    if (!isModelPickerScope(scope))
      throw new TypeError('无效的模型选择范围');
    const snapshot = await providerSettings.setModelPickerScope(scope);
    broadcastProvidersChanged(snapshot);
    return snapshot;
  });
  registerHandler(IPC_CHANNELS.ProvidersDefaultModelSet, async (_event, providerId: unknown, modelId: unknown) => {
    if (!isProviderId(providerId) || typeof modelId !== 'string' || !modelId.trim())
      throw new TypeError('无效的默认模型');
    const snapshot = await providerSettings.setDefaultModel(providerId, modelId);
    piRuntime.refreshModelSettings();
    broadcastProvidersChanged(snapshot);
    return snapshot;
  });
}
