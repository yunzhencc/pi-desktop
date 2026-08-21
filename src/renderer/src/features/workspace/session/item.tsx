import type { GetProps } from '@pi-desktop/utils';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@pi-desktop/shadcn-ui/components/hover-card';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemTitle,
} from '@pi-desktop/shadcn-ui/components/item';
import { cn } from '@pi-desktop/shadcn-ui/lib/utils';
import { LoaderCircle, Pin, PinOff, Trash2 } from 'lucide-react';

interface SessionItemProps extends GetProps<typeof Item> {
  /** 是否选中 */
  isSelected?: boolean;
  /** 是否置顶 */
  isPinned?: boolean;
  /** 是否在执行中 */
  isRunning?: boolean;
  /** 切换置顶 */
  onTogglePin?: () => void;
}

export function SessionItem(props: SessionItemProps) {
  const {
    className,
    isSelected,
    isPinned,
    isRunning,
    children,
    onTogglePin,
    onClick,
    ...rest
  } = props;

  return (
    <HoverCard>
      <HoverCardTrigger
        closeDelay={0}
        className="flex w-full"
      >
        <Item
          size="xs"
          className={cn(
            'py-1.5 pl-7',
            'hover:bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)]',
            isSelected && 'bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)]',
            className,
          )}
          onClick={onClick}
          {...rest}
        >
          <ItemContent className="overflow-hidden">
            <ItemTitle className="text-xs font-normal">
              {children}
            </ItemTitle>
          </ItemContent>
          <ItemActions
            className={cn(
              isRunning ? 'inline-flex' : 'hidden group-hover/item:inline-flex',
            )}
          >
            {/* 运行中 */}
            {isRunning && (
              <LoaderCircle
                className="w-3 h-3 chat-composer-send-loading group-hover/item:hidden"
              />
            )}
            {/* 操作项 */}
            <span
              className="hidden gap-1.5 group-hover/item:inline-flex"
              onClick={(e) => { e.stopPropagation(); }}
            >
              {/* 置顶&取消置顶 */}
              <span onClick={onTogglePin}>
                {isPinned
                  ? <PinOff className="cursor-pointer w-3 h-3" />
                  : <Pin className="cursor-pointer w-3 h-3" />}
              </span>

              {/* 删除 */}
              <Trash2 className="cursor-pointer w-3 h-3" />
            </span>
          </ItemActions>
        </Item>
      </HoverCardTrigger>
      {/* 展示会话的详细信息 */}
      <HoverCardContent align="start" side="right" className="w-70">
        123
      </HoverCardContent>
    </HoverCard>

  );
}
