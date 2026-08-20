import type { GetProps } from '@pi-desktop/utils';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemTitle,
} from '@pi-desktop/shadcn-ui/components/item';
import { cn } from '@pi-desktop/shadcn-ui/lib/utils';
import { Ellipsis, LoaderCircle } from 'lucide-react';

interface SessionItemProps extends GetProps<typeof Item> {
  /** 是否置顶 */
  isPinned?: boolean;
  /** 是否在执行中 */
  isRunning?: boolean;
  /** 切换置顶 */
  onTogglePin?: () => void;
}

export function ProjectItem(props: SessionItemProps) {
  const {
    className,
    isPinned,
    isRunning,
    children,
    onTogglePin,
    onClick,
    ...rest
  } = props;

  return (
    <Item
      size="xs"
      className={cn(
        'py-1.5 pl-7',
        'hover:bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)]',
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
          {/* 更多 */}
          <Ellipsis className="cursor-pointer w-3 h-3" />
        </span>
      </ItemActions>
    </Item>
  );
}
