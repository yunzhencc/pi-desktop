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
    <article className="flex min-h-0 min-w-0 flex-1 flex-col gap-[18px] p-[18px]">
      <header className="flex items-center gap-4">
        <ProviderMark provider={provider} />
        <div>
          <h2 className="m-0 text-lg font-semibold">{provider.name}</h2>
          <p className="m-0 text-sm text-foreground">
            {provider.configured ? formatMessage({ id: 'providers.connected' }) : formatMessage({ id: 'providers.notConnected' })}
            {provider.primary ? ` · ${formatMessage({ id: 'providers.primary' })}` : ''}
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-2.5 border-t border-border-subtle pt-4">
        <div className="settings-provider-nav-title text-[11px] font-semibold tracking-[0.06em] text-text-tertiary uppercase">{formatMessage({ id: 'providers.auth' })}</div>
        {provider.authType === 'oauth'
          ? <button className="w-fit rounded-md bg-foreground px-3 py-[7px] text-background disabled:opacity-[0.55]" disabled={busy === 'login-openai-codex'} onClick={onLoginChatGPT} type="button">{formatMessage({ id: 'providers.chatgpt.login' })}</button>
          : onSaveApiKey && <ApiKeyForm disabled={busy === `save-${provider.id}`} onSubmit={onSaveApiKey} />}
        {error && <p className="m-0 text-[13px] text-destructive" role="alert">{error}</p>}
        {provider.authType === 'api_key' && provider.configured && onRemove && (
          <button className="w-fit self-start rounded-md border border-[color-mix(in_srgb,#ef4444_35%,transparent)] bg-transparent px-3 py-[7px] text-[#ef4444] disabled:opacity-[0.55]" disabled={busy === `remove-${provider.id}`} onClick={onRemove} type="button">
            {formatMessage({ id: 'providers.remove' })}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2.5 border-t border-border-subtle pt-4">
        <div className="settings-provider-nav-title text-[11px] font-semibold tracking-[0.06em] text-text-tertiary uppercase">{formatMessage({ id: 'providers.modelSettings' })}</div>
        {!provider.primary && (
          <button className="w-fit rounded-md bg-foreground px-3 py-[7px] text-background disabled:opacity-[0.55]" disabled={!provider.configured || busy === `primary-${provider.id}`} onClick={onSetPrimaryProvider} type="button">{formatMessage({ id: 'providers.setPrimary' })}</button>
        )}
        {provider.models.length > 0 && selectedModel
          ? (
              <label className="flex w-[min(100%,28rem)] flex-col gap-2 text-sm">
                <span>{formatMessage({ id: 'providers.defaultModel' })}</span>
                <Select
                  items={provider.models.map(model => ({ label: model.name, value: model.id }))}
                  onValueChange={onSetDefaultModel}
                  value={selectedModel}
                >
                  <SelectTrigger aria-label={`${provider.name} ${formatMessage({ id: 'providers.defaultModel' })}`} className="min-w-32 bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] font-inherit text-inherit">
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
          : <p className="settings-provider-description m-0 text-sm text-text-tertiary">{formatMessage({ id: 'providers.noModels' })}</p>}
      </div>
    </article>
  );
}
