import type { ProvidersSnapshot } from '../../../../../main/provider-settings';
import { useEffect, useState } from 'react';
import { ProvidersSettingsView } from '../providers';

export { ProvidersSettingsView } from '../providers';

export function ProvidersPage() {
  const [snapshot, setSnapshot] = useState<ProvidersSnapshot>();

  useEffect(() => {
    window.api.providers.get().then(setSnapshot);
    return window.api.providers.onChanged(setSnapshot);
  }, []);

  if (!snapshot)
    return null;

  return (
    <ProvidersSettingsView
      onLoginChatGPT={async () => {
        const next = await window.api.providers.loginChatGPT();
        setSnapshot(next);
        return next;
      }}
      onRemove={async (providerId) => {
        const next = await window.api.providers.remove(providerId);
        setSnapshot(next);
        return next;
      }}
      onSaveApiKey={async (providerId, apiKey) => {
        const next = await window.api.providers.saveApiKey(providerId, apiKey);
        setSnapshot(next);
        return next;
      }}
      onSetDefaultModel={async (providerId, modelId) => {
        const next = await window.api.providers.setDefaultModel(providerId, modelId);
        setSnapshot(next);
        return next;
      }}
      onSetPrimaryProvider={async (providerId) => {
        const next = await window.api.providers.setPrimaryProvider(providerId);
        setSnapshot(next);
        return next;
      }}
      onSetScope={async (scope) => {
        const next = await window.api.providers.setModelPickerScope(scope);
        setSnapshot(next);
        return next;
      }}
      snapshot={snapshot}
    />
  );
}
