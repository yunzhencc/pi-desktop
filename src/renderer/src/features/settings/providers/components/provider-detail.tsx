import type { ProviderSnapshot, ProvidersSnapshot } from '../../../../../../main/provider-settings';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pi-desktop/shadcn-ui/components/select';
import { useIntl } from 'react-intl';
import { ApiKeyForm } from './api-key-form';
import { ProviderMark } from './provider-mark';

export function ProviderDetail({
  busy,
  defaultModel,
  error,
  onLoginChatGPT,
  onRemove,
  onSaveApiKey,
  onSetDefaultModel,
  onSetPrimaryProvider,
  provider,
}: {
  busy?: string;
  defaultModel?: ProvidersSnapshot['defaultModel'];
  error?: string;
  onLoginChatGPT: () => void;
  onRemove?: () => void;
  onSaveApiKey?: (apiKey: string) => void;
  onSetDefaultModel: (modelId: string) => void;
  onSetPrimaryProvider: () => void;
  provider: ProviderSnapshot;
}) {
  const { formatMessage } = useIntl();
  const selectedModel = defaultModel?.providerId === provider.id ? defaultModel.modelId : provider.models[0]?.id;

  return (
    <article className="settings-provider-detail">
      <header className="settings-provider-detail-header">
        <ProviderMark provider={provider} />
        <div>
          <h2>{provider.name}</h2>
          <p className="settings-provider-status">
            {provider.configured ? formatMessage({ id: 'providers.connected' }) : formatMessage({ id: 'providers.notConnected' })}
            {provider.primary ? ` · ${formatMessage({ id: 'providers.primary' })}` : ''}
          </p>
        </div>
      </header>

      <div className="settings-provider-detail-section">
        <div className="settings-provider-nav-title">{formatMessage({ id: 'providers.auth' })}</div>
        {provider.authType === 'oauth'
          ? <button disabled={busy === 'login-openai-codex'} onClick={onLoginChatGPT} type="button">{formatMessage({ id: 'providers.chatgpt.login' })}</button>
          : onSaveApiKey && <ApiKeyForm disabled={busy === `save-${provider.id}`} onSubmit={onSaveApiKey} />}
        {error && <p className="settings-provider-error" role="alert">{error}</p>}
        {provider.authType === 'api_key' && provider.configured && onRemove && (
          <button className="settings-provider-danger" disabled={busy === `remove-${provider.id}`} onClick={onRemove} type="button">
            {formatMessage({ id: 'providers.remove' })}
          </button>
        )}
      </div>

      <div className="settings-provider-detail-section">
        <div className="settings-provider-nav-title">{formatMessage({ id: 'providers.modelSettings' })}</div>
        {!provider.primary && (
          <button disabled={!provider.configured || busy === `primary-${provider.id}`} onClick={onSetPrimaryProvider} type="button">{formatMessage({ id: 'providers.setPrimary' })}</button>
        )}
        {provider.models.length > 0 && selectedModel
          ? (
              <label className="settings-provider-field">
                <span>{formatMessage({ id: 'providers.defaultModel' })}</span>
                <Select
                  items={provider.models.map(model => ({ label: model.name, value: model.id }))}
                  onValueChange={onSetDefaultModel}
                  value={selectedModel}
                >
                  <SelectTrigger aria-label={`${provider.name} ${formatMessage({ id: 'providers.defaultModel' })}`} className="settings-language-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start" alignItemWithTrigger={false}>
                    <SelectGroup>
                      {provider.models.map(model => <SelectItem key={model.id} value={model.id}>{model.name}</SelectItem>)}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </label>
            )
          : <p className="settings-provider-description">{formatMessage({ id: 'providers.noModels' })}</p>}
      </div>
    </article>
  );
}
