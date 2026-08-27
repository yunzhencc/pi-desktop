import type { ProvidersSnapshot } from '@shared/types';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { ProvidersSettingsView } from '../providers';

export { ProvidersSettingsView } from '../providers';

export function ProvidersPage() {
  const { formatMessage } = useIntl();
  const [snapshot, setSnapshot] = useState<ProvidersSnapshot>();
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    void window.piApp.providers.get()
      .then((snapshot) => {
        if (active) {
          setLoadError(false);
          setSnapshot(snapshot);
        }
      })
      .catch(() => {
        if (active)
          setLoadError(true);
      });
    const removeListener = window.piApp.providers.onChanged((snapshot) => {
      if (active) {
        setLoadError(false);
        setSnapshot(snapshot);
      }
    });
    return () => {
      active = false;
      removeListener();
    };
  }, []);

  if (loadError) {
    return (
      <div className="settings-provider-view h-full min-h-0 overflow-hidden pt-11.5">
        <section className="mx-auto box-border flex h-full w-full max-w-[58rem] min-w-0 flex-col px-8 pt-5.5 pb-6">
          <p className="m-0 text-sm text-text-tertiary" role="alert">{formatMessage({ id: 'providers.error.load' })}</p>
        </section>
      </div>
    );
  }

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
