import type { WorkspaceSnapshot } from '@shared/types';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@pi-desktop/shadcn-ui/components/popover';
import { cn } from '@pi-desktop/shadcn-ui/lib/utils';
import { Command } from 'cmdk';
import { Folder, Plus, Search, X } from 'lucide-react';
import React from 'react';
import { useIntl } from 'react-intl';

export function ProjectPicker({ children, className, onClearProject, onCreateProject, onSelectProject, triggerClassName, workspace }: {
  children: React.ReactNode;
  className?: string;
  onClearProject?: () => void;
  onCreateProject?: () => void;
  onSelectProject?: (path: string) => void;
  triggerClassName?: string;
  workspace?: WorkspaceSnapshot;
}) {
  const { formatMessage } = useIntl();
  const [open, setOpen] = React.useState(false);

  const selectProject = (path: string) => {
    onSelectProject?.(path);
    setOpen(false);
  };

  return (
    <span className={cn('relative', className)} data-clear-project-available={onClearProject ? '' : undefined}>
      <Popover onOpenChange={setOpen} open={open}>
        {onClearProject && (
          <button
            aria-label={formatMessage({ id: 'projects.clear' })}
            className="pointer-events-none absolute inset-y-0 start-[6px] z-[1] flex aspect-square items-center justify-center rounded-full border-0 bg-transparent text-text-tertiary opacity-0 hover:text-foreground focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-focus"
            data-clear-project-button
            onClick={(event) => {
              event.stopPropagation();
              setOpen(false);
              onClearProject();
            }}
            type="button"
          >
            <X aria-hidden="true" size={16} />
          </button>
        )}
        <PopoverTrigger render={<button className={triggerClassName} type="button" />}>
          {children}
        </PopoverTrigger>
        <PopoverContent
          align="center"
          aria-label={formatMessage({ id: 'projects.select' })}
          className="max-h-[min(350px,calc(100vh-16px))] w-max min-w-[260px] max-w-[calc(100vw-16px)] overflow-y-auto rounded-[12px] border border-border-subtle bg-surface-elevated p-1 shadow-[0_8px_16px_-4px_color-mix(in_srgb,#000_12%,transparent)] ring-0"
          role="dialog"
          side="top"
          sideOffset={12}
        >
          <Command
            className="overflow-hidden [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-0 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-text-tertiary [&_[cmdk-item]]:flex [&_[cmdk-item]]:min-h-0 [&_[cmdk-item]]:cursor-pointer [&_[cmdk-item]]:items-center [&_[cmdk-item]]:gap-1.5 [&_[cmdk-item]]:rounded-[10px] [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-[5px] [&_[cmdk-item]]:text-[13px] [&_[cmdk-item]]:text-text-secondary [&_[cmdk-item][data-selected=true]]:bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] [&_[cmdk-item][data-selected=true]]:text-foreground [&_[cmdk-list]]:max-h-[calc((1lh+10px)*5)] [&_[cmdk-list]]:overflow-y-auto [&_[cmdk-list]]:p-0 [&_[cmdk-separator]]:my-1 [&_[cmdk-separator]]:h-px [&_[cmdk-separator]]:bg-border-subtle"
            label={formatMessage({ id: 'projects.search' })}
          >
            <div className="flex items-center gap-1.5 px-2 py-[5px] text-text-tertiary">
              <Search aria-hidden="true" size={14} />
              <Command.Input aria-label={formatMessage({ id: 'projects.search' })} autoFocus className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-foreground outline-0 placeholder:text-text-tertiary" placeholder={formatMessage({ id: 'projects.search' })} />
            </div>
            <Command.List>
              <Command.Empty>{formatMessage({ id: 'projects.notFound' })}</Command.Empty>
              <Command.Group heading={formatMessage({ id: 'projects.title' })}>
                {workspace?.workspaces.map(item => (
                  <Command.Item key={item.path} onSelect={() => selectProject(item.path)} value={item.displayName}>
                    <Folder aria-hidden="true" size={16} />
                    {item.displayName}
                  </Command.Item>
                ))}
              </Command.Group>
              <Command.Separator />
              <Command.Group>
                <Command.Item
                  onSelect={() => {
                    onCreateProject?.();
                    setOpen(false);
                  }}
                  value={formatMessage({ id: 'projects.new' })}
                >
                  <Plus aria-hidden="true" size={16} />
                  {formatMessage({ id: 'projects.new' })}
                </Command.Item>
              </Command.Group>
            </Command.List>
          </Command>
        </PopoverContent>
      </Popover>
    </span>
  );
}
