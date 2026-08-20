import type { GetProps } from '@pi-desktop/utils';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemTitle,
} from '@pi-desktop/shadcn-ui/components/item';
import { cn } from '@pi-desktop/shadcn-ui/lib/utils';
import { LoaderCircle, Pin } from 'lucide-react';

interface SessionItemProps extends GetProps<typeof Item> {
  /** 是否选中 */
  isSelected?: boolean;
  /** 是否置顶 */
  isPinned?: boolean;
  /** 是否在执行中 */
  isRunning?: boolean;
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
      {...rest}
    >
      <ItemContent>
        <ItemTitle className="text-xs font-normal">
          {children}
        </ItemTitle>
      </ItemContent>
      <ItemActions>
        {isRunning && (
          <LoaderCircle className="w-3 h-3 chat-composer-send-loading" />
        )}
        <Pin className="w-3 h-3" />
      </ItemActions>
    </Item>
  );
}
