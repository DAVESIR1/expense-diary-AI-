import React from 'react';
import { 
  Home, 
  FileText, 
  Sparkles, 
  Settings, 
  User, 
  Info 
} from 'lucide-react';
import { TranslationStrings } from '../data/languages';

export type NavTab = 'home' | 'report' | 'ai' | 'settings' | 'profile' | 'about';

interface NavigationProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  t: TranslationStrings;
  pendingAiCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onTabChange,
  t,
  pendingAiCount = 0,
}) => {
  const navItems = [
    { id: 'home' as NavTab, label: t.home, icon: Home },
    { id: 'report' as NavTab, label: t.report, icon: FileText },
    { id: 'ai' as NavTab, label: t.aiAssistant, icon: Sparkles, badge: pendingAiCount },
    { id: 'settings' as NavTab, label: t.settings, icon: Settings },
    { id: 'profile' as NavTab, label: t.profile, icon: User },
    { id: 'about' as NavTab, label: t.about, icon: Info },
  ];

  return (
    <nav
      id="bottom-floating-navigation"
      className="fixed bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-xl"
    >
      <div className="flex items-center justify-around px-2 py-2 rounded-2xl bg-white/95 backdrop-blur-md border border-[#E1E8ED] shadow-lg shadow-[#2D3436]/5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              id={`bottom-nav-${item.id}`}
              onClick={() => onTabChange(item.id)}
              className={`relative flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all duration-150 ${
                isActive
                  ? 'text-[#6C5CE7] font-bold scale-102 bg-[#F4F1FD]'
                  : 'text-[#B2BEC3] hover:text-[#636E72] hover:bg-[#F9FBFC]'
              }`}
            >
              {/* Icon with bold theme stroke */}
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
                {Boolean(item.badge && item.badge > 0) && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#1976D2] border-2 border-white animate-pulse" />
                )}
              </div>

              {/* Label */}
              <span className={`text-[10px] tracking-tight mt-1 whitespace-nowrap ${isActive ? 'font-bold' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
