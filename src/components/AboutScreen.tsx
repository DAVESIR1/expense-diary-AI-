import React from 'react';
import { 
  Info, 
  ShieldCheck, 
  Cpu, 
  Layers, 
  CheckCircle2, 
  Smartphone, 
  Laptop, 
  Monitor, 
  Sparkles,
  Heart
} from 'lucide-react';
import { TranslationStrings } from '../data/languages';

interface AboutScreenProps {
  t: TranslationStrings;
}

export const AboutScreen: React.FC<AboutScreenProps> = ({ t }) => {
  return (
    <div id="about-screen-container" className="space-y-6 pb-28">
      {/* App Branding Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white border border-stone-200/80 shadow-xs text-center space-y-3">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-stone-900 text-white flex items-center justify-center shadow-md">
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
          Expense Diary AI (ખર્ચ ડાયરી)
        </h1>
        <p className="text-xs text-stone-500 max-w-md mx-auto">
          અત્યંત હળવી શૈલી, હળવું રેખાંકન અને હળવા રંગો ધરાવતી સ્માર્ટ ફાયનાન્શિયલ ડાયરી.
        </p>

        <div className="flex items-center justify-center gap-2 pt-2">
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-mono border border-emerald-200">
            v1.0.0 Multi-OS
          </span>
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-600 font-medium">
            100% PWA સુસંગત
          </span>
        </div>
      </div>

      {/* Multi-OS Support Grid */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white border border-stone-200/80 shadow-xs space-y-4">
        <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
          <Layers className="w-4 h-4 text-stone-500 stroke-[1.75]" />
          <span>મલ્ટી-OS સપોર્ટેડ આર્કિટેક્ચર (Multi-OS Architecture)</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 space-y-1.5">
            <div className="flex items-center gap-2 text-stone-900 font-semibold text-xs">
              <Smartphone className="w-4 h-4 text-emerald-600" />
              <span>Android & iOS</span>
            </div>
            <p className="text-[11px] text-stone-500 leading-relaxed">
              સંપૂર્ણ રિસ્પોન્સિવ, ટચ-ફ્રેન્ડલી, ઑફલાઇન કેશિંગ અને હોમ સ્ક્રીન ઇન્સ્ટોલેશન સાથે મોબાઇલ ફોન કે ટેબલેટ પર સરળ કાર્ય.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 space-y-1.5">
            <div className="flex items-center gap-2 text-stone-900 font-semibold text-xs">
              <Laptop className="w-4 h-4 text-blue-600" />
              <span>Linux & Windows</span>
            </div>
            <p className="text-[11px] text-stone-500 leading-relaxed">
              Ubuntu, Debian, Fedora, Arch Linux તેમજ Windows 10/11 પર સ્વતંત્ર ડેસ્કટોપ વિન્ડો અને શોર્ટકટ તરીકે ચાલે છે.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 space-y-1.5">
            <div className="flex items-center gap-2 text-stone-900 font-semibold text-xs">
              <Monitor className="w-4 h-4 text-purple-600" />
              <span>વેબ & ક્લાઉડ બ્રાઉઝર</span>
            </div>
            <p className="text-[11px] text-stone-500 leading-relaxed">
              Chrome, Edge, Firefox, Safari સહિત તમામ મોર્ડન વેબ બ્રાઉઝર્સ પર ઇન્ટરનેટ વિના પણ ઑફલાઇન સપોર્ટ.
            </p>
          </div>
        </div>
      </div>

      {/* Privacy and Security Pillars */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white border border-stone-200/80 shadow-xs space-y-3.5">
        <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 stroke-[1.75]" />
          <span>પ્રાઇવસી & ડેટા સુરક્ષા ગેરંટી</span>
        </h3>

        <div className="space-y-2 text-xs text-stone-600 leading-relaxed">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong>100% લોકલ-ફર્સ્ટ સ્ટોરેજ:</strong> તમારો હિસાબ તમારા ડિવાઇસની મેમરીમાં સંગ્રહાય છે. કોઈ ત્રીજા પક્ષકારને ડેટા વેચવામાં આવતો નથી.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong>સુરક્ષિત સર્વર-સાઇડ AI પ્રોસેસિંગ:</strong> ગુગલ જેમિની AI કૉલ્સ માત્ર સુરક્ષિત સર્વર પાછળ ચાલે છે અને ક્યારેય તમારા પાસવર્ડ કે અંગત માહિતી સંગ્રહતી નથી.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong>ઝીરો બ્લોટવેર:</strong> કોઈપણ બિનજરૂરી ટ્રેકર્સ, જાહેરાતો કે ભારે લાઇબ્રેરીઓ વગર અત્યંત ઝડપી અને સ્મૂથ પરફોર્મન્સ.
            </span>
          </div>
        </div>
      </div>

      {/* Footer message */}
      <div className="text-center text-xs text-stone-400 flex items-center justify-center gap-1.5 pt-2">
        <span>Expense Diary AI દ્વારા સાદગી અને સુરક્ષા સાથે નિર્મિત</span>
        <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
      </div>
    </div>
  );
};
