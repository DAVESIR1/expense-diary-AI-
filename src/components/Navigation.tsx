import React from 'react';
import { 
  Home, 
  FileText, 
  Settings, 
  User, 
  Info 
} from 'lucide-react';
import { TranslationStrings } from '../data/languages';

export type NavTab = 'home' | 'report' | 'settings' | 'profile' | 'about';

interface NavigationProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  t: TranslationStrings;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onTabChange,
  t,
}) => {
  const navItems = [
    { id: 'home' as NavTab, label: t.home, icon: Home },
    { id: 'report' as NavTab, label: t.report, icon: FileText },
    { id: 'settings' as NavTab, label: t.settings, icon: Settings },
    { id: 'profile' as NavTab, label: t.profile, icon: User },
    { id: 'about' as NavTab, label: t.about, icon: Info },
  ];

  return (
    <nav
      id="bottom-floating-navigation"
      className="fixed bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-lg pb-[env(safe-area-inset-bottom,0px)]"
      role="navigation"
      aria-label="Main Navigation"
    >
      <div className="flex items-center justify-around px-2 py-1.5 sm:py-2 rounded-2xl sm:rounded-3xl bg-white/95 backdrop-blur-md border border-stone-200/80 shadow-lg shadow-stone-900/5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              id={`bottom-nav-${item.id}`}
              onClick={() => onTabChange(item.id)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center py-1.5 px-3 sm:px-4 rounded-xl sm:rounded-2xl transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'text-emerald-700 font-semibold bg-emerald-50'
                  : 'text-stone-400 hover:text-stone-600 hover:bg-stone-50'
              }`}
            >
              <Icon
                className={`w-5 h-5 sm:w-5.5 sm:h-5.5 ${
                  isActive ? 'stroke-[2.2]' : 'stroke-[1.6]'
                }`}
                aria-hidden="true"
              />
              <span
                className={`text-[10px] sm:text-[11px] tracking-tight mt-0.5 whitespace-nowrap ${
                  isActive ? 'font-bold' : 'font-normal'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

