import { LogOut, Settings } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { getProfileInitials } from './sidebar-profile-utils';

interface SidebarProfileProps {
  name: string;
  onLogOut?: () => void;
  onOpenSettings?: () => void;
}

export function SidebarProfile({ name, onLogOut, onOpenSettings }: SidebarProfileProps) {
  const { formatMessage } = useIntl();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeWhenOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node))
        setIsOpen(false);
    };
    const closeWhenEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape')
        setIsOpen(false);
    };

    document.addEventListener('pointerdown', closeWhenOutside);
    document.addEventListener('keydown', closeWhenEscape);
    return () => {
      document.removeEventListener('pointerdown', closeWhenOutside);
      document.removeEventListener('keydown', closeWhenEscape);
    };
  }, []);

  const select = (action?: () => void) => {
    setIsOpen(false);
    action?.();
  };

  return (
    <div className="sidebar-profile" ref={rootRef}>
      <div aria-hidden={!isOpen} className="sidebar-profile-menu" data-open={isOpen} id="sidebar-profile-menu" role="menu">
        <button onClick={() => select(onOpenSettings)} role="menuitem" type="button">
          <Settings aria-hidden="true" size={16} strokeWidth={1.75} />
          {formatMessage({ id: 'profile.settings' })}
        </button>
        <div className="sidebar-profile-menu-separator" role="separator" />
        <button onClick={() => select(onLogOut)} role="menuitem" type="button">
          <LogOut aria-hidden="true" size={16} strokeWidth={1.75} />
          {formatMessage({ id: 'profile.logOut' })}
        </button>
      </div>
      <button
        aria-controls="sidebar-profile-menu"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="sidebar-profile-trigger"
        onClick={() => setIsOpen(open => !open)}
        type="button"
      >
        <span aria-hidden="true" className="sidebar-profile-avatar">{getProfileInitials(name)}</span>
        <span className="sidebar-profile-name">{name}</span>
      </button>
    </div>
  );
}
