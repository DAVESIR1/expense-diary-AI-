import React from 'react';
import { 
  ShieldCheck, 
  Layers, 
  Smartphone, 
  Laptop, 
  Monitor, 
  Lock,
  Heart
} from 'lucide-react';
import { TranslationStrings } from '../data/languages';

interface AboutScreenProps {
  t: TranslationStrings;
  currentLang: string;
}

export const AboutScreen: React.FC<AboutScreenProps> = ({ t, currentLang }) => {
  const isGu = currentLang === 'gu';

  return (
    <div id="about-screen-container" className="space-y-6 pb-28">
      {/* App Branding Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white border border-stone-200 shadow-xs text-center space-y-3">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-stone-900 text-white flex items-center justify-center shadow-md">
          <svg
            className="w-9 h-9"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
            <path d="M6 6h10" />
            <path d="M6 10h10" />
            <path d="M6 14h6" />
            <path d="m14 18 3-3 3 3" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-stone-900">
          Expense Diary AI
        </h1>
        <p className="text-xs text-stone-500 max-w-md mx-auto">
          {isGu
            ? 'અત્યંત હળવી શૈલી, હળવું રેખાંકન અને હળવા રંગો ધરાવતી સ્માર્ટ ફાયનાન્શિયલ ડાયરી.'
            : 'Minimal, lightweight AI Expense & Income Diary with offline storage & custom reports.'}
        </p>

        <div className="flex items-center justify-center gap-2 pt-2">
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-mono border border-emerald-200 font-semibold">
            v1.0.0 Production
          </span>
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-600 font-medium">
            Multi-OS & PWA
          </span>
        </div>
      </div>

      {/* Multi-OS Support Grid */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
          <Layers className="w-4 h-4 text-stone-500 stroke-[2]" />
          <span>{isGu ? 'મલ્ટી-OS સપોર્ટેડ આર્કિટેક્ચર' : 'Multi-OS Supported Architecture'}</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="p-4 rounded-2xl border border-stone-200 bg-stone-50/60 space-y-1.5">
            <div className="flex items-center gap-2 text-stone-900 font-bold text-xs">
              <Smartphone className="w-4 h-4 text-emerald-600" />
              <span>Android & Mobile</span>
            </div>
            <p className="text-[11px] text-stone-500 leading-relaxed">
              {isGu
                ? 'સંપૂર્ણ રિસ્પોન્સિવ, ટચ-ફ્રેન્ડલી, ઑફલાઇન કેશિંગ અને હોમ સ્ક્રીન ઇન્સ્ટોલેશન.'
                : 'Fully responsive, touch-friendly, offline caching, and standalone APK support.'}
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-stone-200 bg-stone-50/60 space-y-1.5">
            <div className="flex items-center gap-2 text-stone-900 font-bold text-xs">
              <Laptop className="w-4 h-4 text-indigo-600" />
              <span>Linux & Windows</span>
            </div>
            <p className="text-[11px] text-stone-500 leading-relaxed">
              {isGu
                ? 'Ubuntu, Debian, Arch Linux તેમજ Windows 10/11 પર સ્વતંત્ર ડેસ્કટોપ વિન્ડો તરીકે ચાલે છે.'
                : 'Runs smoothly on Ubuntu, Debian, Arch Linux, and Windows 10/11 as a standalone window.'}
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-stone-200 bg-stone-50/60 space-y-1.5">
            <div className="flex items-center gap-2 text-stone-900 font-bold text-xs">
              <Monitor className="w-4 h-4 text-purple-600" />
              <span>Modern Web Browsers</span>
            </div>
            <p className="text-[11px] text-stone-500 leading-relaxed">
              {isGu
                ? 'Chrome, Edge, Firefox, Safari સહિત તમામ મોર્ડન વેબ બ્રાઉઝર્સ પર ઑફલાઇન સપોર્ટ.'
                : 'Full offline local-storage capabilities across Chrome, Edge, Firefox, and Safari.'}
            </p>
          </div>
        </div>
      </div>

      {/* Privacy Guarantee */}
      <div className="p-5 sm:p-6 rounded-3xl bg-emerald-50/60 border border-emerald-200 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
          <Lock className="w-4 h-4 text-emerald-600" />
          <span>{isGu ? '૧૦૦% પ્રાઇવસી અને ઑન-ડિવાઇસ ડેટા ગેરંટી' : '100% On-Device Privacy Guarantee'}</span>
        </div>
        <p className="text-xs text-emerald-900/80 leading-relaxed">
          {isGu
            ? 'તમારો નાણાકીય ડેટા, આવક, ખર્ચ અને બેંક SMS વિગતો ફક્ત તમારા પોતાના ડિવાઇસ પર સુરક્ષિત રહે છે. કોઈ ક્લાઉડ સર્વર પર તમારો ડેટા વેચવામાં કે સંગ્રહવામાં આવતો નથી.'
            : 'Your financial entries, income, expenses, and parsed SMS data stay strictly on your local device. We do not store or sell your private records.'}
        </p>
      </div>

      {/* Footer credits */}
      <div className="text-center text-xs text-stone-400 flex items-center justify-center gap-1">
        <span>Expense Diary AI</span>
        <span>•</span>
        <span>Made with</span>
        <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
        <span>for smart money management</span>
      </div>
    </div>
  );
};
