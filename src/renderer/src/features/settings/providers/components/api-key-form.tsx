import type { SubmitEvent } from 'react';
import { Button } from '@pi-desktop/shadcn-ui/components/button';
import { Field, FieldLabel } from '@pi-desktop/shadcn-ui/components/field';
import { Input } from '@pi-desktop/shadcn-ui/components/input';
import { Eye, EyeOff } from 'lucide-react';
import { useId, useState } from 'react';
import { useIntl } from 'react-intl';

export function ApiKeyForm({ disabled, onSubmit }: { disabled: boolean; onSubmit: (apiKey: string) => void }) {
  const { formatMessage } = useIntl();
  const apiKeyId = useId();
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(apiKey);
    setApiKey('');
  }

  return (
    <form className="flex items-start" onSubmit={submit}>
      <Field className="w-full gap-3">
        <FieldLabel className="text-base font-semibold text-muted-foreground" htmlFor={apiKeyId}>{formatMessage({ id: 'providers.apiKey' })}</FieldLabel>
        <div className="flex w-full gap-3">
          <div className="relative min-w-0 flex-1">
            <Input
              id={apiKeyId}
              className="rounded-md border border-[color-mix(in_srgb,var(--foreground)_16%,transparent)] bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] px-2.5 py-2 text-foreground"
              onChange={event => setApiKey(event.target.value)}
              placeholder="sk-..."
              required
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
            />
            <Button
              aria-label={formatMessage({ id: showApiKey ? 'providers.apiKey.hide' : 'providers.apiKey.show' })}
              className="absolute right-3.5 top-1/2 !size-8 -translate-y-1/2 !bg-transparent !p-0 !text-muted-foreground"
              onClick={() => setShowApiKey(current => !current)}
              size="icon"
              type="button"
              variant="ghost"
            >
              {showApiKey ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </Button>
          </div>
          <Button className="rounded-md bg-foreground px-3 py-[7px] text-background disabled:opacity-[0.55]" disabled={disabled} type="submit">{formatMessage({ id: 'providers.apiKey.save' })}</Button>
        </div>
      </Field>
    </form>
  );
}
