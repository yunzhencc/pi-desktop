import type { GetProps } from '@pi-desktop/utils';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@pi-desktop/shadcn-ui/components/context-menu';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemTitle,
} from '@pi-desktop/shadcn-ui/components/item';
import { cn } from '@pi-desktop/shadcn-ui/lib/utils';
import { Ellipsis, FolderClosed, FolderOpen, LoaderCircle, MessageSquarePlus, Pen, Pin, PinOff, X } from 'lucide-react';
import { useRef, useState } from 'react';

interface SessionItemProps extends GetProps<typeof Item> {
  /** 是否展开 */
  collapsed?: boolean;
  /** 是否置顶 */
  isPinned?: boolean;
  /** 是否在执行中 */
  isRunning?: boolean;
  /** 切换置顶 */
  onTogglePin?: () => void;
  onToggleCollapsed?: () => void;
  onEdit?: () => void;
  onNewConversation?: () => void;
  onOpenSource?: () => void;
}

export function ProjectItem(props: SessionItemProps) {
  const contextMenuTriggerRef = useRef<HTMLDivElement>(null);
  const openingFromEllipsisRef = useRef(false);
  const [showActionsForMenu, setShowActionsForMenu] = useState(false);
  const {
    className,
    isPinned,
    isRunning,
    children,
    collapsed,
    onTogglePin,
    onToggleCollapsed,
    onEdit,
    onNewConversation,
    onOpenSource,
    onClick,
    ...rest
  } = props;

  return (
    <ContextMenu
      onOpenChange={(open) => {
        if (!open)
          setShowActionsForMenu(false);
      }}
    >
      <ContextMenuTrigger
        className="group/project-menu"
        onContextMenu={() => {
          if (openingFromEllipsisRef.current) {
            openingFromEllipsisRef.current = false;
            return;
          }
          setShowActionsForMenu(false);
        }}
        ref={contextMenuTriggerRef}
      >
        <Item
          aria-expanded={collapsed === undefined ? undefined : !collapsed}
          render={<button type="button" />}
          size="xs"
          className={cn(
            'py-1.5',
            'hover:bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)]',
            'group-data-[popup-open]/project-menu:bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)]',
            className,
          )}
          onClick={(event) => {
            onClick?.(event);
            if (!event.defaultPrevented)
              onToggleCollapsed?.();
          }}
          {...rest}
        >
          <ItemContent className="overflow-hidden">
            <ItemTitle className="text-xs font-normal">
              <span>
                {collapsed ? <FolderOpen size={14} /> : <FolderClosed size={14} /> }
              </span>
              {children}
            </ItemTitle>
          </ItemContent>
          <ItemActions
            className={cn(
              isRunning || showActionsForMenu ? 'inline-flex' : 'hidden group-hover/item:inline-flex',
            )}
          >
            {/* 运行中 */}
            {isRunning && (
              <LoaderCircle
                className="size-3 animate-spin group-hover/item:hidden motion-reduce:animate-none"
              />
            )}
            {/* 操作项 */}
            <span
              className={cn(
                'gap-1.5',
                showActionsForMenu ? 'inline-flex' : 'hidden group-hover/item:inline-flex',
              )}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openingFromEllipsisRef.current = true;
                setShowActionsForMenu(true);
                contextMenuTriggerRef.current?.dispatchEvent(new MouseEvent('contextmenu', {
                  bubbles: true,
                  button: 2,
                  buttons: 2,
                  cancelable: true,
                  clientX: event.clientX,
                  clientY: event.clientY,
                }));
              }}
            >
              {/* 更多 */}
              <Ellipsis className="cursor-pointer w-3 h-3" />
            </span>
          </ItemActions>
        </Item>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-36">
        <ContextMenuGroup>
          <ContextMenuItem
            className="text-xs"
            onClick={(event) => {
              event.stopPropagation();
              onNewConversation?.();
            }}
          >
            <MessageSquarePlus className="size-3" />
            新建聊天
          </ContextMenuItem>
          <ContextMenuItem
            className="text-xs"
            onClick={(event) => {
              event.stopPropagation();
              onTogglePin?.();
            }}
          >
            {isPinned ? <PinOff className="size-3" /> : <Pin className="size-3" />}
            {isPinned ? '取消置顶' : '置顶'}
          </ContextMenuItem>
          <ContextMenuItem
            className="text-xs"
            onClick={(event) => {
              event.stopPropagation();
              onEdit?.();
            }}
          >
            <Pen className="size-3" />
            编辑
          </ContextMenuItem>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          <ContextMenuItem
            className="text-xs"
            onClick={(event) => {
              event.stopPropagation();
              onOpenSource?.();
            }}
          >
            <FolderOpen className="size-3" />
            在 Finder 中显示
          </ContextMenuItem>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          <ContextMenuItem className="text-xs" disabled>
            <X className="size-3" />
            移除项目
          </ContextMenuItem>
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>

  );
}
