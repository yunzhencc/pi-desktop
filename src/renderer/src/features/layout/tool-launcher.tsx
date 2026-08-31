import { ClipboardCheck, FolderOpen, Globe2, MessageCirclePlus, Terminal } from 'lucide-react';
import { useIntl } from 'react-intl';

interface ToolLauncherProps {
  filesAvailable: boolean;
  onOpenFiles: () => void;
}

export function ToolLauncher({ filesAvailable, onOpenFiles }: ToolLauncherProps) {
  const { formatMessage } = useIntl();
  const tools = [
    { icon: ClipboardCheck, id: 'review', shortcut: '⌃⇧G' },
    { icon: Terminal, id: 'terminal', shortcut: '⌃`' },
    { icon: Globe2, id: 'browser', shortcut: '⌘T' },
    { icon: FolderOpen, id: 'files', shortcut: '⌘P' },
    { icon: MessageCirclePlus, id: 'sideChat', shortcut: '⌥⌘S' },
  ] as const;

  return (
    <section aria-label={formatMessage({ id: 'toolLauncher.title' })} className="flex h-full min-w-0 flex-1 items-center justify-center px-6 pt-11.5">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-2 shadow-sm">
        <h2 className="px-2 py-1.5 text-sm font-medium text-foreground">{formatMessage({ id: 'toolLauncher.title' })}</h2>
        <div className="space-y-1">
          {tools.map(({ icon: Icon, id, shortcut }) => {
            const isFiles = id === 'files';
            const enabled = isFiles && filesAvailable;
            const label = formatMessage({ id: `toolLauncher.${id}` });
            const shortcutChip = <kbd className="rounded border border-border bg-surface-tertiary px-1.5 py-0.5 font-sans text-xs text-text-secondary">{shortcut}</kbd>;

            return enabled
              ? (
                  <button aria-label={formatMessage({ id: 'fileViewer.title' })} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm text-foreground hover:bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] focus-visible:outline-2 focus-visible:outline-[var(--focus)]" key={id} onClick={onOpenFiles} type="button">
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1">{label}</span>
                    {shortcutChip}
                  </button>
                )
              : (
                  <div aria-disabled="true" className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-text-secondary opacity-60" key={id}>
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1">{label}</span>
                    {shortcutChip}
                  </div>
                );
          })}
        </div>
      </div>
    </section>
  );
}
