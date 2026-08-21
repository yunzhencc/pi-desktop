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
import { Folder, LoaderCircle, Monitor, Pin, PinOff, Trash2 } from 'lucide-react';
import { useIntl } from 'react-intl';
import { formatSessionAge } from './relative-age';

interface SessionItemProps extends GetProps<typeof Item> {
  /** 是否选中 */
  isSelected?: boolean;
  /** 是否置顶 */
  isPinned?: boolean;
  /** 是否在执行中 */
  isRunning?: boolean;
  /** 所属项目名称 */
  projectName?: string;
  /** 最近更新时间 */
  modifiedAt?: string;
  /** 切换置顶 */
  onTogglePin?: () => void;
}

export function SessionItem(props: SessionItemProps) {
  const { formatMessage } = useIntl();
  const {
    className,
    isSelected,
    isPinned,
    isRunning,
    projectName,
    modifiedAt,
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
          size="default"
          className={cn(
            'py-1.5 pl-7',
            'hover:bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)]',
            isSelected && 'bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)]',
            className,
          )}
          onClick={onClick}
          {...rest}
        >
          <ItemContent className="min-w-0 overflow-hidden">
            <ItemTitle className="block w-full min-w-0 truncate text-sm font-normal">
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
                className="size-3 animate-spin group-hover/item:hidden motion-reduce:animate-none"
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
      <HoverCardContent align="start" side="right" className="w-[min(20rem,calc(100vw-16px))] min-w-56 p-0">
        <div className="flex min-w-0 flex-col gap-1 px-3 py-1.5 text-foreground">
          <div className="flex min-w-0 flex-col gap-1 pb-0.5">
            <div className="flex w-full min-w-0 items-baseline gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-1">
                <div className="-ms-0.5 min-w-0 flex-1 wrap-break-word px-1.5 text-sm leading-5 font-medium">
                  {children}
                </div>
                <span className="flex h-5 shrink-0 items-center text-muted-foreground">
                  <Monitor aria-hidden="true" className="size-3.5" />
                </span>
              </div>
              {modifiedAt && (
                <div className="flex shrink-0 items-center gap-1 text-xs leading-5 text-muted-foreground" title={new Date(modifiedAt).toLocaleString()}>
                  {formatSessionAge(modifiedAt, formatMessage)}
                </div>
              )}
            </div>
          </div>
          {projectName && (
            <div className="flex h-5 min-w-0 items-center gap-1.5 text-sm leading-5">
              <span className="flex h-5 w-4 shrink-0 items-center justify-center text-muted-foreground">
                <Folder aria-hidden="true" className="size-3.5" />
              </span>
              <span className="block min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap leading-5">
                {projectName}
              </span>
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
