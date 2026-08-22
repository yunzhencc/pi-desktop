import type { ProvidersSnapshot } from '@shared/types';
import { useEffect, useState } from 'react';
import { ProvidersSettingsView } from '../providers';

export { ProvidersSettingsView } from '../providers';

export function ProvidersPage() {
  const [snapshot, setSnapshot] = useState<ProvidersSnapshot>();

  useEffect(() => {
    window.piApp.providers.get().then(setSnapshot);
    return window.piApp.providers.onChanged(setSnapshot);
  }, []);

  if (!snapshot)
    return null;

  return (
    <ProvidersSettingsView
      onLoginChatGPT={async () => {
        const next = await window.piApp.providers.loginChatGPT();
        setSnapshot(next);
        return next;
      }}
      onRemove={async (providerId) => {
        const next = await window.piApp.providers.remove(providerId);
        setSnapshot(next);
        return next;
      }}
      onSaveApiKey={async (providerId, apiKey) => {
        const next = await window.piApp.providers.saveApiKey(providerId, apiKey);
        setSnapshot(next);
        return next;
      }}
      onSetDefaultModel={async (providerId, modelId) => {
        const next = await window.piApp.providers.setDefaultModel(providerId, modelId);
        setSnapshot(next);
        return next;
      }}
      onSetPrimaryProvider={async (providerId) => {
        const next = await window.piApp.providers.setPrimaryProvider(providerId);
        setSnapshot(next);
        return next;
      }}
      onSetScope={async (scope) => {
        const next = await window.piApp.providers.setModelPickerScope(scope);
        setSnapshot(next);
        return next;
      }}
      snapshot={snapshot}
    />
  );
}
