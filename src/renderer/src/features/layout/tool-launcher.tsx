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
    <section aria-label={formatMessage({ id: 'toolLauncher.title' })} className="flex h-full min-w-0 flex-1 items-center justify-center p-2">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-1">
        {tools.map(({ icon: Icon, id, shortcut }) => {
          const isFiles = id === 'files';
          const enabled = isFiles && filesAvailable;
          const label = formatMessage({ id: `toolLauncher.${id}` });
          const shortcutChip = <kbd className="rounded-full bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] px-1.5 py-0.5 font-sans text-[11px] leading-4 text-text-secondary">{shortcut}</kbd>;

          return enabled
            ? (
                <button aria-label={formatMessage({ id: 'fileViewer.title' })} className="flex min-h-10 w-full items-center gap-2 rounded-md bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] px-2.5 py-2 text-left text-sm text-foreground hover:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] focus-visible:outline-2 focus-visible:outline-[var(--focus)]" key={id} onClick={onOpenFiles} type="button">
                  <Icon aria-hidden="true" className="size-4 shrink-0 text-text-secondary" />
                  <span className="min-w-0 flex-1">{label}</span>
                  {shortcutChip}
                </button>
              )
            : (
                <div aria-disabled="true" className="flex min-h-10 items-center gap-2 rounded-md bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] px-2.5 py-2 text-sm text-text-secondary opacity-55" key={id}>
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1">{label}</span>
                  {shortcutChip}
                </div>
              );
        })}
      </div>
    </section>
  );
}
