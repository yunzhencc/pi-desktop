import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pi-desktop/shadcn-ui/components/select';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';

export type DeepSeekModel = 'deepseek-v4-flash' | 'deepseek-v4-pro';

interface DeepSeekSettingsViewProps {
  configured: boolean;
  model: DeepSeekModel;
  onSave: (apiKey: string, model: DeepSeekModel) => Promise<void>;
}

export function DeepSeekSettingsView({ configured, model: initialModel, onSave }: DeepSeekSettingsViewProps) {
  const { formatMessage } = useIntl();
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState({ initialModel, value: initialModel });
  const [saving, setSaving] = useState(false);
  const model = selectedModel.initialModel === initialModel ? selectedModel.value : initialModel;

  return (
    <div className="settings-view">
      <section className="settings-content" aria-labelledby="deepseek-settings-title">
        <h1 id="deepseek-settings-title">{formatMessage({ id: 'providers.title' })}</h1>
        <div className="settings-section">
          <h2>{formatMessage({ id: 'providers.deepseek.title' })}</h2>
          <p className="settings-provider-description">{formatMessage({ id: 'providers.deepseek.description' })}</p>
          {configured && <p className="settings-provider-status">{formatMessage({ id: 'providers.deepseek.configured' })}</p>}
          <form
            className="settings-provider-form"
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              try {
                await onSave(apiKey, model);
                setApiKey('');
              }
              finally {
                setSaving(false);
              }
            }}
          >
            <label className="settings-provider-field">
              <span>{formatMessage({ id: 'providers.deepseek.apiKey' })}</span>
              <input aria-label={formatMessage({ id: 'providers.deepseek.apiKey' })} onChange={event => setApiKey(event.target.value)} required type="password" value={apiKey} />
            </label>
            <label className="settings-provider-field">
              <span>{formatMessage({ id: 'providers.deepseek.model' })}</span>
              <Select
                items={[
                  { label: 'DeepSeek V4 Flash', value: 'deepseek-v4-flash' },
                  { label: 'DeepSeek V4 Pro', value: 'deepseek-v4-pro' },
                ]}
                onValueChange={value => setSelectedModel({ initialModel, value: value as DeepSeekModel })}
                value={model}
              >
                <SelectTrigger aria-label={formatMessage({ id: 'providers.deepseek.model' })} className="settings-language-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start" alignItemWithTrigger={false}>
                  <SelectGroup>
                    <SelectItem value="deepseek-v4-flash">DeepSeek V4 Flash</SelectItem>
                    <SelectItem value="deepseek-v4-pro">DeepSeek V4 Pro</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </label>
            <button disabled={saving} type="submit">{formatMessage({ id: 'providers.deepseek.save' })}</button>
          </form>
        </div>
      </section>
    </div>
  );
}

export function ProvidersPage() {
  const [settings, setSettings] = useState({ configured: false, model: 'deepseek-v4-flash' as DeepSeekModel });

  useEffect(() => {
    window.api.providers.getDeepSeek().then(setSettings);
  }, []);

  return (
    <DeepSeekSettingsView
      configured={settings.configured}
      model={settings.model}
      onSave={async (apiKey, model) => setSettings(await window.api.providers.saveDeepSeek(apiKey, model))}
    />
  );
}
