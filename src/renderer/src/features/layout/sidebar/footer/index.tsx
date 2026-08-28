import { Button } from '@pi-desktop/shadcn-ui/components/button';
import { Link } from '@tanstack/react-router';
import { CircleHelp, Download, LoaderCircle, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';

type AppUpdate = Awaited<ReturnType<Window['piApp']['appUpdates']['get']>>;

const idleUpdate: AppUpdate = { state: 'idle' };

export function Footer() {
  const { formatMessage } = useIntl();
  const [update, setUpdate] = useState<AppUpdate>(idleUpdate);
  const appUpdates = window.piApp?.appUpdates;

  useEffect(() => {
    if (!appUpdates)
      return;
    let active = true;
    void appUpdates.get().then(snapshot => active && setUpdate(snapshot)).catch(() => active && setUpdate(idleUpdate));
    const unsubscribe = appUpdates.onChanged(setUpdate);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [appUpdates]);

  const downloading = update.state === 'downloading';
  const installing = update.state === 'installing';
  const ready = update.state === 'ready';
  const visible = downloading || installing || ready;
  const label = ready
    ? formatMessage({ id: 'appUpdate.install' })
    : installing
      ? formatMessage({ id: 'appUpdate.installing' })
      : update.downloadProgressPercent == null
        ? formatMessage({ id: 'appUpdate.downloading' })
        : formatMessage({ id: 'appUpdate.downloadingPercent' }, { downloadProgressPercent: update.downloadProgressPercent });

  return (
    <div
      className="flex justify-between px-2 py-1"
      style={{
        borderTop: '1px solid color-mix(in srgb, var(--foreground) 10%, transparent)',
      }}
    >
      <Button variant="ghost" size="sm">
        <Link to="/settings/general">
          <Settings />
        </Link>
      </Button>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm">
          <a
            aria-label={formatMessage({ id: 'profile.help' })}
            href="https://github.com/yunzhencc/pi-desktop"
            rel="noreferrer"
            target="_blank"
            title={formatMessage({ id: 'profile.help' })}
          >
            <CircleHelp aria-hidden="true" size={16} strokeWidth={1.75} />
          </a>
        </Button>
        {visible && (
          <button
            aria-label={label}
            className={`group grid h-5 items-center overflow-hidden rounded-full bg-blue-600 text-xs text-white transition-[grid-template-columns,max-width,padding] hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${ready ? 'grid-cols-[0fr] max-w-5 hover:grid-cols-[1fr] hover:max-w-36 hover:px-2.5 focus-visible:grid-cols-[1fr] focus-visible:max-w-36 focus-visible:px-2.5' : 'grid-cols-[1fr] max-w-36 px-2.5 opacity-80'}`}
            disabled={!ready}
            onClick={() => void appUpdates?.install()}
            title={label}
            type="button"
          >
            <span className="flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap">
              {ready ? <Download aria-hidden="true" size={12} /> : <LoaderCircle aria-hidden="true" className="animate-spin" size={12} />}
              <span className={ready ? 'max-w-0 overflow-hidden opacity-0 transition-[max-width,opacity] group-hover:max-w-24 group-hover:opacity-100 group-focus-visible:max-w-24 group-focus-visible:opacity-100' : ''}>{label}</span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
