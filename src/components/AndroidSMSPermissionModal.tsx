import React from 'react';
import { MessageSquareText, ShieldAlert, CheckCircle2, X, Lock } from 'lucide-react';
import { TranslationStrings } from '../data/languages';
import { NativeBridgeService } from '../services/nativeBridge';

interface AndroidSMSPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGrantPermission: () => void;
  currentLang: string;
  t: TranslationStrings;
}

export const AndroidSMSPermissionModal: React.FC<AndroidSMSPermissionModalProps> = ({
  isOpen,
  onClose,
  onGrantPermission,
  currentLang,
}) => {
  if (!isOpen) return null;

  const isGu = currentLang === 'gu';

  return (
    <div
      id="sms-permission-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="sms-permission-card"
        className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-stone-200 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-start mb-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <MessageSquareText className="w-6 h-6 stroke-[2]" />
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <h3 className="text-xl font-bold text-stone-900 tracking-tight mb-2">
          {isGu ? 'SMS દ્વારા ઑટોમેટિક ખર્ચ નોંધણી' : 'Automatic Expense Tracking via SMS'}
        </h3>

        <p className="text-sm text-stone-600 leading-relaxed mb-4">
          {isGu
            ? 'જ્યારે તમે UPI, બેંક કે કાર્ડ દ્વારા ચૂકવણી કરો છો, ત્યારે AI તમારા બેંક SMS માંથી રકમ અને વેન્ડર આપમેળે શોધીને કન્ફર્મેશન કાર્ડ બતાવશે, જેથી તમારે જાતે લખવું નહીં પડે.'
            : 'Expense Diary AI can parse incoming bank & UPI transaction alerts to automatically record your income and expenses without manual typing.'}
        </p>

        {/* Benefits Box */}
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 mb-3 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{isGu ? 'પરમિશન આપવાના મુખ્ય ફાયદા:' : 'Benefits of Granting Permission:'}</span>
          </h4>
          <ul className="text-xs text-emerald-900/90 space-y-1 pl-5 list-disc">
            <li>{isGu ? 'કોઈપણ ખરીદી પછી જાતે ડાયરી ખોલીને ટાઈપ કરવાનો કંટાળો નહીં.' : 'Zero manual entry needed after making UPI or card payments.'}</li>
            <li>{isGu ? 'નાનામાં નાનો ખર્ચ પણ ચૂકાયા વગર સમયસર નોંધી લેવાશે.' : 'Never forget small cash or micro-transactions.'}</li>
            <li>{isGu ? 'છૂપા બેંક ચાર્જીસ અને પેનલ્ટી પર તાત્કાલિક એલર્ટ મળશે.' : 'Instant alerts on hidden banking charges and penalties.'}</li>
          </ul>
        </div>

        {/* Warning If Denied */}
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 mb-4 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <span>{isGu ? 'જો પરમિશન ન આપો તો શું થશે?' : 'What happens if you deny permission?'}</span>
          </h4>
          <ul className="text-xs text-amber-900/90 space-y-1 pl-5 list-disc">
            <li>{isGu ? 'તમારે દરેક ખર્ચ અને આવક જાતે મોડલ ખોલીને ટાઈપ કરવી પડશે.' : 'You will have to manually record every single expense.'}</li>
            <li>{isGu ? 'બેંક તરફથી મળતા રિયલ-ટાઈમ ઓટો-સેવિંગ સૂચનો કામ નહીં કરે.' : 'Automatic bank SMS transaction detection will be disabled.'}</li>
            <li>{isGu ? 'ઘણા વ્યવહારો નોંધવાના રહી જવાની શક્યતા વધી જશે.' : 'Higher chance of missing unrecorded transactions.'}</li>
          </ul>
        </div>

        {/* 100% Privacy Guarantee */}
        <div className="flex items-center gap-2 text-xs text-stone-500 mb-6 bg-stone-50 p-3 rounded-xl border border-stone-100">
          <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            {isGu
              ? '૧૦૦% પ્રાઇવસી: તમારો ડેટા ફક્ત તમારા ફોનમાં જ રહે છે, ક્યાંય અપલોડ થતો નથી.'
              : '100% Local Privacy: Your SMS data stays strictly on your device.'}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            onClick={async () => {
              // 1-Tap Unified Native Permission Request
              try {
                const res = await NativeBridgeService.requestAllNativePermissions();
                if (res && res.sms) {
                  onGrantPermission();
                  onClose();
                  return;
                }
                const detail = await NativeBridgeService.checkSMSPermissionDetailed();
                if (detail.isRestricted || !detail.granted) {
                  await NativeBridgeService.openAppSettings();
                }
              } catch (e) {
                // Fallback for web
              }
              onGrantPermission();
              onClose();
            }}
            className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-sm transition active:scale-98 text-center cursor-pointer"
          >
            {isGu ? 'હા, SMS પરમિશન આપો' : 'Allow SMS Access'}
          </button>
          <button
            onClick={async () => {
              await NativeBridgeService.openAppSettings();
              onClose();
            }}
            className="py-3 px-3.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 font-semibold text-xs sm:text-sm transition active:scale-98 text-center cursor-pointer"
            title={isGu ? 'ઍપ સેટિંગ્સ ખોલો' : 'Open App Settings'}
          >
            {isGu ? 'સેટિંગ્સ' : 'App Settings'}
          </button>
          <button
            onClick={onClose}
            className="py-3 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 font-semibold text-xs sm:text-sm transition active:scale-98 text-center cursor-pointer"
          >
            {isGu ? 'પછી પૂછજો' : 'Maybe Later'}
          </button>
        </div>
      </div>
    </div>
  );
};
