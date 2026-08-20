import { Button } from '@pi-desktop/shadcn-ui/components/button';
import { Link } from '@tanstack/react-router';
import { CircleHelp, Settings } from 'lucide-react';
import { useIntl } from 'react-intl';

export function Footer() {
  const { formatMessage } = useIntl();

  return (
    <div
      className="flex justify-between px-2 py-1"
      style={{
        borderTop: '1px solid color-mix(in srgb, var(--foreground) 10%, transparent)',
      }}
    >
      <Button variant="ghost" size="sm">
        <Link to="/settings/general">
          <Settings />
        </Link>
      </Button>

      <Button variant="ghost" size="sm">
        <a
          aria-label={formatMessage({ id: 'profile.help' })}
          href="https://github.com/yunzhencc/pi-desktop"
          rel="noreferrer"
          target="_blank"
          title={formatMessage({ id: 'profile.help' })}
        >
          <CircleHelp aria-hidden="true" size={16} strokeWidth={1.75} />
        </a>
      </Button>
    </div>
  );
}
