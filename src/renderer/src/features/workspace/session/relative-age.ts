import type { IntlShape } from 'react-intl';

export function formatSessionAge(value: string, formatMessage: IntlShape['formatMessage']) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time))
    return '';

  const minutes = Math.max(1, Math.floor((Date.now() - time) / 60000));
  if (minutes < 60)
    return formatMessage({ id: 'conversation.relativeAge.compactMinutesAgo' }, { value: minutes });

  const hours = Math.floor(minutes / 60);
  if (hours < 24)
    return formatMessage({ id: 'conversation.relativeAge.compactHoursAgo' }, { value: hours });

  const days = Math.floor(hours / 24);
  if (days < 7)
    return formatMessage({ id: 'conversation.relativeAge.compactDaysAgo' }, { value: days });

  const weeks = Math.floor(days / 7);
  if (days < 30)
    return formatMessage({ id: 'conversation.relativeAge.compactWeeksAgo' }, { value: weeks });

  const months = Math.floor(days / 30);
  if (days < 365)
    return formatMessage({ id: 'conversation.relativeAge.compactMonthsAgo' }, { value: months });

  return formatMessage({ id: 'conversation.relativeAge.compactYearsAgo' }, { value: Math.floor(days / 365) });
}
