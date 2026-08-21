import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';

interface ProfileStats {
  activeProjectSessions: number;
  dailyCells: Array<{ count: number; iso: string; level: number }>;
  monthLabels: string[];
  pinnedProjects: number;
  pinnedSessions: number;
  projects: number;
  sessions: number;
}

export function ProfilePage() {
  const { formatMessage, formatNumber } = useIntl();
  const stats = useProfileStats();

  return (
    <div className="settings-view">
      <section className="settings-content settings-profile-content" aria-label={formatMessage({ id: 'settings.profile' })}>
        <section className="settings-profile-stats" aria-label={formatMessage({ id: 'profileStats.title' })}>
          {stats
            ? (
                <>
                  <Stat label={formatMessage({ id: 'profileStats.projects' })} value={formatNumber(stats.projects)} />
                  <Stat label={formatMessage({ id: 'profileStats.sessions' })} value={formatNumber(stats.sessions)} />
                  <Stat label={formatMessage({ id: 'profileStats.activeProjectSessions' })} value={formatNumber(stats.activeProjectSessions)} />
                  <Stat label={formatMessage({ id: 'profileStats.pinnedProjects' })} value={formatNumber(stats.pinnedProjects)} />
                  <Stat label={formatMessage({ id: 'profileStats.pinnedSessions' })} value={formatNumber(stats.pinnedSessions)} />
                </>
              )
            : <ProfileStatsLoading />}
        </section>
        <section className="settings-profile-section" aria-label={formatMessage({ id: 'profileStats.activityTitle' })}>
          <div className="settings-profile-section-header">
            <h2>{formatMessage({ id: 'profileStats.activityTitle' })}</h2>
            <div className="settings-profile-tabs" aria-hidden="true">
              <span>{formatMessage({ id: 'profileStats.daily' })}</span>
              <span>{formatMessage({ id: 'profileStats.weekly' })}</span>
              <span>{formatMessage({ id: 'profileStats.cumulative' })}</span>
            </div>
          </div>
          {stats ? <ActivityGrid cells={stats.dailyCells} monthLabels={stats.monthLabels} /> : <ActivityGridLoading />}
        </section>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="settings-stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function ActivityGrid({ cells, monthLabels }: { cells: ProfileStats['dailyCells']; monthLabels: string[] }) {
  return (
    <div className="settings-profile-chart">
      <div className="settings-profile-heatmap">
        {cells.map(cell => (
          <span aria-label={`${cell.iso}: ${cell.count}`} data-level={cell.level} key={cell.iso} title={`${cell.iso}: ${cell.count}`} />
        ))}
      </div>
      <div className="settings-profile-months" aria-hidden="true">
        {monthLabels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}
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
  return (
    <div className="settings-profile-chart" aria-hidden="true">
      <div className="settings-profile-heatmap">
        {Array.from({ length: 371 }, (_, index) => <span data-level="0" key={index} />)}
      </div>
      <div className="settings-profile-months">
        {Array.from({ length: 12 }, (_, index) => <span key={index} />)}
      </div>
    </div>
  );
}

function useProfileStats(): ProfileStats | undefined {
  const [stats, setStats] = useState<ProfileStats>();

  useEffect(() => {
    const api = (window as Window & { api?: Window['api'] }).api;
    if (!api)
      return;

    let cancelled = false;

    async function load() {
      const workspace = await api.workspaces.get();
      const sessionLists = await Promise.all(workspace.workspaces.map(project => api.sessions.list(project.path)));
      if (cancelled)
        return;

      const activeProjectIndex = workspace.workspaces.findIndex(project => project.path === workspace.selectedWorkspacePath);
      const allSessions = sessionLists.flat();
      setStats({
        activeProjectSessions: activeProjectIndex === -1 ? 0 : sessionLists[activeProjectIndex]?.length ?? 0,
        ...buildActivity(allSessions.map(session => session.modifiedAt)),
        pinnedProjects: workspace.pinnedWorkspacePaths.length,
        pinnedSessions: workspace.pinnedSessionPaths.length,
        projects: workspace.workspaces.length,
        sessions: allSessions.length,
      });
    }

    void load().catch(() => {
      if (!cancelled)
        setStats({ activeProjectSessions: 0, ...buildActivity([]), pinnedProjects: 0, pinnedSessions: 0, projects: 0, sessions: 0 });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return stats;
}

function buildActivity(modifiedAtValues: string[]) {
  const today = startOfDay(new Date());
  const start = new Date(today);
  start.setDate(today.getDate() - 370);
  const counts = new Map<string, number>();

  for (const value of modifiedAtValues) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime()) || date < start || date > today)
      continue;
    const iso = toIsoDate(date);
    counts.set(iso, (counts.get(iso) ?? 0) + 1);
  }

  const max = Math.max(0, ...counts.values());
  const dailyCells = Array.from({ length: 371 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const iso = toIsoDate(date);
    const count = counts.get(iso) ?? 0;
    return { count, iso, level: activityLevel(count, max) };
  });
  const monthLabels = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(start);
    date.setMonth(start.getMonth() + index);
    return date.toLocaleString(undefined, { month: 'short' });
  });
  return { dailyCells, monthLabels };
}

function activityLevel(count: number, max: number) {
  if (count === 0 || max === 0)
    return 0;
  return Math.max(1, Math.ceil((count / max) * 4));
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
