import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';

type ActivityView = 'cumulative' | 'daily' | 'weekly';

interface UsageStats {
  currentStreakDays: number;
  days: Array<{ iso: string; tokens: number }>;
  lifetimeTokens: number;
  longestChatMs?: number;
  longestStreakDays: number;
  peakTokens: number;
}

interface ProfileActivity {
  cells: Array<{ count: number; iso: string; level: number }>;
  monthLabels: string[];
}

export function ProfilePage() {
  const { formatMessage, formatNumber } = useIntl();
  const stats = useProfileStats();
  const [view, setView] = useState<ActivityView>('daily');
  const activity = stats ? buildActivity(stats.days, view) : undefined;

  return (
    <div className="h-full min-h-0 overflow-y-auto pt-[46px]">
      <section className="mx-auto w-full min-w-0 max-w-[45.75rem] px-8 pt-12 pb-12" aria-label={formatMessage({ id: 'settings.profile' })}>
        <section className="settings-profile-stats flex min-h-[60px] overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--foreground)_8%,transparent)] max-[720px]:flex-col" aria-label={formatMessage({ id: 'profileStats.title' })}>
          {stats
            ? (
                <>
                  <Stat label={formatMessage({ id: 'profileStats.lifetimeTokens' })} value={formatCompactNumber(stats.lifetimeTokens, formatNumber)} />
                  <Stat label={formatMessage({ id: 'profileStats.peakTokens' })} value={formatCompactNumber(stats.peakTokens, formatNumber)} />
                  {stats.longestChatMs == null ? null : <Stat label={formatMessage({ id: 'profileStats.longestChat' })} value={formatDuration(stats.longestChatMs, formatMessage, formatNumber)} />}
                  <Stat label={formatMessage({ id: 'profileStats.currentStreak' })} value={formatDays(stats.currentStreakDays, formatMessage, formatNumber)} />
                  <Stat label={formatMessage({ id: 'profileStats.longestStreak' })} value={formatDays(stats.longestStreakDays, formatMessage, formatNumber)} />
                </>
              )
            : <ProfileStatsLoading />}
        </section>
        <section className="mt-10" aria-label={formatMessage({ id: 'profileStats.activityTitle' })}>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-base leading-tight font-medium text-foreground">{formatMessage({ id: 'profileStats.activityTitle' })}</h2>
            <div className="flex gap-4">
              {(['daily', 'weekly', 'cumulative'] as const).map(tab => (
                <button aria-pressed={view === tab} className="cursor-pointer p-0 text-base leading-5 font-normal text-text-tertiary outline-none hover:text-foreground focus-visible:rounded-sm focus-visible:text-foreground focus-visible:shadow-[0_0_0_2px_var(--ring)] disabled:cursor-default aria-pressed:text-foreground" key={tab} onClick={() => setView(tab)} type="button">
                  {formatMessage({ id: `profileStats.${tab}` })}
                </button>
              ))}
            </div>
          </div>
          {activity ? <ActivityGrid cells={activity.cells} monthLabels={activity.monthLabels} /> : <ActivityGridLoading />}
        </section>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="settings-stat flex min-w-px flex-1 basis-0 flex-col items-center justify-center overflow-hidden px-3 py-2.5 text-center text-base font-normal">
      <strong className="w-full truncate leading-5 font-normal text-foreground">{value}</strong>
      <span className="w-full truncate leading-5 text-text-tertiary">{label}</span>
    </div>
  );
}

function ActivityGrid({ cells, monthLabels }: ProfileActivity) {
  const columnCount = Math.ceil(cells.length / 7);
  return (
    <div className="settings-profile-chart flex flex-col gap-2">
      <div className="settings-profile-heatmap grid auto-cols-fr grid-flow-col grid-rows-[repeat(7,minmax(1px,1fr))] gap-[3px] overflow-hidden" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(1px, 1fr))` }}>
        {cells.map(cell => (
          <span aria-label={`${cell.iso}: ${cell.count}`} className="aspect-square w-full min-w-0 rounded bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] data-[level='1']:bg-[color-mix(in_srgb,var(--foreground)_18%,transparent)] data-[level='2']:bg-[color-mix(in_srgb,var(--foreground)_34%,transparent)] data-[level='3']:bg-[color-mix(in_srgb,var(--foreground)_52%,transparent)] data-[level='4']:bg-foreground" data-level={cell.level} key={cell.iso} title={`${cell.iso}: ${cell.count}`} />
        ))}
      </div>
      <div className="settings-profile-months flex items-center justify-between text-sm leading-tight text-text-tertiary" aria-hidden="true">
        {monthLabels.map(label => <span key={label}>{label}</span>)}
      </div>
    </div>
  );
}

function ProfileStatsLoading() {
  return (
    <>
      {Array.from({ length: 5 }, (_, index) => <div className="settings-stat is-loading" key={index} />)}
    </>
  );
}

function ActivityGridLoading() {
  const columnCount = 53;
  return (
    <div className="settings-profile-chart flex flex-col gap-2" aria-hidden="true">
      <div className="settings-profile-heatmap grid auto-cols-fr grid-flow-col grid-rows-[repeat(7,minmax(1px,1fr))] gap-[3px] overflow-hidden" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(1px, 1fr))` }}>
        {Array.from({ length: 371 }, (_, index) => <span className="aspect-square w-full min-w-0 rounded bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)]" data-level="0" key={index} />)}
      </div>
      <div className="settings-profile-months flex items-center justify-between text-sm leading-tight text-text-tertiary">
        {Array.from({ length: 12 }, (_, index) => <span key={index} />)}
      </div>
    </div>
  );
}

