import type { WorkspaceSnapshot } from '@shared/types';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@pi-desktop/shadcn-ui/components/popover';
import { Command } from 'cmdk';
import { Folder, Plus, Search, X } from 'lucide-react';
import React from 'react';

export function ProjectPicker({ children, className, onClearProject, onCreateProject, onSelectProject, triggerClassName, workspace }: {
  children: React.ReactNode;
  className?: string;
  onClearProject?: () => void;
  onCreateProject?: () => void;
  onSelectProject?: (path: string) => void;
  triggerClassName?: string;
  workspace?: WorkspaceSnapshot;
}) {
  const [open, setOpen] = React.useState(false);

  const selectProject = (path: string) => {
    onSelectProject?.(path);
    setOpen(false);
  };

  return (
    <span className={className ? `project-picker ${className}` : 'project-picker'} data-clear-project-available={onClearProject ? '' : undefined}>
      <Popover onOpenChange={setOpen} open={open}>
        {onClearProject && (
          <button
            aria-label="清理项目"
            className="project-picker-clear"
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
        <PopoverContent align="center" aria-label="选择项目" className="project-picker-popover" role="dialog" side="top" sideOffset={12}>
          <Command className="project-picker-command" label="搜索项目">
            <div className="project-picker-search">
              <Search aria-hidden="true" size={14} />
              <Command.Input aria-label="搜索项目" autoFocus placeholder="搜索项目" />
            </div>
            <Command.List>
              <Command.Empty>未找到项目</Command.Empty>
              <Command.Group heading="项目">
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
                  value="新建项目"
                >
                  <Plus aria-hidden="true" size={16} />
                  新建项目
                </Command.Item>
              </Command.Group>
            </Command.List>
          </Command>
        </PopoverContent>
      </Popover>
    </span>
  );
}
