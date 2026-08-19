import type { ReactNode } from 'react';
import { Command } from 'cmdk';
import { Folder, Plus, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type WorkspaceSnapshot = Awaited<ReturnType<Window['api']['workspaces']['get']>>;

export function ProjectPicker({ children, className, onClearProject, onCreateProject, onSelectProject, triggerClassName, workspace }: {
  children: ReactNode;
  className?: string;
  onClearProject?: () => void;
  onCreateProject?: () => void;
  onSelectProject?: (path: string) => void;
  triggerClassName?: string;
  workspace?: WorkspaceSnapshot;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number }>();
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open)
      return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !popoverRef.current?.contains(event.target as Node))
        setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape')
        setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const selectProject = (path: string) => {
    onSelectProject?.(path);
    setOpen(false);
  };

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect)
      setPosition({ left: rect.left + rect.width / 2, top: rect.top - 12 });
    setOpen(true);
  };

  return (
    <span className={className ? `project-picker ${className}` : 'project-picker'} data-clear-project-available={onClearProject ? '' : undefined} ref={rootRef}>
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
      <button aria-expanded={open} aria-haspopup="dialog" className={triggerClassName} onClick={toggle} ref={triggerRef} type="button">
        {children}
      </button>
      {open && position && createPortal(
        <div aria-label="选择项目" className="project-picker-popover" ref={popoverRef} role="dialog" style={position}>
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
        </div>,
        document.body,
      )}
    </span>
  );
}