function useProfileStats(): UsageStats | undefined {
  const [stats, setStats] = useState<UsageStats>();

  useEffect(() => {
    const api = (window as Window & { api?: Window['api'] }).api;
    if (!api)
      return;

    let cancelled = false;

    async function load() {
      const workspace = await api.workspaces.get();
      if (cancelled)
        return;
      const results = await Promise.allSettled(workspace.workspaces.map(project => api.sessions.getUsageStats(project.path)));
      if (!cancelled)
        setStats(mergeUsageStats(results.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])));
    }

    void load().catch(() => {
      if (!cancelled)
        setStats(emptyUsageStats());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return stats;
}

function mergeUsageStats(stats: UsageStats[]): UsageStats {
  if (stats.length === 0)
    return emptyUsageStats();

  const base = emptyUsageStats();
  const tokensByDay = new Map(base.days.map(day => [day.iso, 0]));
  let longestChatMs: number | undefined;

  for (const stat of stats) {
    base.lifetimeTokens += stat.lifetimeTokens;
    for (const day of stat.days)
      tokensByDay.set(day.iso, (tokensByDay.get(day.iso) ?? 0) + day.tokens);
    if (stat.longestChatMs != null)
      longestChatMs = Math.max(longestChatMs ?? 0, stat.longestChatMs);
  }

  base.days = base.days.map(day => ({ ...day, tokens: tokensByDay.get(day.iso) ?? 0 }));
  base.peakTokens = Math.max(0, ...base.days.map(day => day.tokens));
  base.currentStreakDays = countCurrentStreak(base.days);
  base.longestStreakDays = countLongestStreak(base.days);
  return { ...base, ...(longestChatMs == null ? {} : { longestChatMs }) };
}

function buildActivity(days: UsageStats['days'], view: ActivityView): ProfileActivity {
  const counts = new Map<string, number>(days.map(day => [day.iso, day.tokens]));
  if (view === 'weekly') {
    for (let index = 0; index < days.length; index += 7) {
      const week = days.slice(index, index + 7);
      const total = week.reduce((sum, day) => sum + day.tokens, 0);
      for (const day of week)
        counts.set(day.iso, total);
    }
  }
  else if (view === 'cumulative') {
    let total = 0;
    for (const day of days) {
      total += day.tokens;
      counts.set(day.iso, total);
    }
  }

  const max = Math.max(0, ...counts.values());
  const cells = days.map((day) => {
    const count = counts.get(day.iso) ?? 0;
    return { count, iso: day.iso, level: activityLevel(count, max) };
  });
  const monthLabels = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(`${days[0]?.iso ?? toIsoDate(new Date())}T00:00:00`);
    date.setMonth(date.getMonth() + index);
    return date.toLocaleString(undefined, { month: 'short' });
  });
  return { cells, monthLabels };
}

function activityLevel(count: number, max: number) {
  if (count === 0 || max === 0)
    return 0;
  return Math.max(1, Math.ceil((count / max) * 4));
}

function emptyUsageStats(): UsageStats {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  start.setDate(start.getDate() - 370);
  return {
    currentStreakDays: 0,
    days: Array.from({ length: 371 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return { iso: toIsoDate(date), tokens: 0 };
    }),
    lifetimeTokens: 0,
    longestStreakDays: 0,
    peakTokens: 0,
  };
}

function countCurrentStreak(days: UsageStats['days']) {
  let count = 0;
  for (let index = days.length - 1; index >= 0 && days[index].tokens > 0; index--)
    count++;
  return count;
}

function countLongestStreak(days: UsageStats['days']) {
  let current = 0;
  let longest = 0;
  for (const day of days) {
    current = day.tokens > 0 ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return longest;
}

function formatCompactNumber(value: number, formatNumber: ReturnType<typeof useIntl>['formatNumber']) {
  return formatNumber(value, { maximumFractionDigits: 1, notation: 'compact' });
}

function formatDays(value: number, formatMessage: ReturnType<typeof useIntl>['formatMessage'], formatNumber: ReturnType<typeof useIntl>['formatNumber']) {
  return formatMessage({ id: 'profileStats.daysValue' }, { value: formatNumber(value) });
}

function formatDuration(value: number, formatMessage: ReturnType<typeof useIntl>['formatMessage'], formatNumber: ReturnType<typeof useIntl>['formatNumber']) {
  const totalMinutes = Math.floor(value / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0)
    return formatMessage({ id: 'profileStats.durationHoursMinutes' }, { hours: formatNumber(hours), minutes: formatNumber(minutes) });
  return formatMessage({ id: 'profileStats.durationMinutes' }, { minutes: formatNumber(minutes) });
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
