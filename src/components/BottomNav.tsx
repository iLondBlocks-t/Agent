import { motion } from 'framer-motion';
import { Home, Bot, KeyRound, FolderKanban, Settings as Cog } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { haptic } from '@/core/platform/native';
import { useT } from '@/hooks/useT';

const ITEMS = [
  { to: '/', icon: Home, key: 'dashboard' as const },
  { to: '/agents', icon: Bot, key: 'agents' as const },
  { to: '/providers', icon: KeyRound, key: 'providers' as const },
  { to: '/projects', icon: FolderKanban, key: 'projects' as const },
  { to: '/settings', icon: Cog, key: 'settings' as const },
];

export function BottomNav() {
  const { t } = useT();
  const { pathname } = useLocation();
  const activeIndex = Math.max(0, ITEMS.findIndex((i) => i.to === pathname));
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(env(safe-area-inset-bottom),12px)]">
      <div className="glass relative mx-auto flex max-w-lg items-stretch justify-between rounded-[26px] p-1.5">
        <motion.div
          aria-hidden
          className="absolute top-1.5 h-[calc(100%-12px)] rounded-[20px] grad-primary opacity-90"
          style={{ width: `calc((100% - 12px) / ${ITEMS.length})` }}
          animate={{ insetInlineStart: `calc(6px + (100% - 12px) / ${ITEMS.length} * ${activeIndex})` }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        />
        {ITEMS.map(({ to, icon: Icon, key }) => (
          <NavLink
            key={to} to={to} onClick={() => void haptic('light')}
            className="relative z-10 flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[20px]"
          >
            {({ isActive }) => (
              <>
                <Icon className={`h-[18px] w-[18px] ${isActive ? 'text-white' : 'text-txt-lo'}`} strokeWidth={1.6} />
                <span className={`text-[10px] ${isActive ? 'font-semibold text-white' : 'text-txt-lo'}`}>{t(key)}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
