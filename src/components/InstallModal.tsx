import React, { useState } from 'react';
import { X, Smartphone, Laptop, Share2, PlusSquare, Compass, CheckCircle, Info, Download } from 'lucide-react';

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDirectInstall?: () => void;
  hasDirectPrompt: boolean;
}

export default function InstallModal({ isOpen, onClose, onDirectInstall, hasDirectPrompt }: InstallModalProps) {
  const [activeTab, setActiveTab] = useState<'ios' | 'android' | 'desktop'>('desktop');

  if (!isOpen) return null;

  // Detect if app is running inside an iframe
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn" dir="rtl">
      <div className="bg-slate-900 border border-slate-800/80 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden relative animate-scaleIn">
        {/* Decorative Top Accent */}
        <div className="h-1.5 w-full bg-gradient-to-l from-amber-500 via-yellow-400 to-amber-600" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-1.5 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="p-6 md:p-8">
          <div className="flex items-center gap-3.5 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
              <Download className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">تثبيت تطبيق مؤسسة رميح للمحاماة</h3>
              <p className="text-xs text-slate-400 mt-1">احصل على تجربة سريعة وخفيفة وتصفح كبرنامج مستقل بالكامل</p>
            </div>
          </div>

          {/* Iframe detection notice OR Direct Install Option */}
          {isInIframe ? (
            <div className="mb-6 bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex flex-col gap-3.5 text-right">
              <div className="flex gap-2.5 items-start">
                <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-amber-300 font-bold leading-relaxed">
                    تنبيه: متصفحات الويب تمنع التثبيت المباشر من داخل النوافذ الإطارية (iframe) المعزولة.
                  </p>
                  <p className="text-[10px] text-slate-300 leading-relaxed mt-1">
                    يرجى النقر على الزر أدناه لفتح موقع التطبيق في نافذة مستقلة وخارجية، ثم اضغط على نفس زر التثبيت لتثبيته فوراً كبرنامج مستقل.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  const targetUrl = window.location.origin + window.location.pathname + '?triggerInstall=true' + window.location.hash;
                  window.open(targetUrl, '_blank');
                  onClose();
                }}
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs py-3 px-4 rounded-xl transition-all duration-150 hover:shadow-lg hover:shadow-amber-500/25 active:scale-95 cursor-pointer flex items-center justify-center gap-2 animate-pulse"
              >
                <Share2 className="w-4 h-4" />
                <span>فتح وتثبيت التطبيق مباشرة الآن</span>
              </button>
            </div>
          ) : (
            hasDirectPrompt && onDirectInstall && (
              <div className="mb-6 bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex gap-2.5 items-start">
                  <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-200/90 leading-relaxed font-bold">
                    جهازك يدعم التثبيت المباشر بنقرة واحدة! اضغط على تثبيت الآن لحفظ البرنامج على جهازك فوراً.
                  </p>
                </div>
                <button
                  onClick={onDirectInstall}
                  className="w-full md:w-auto shrink-0 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs py-2.5 px-5 rounded-xl transition-all hover:shadow-lg hover:shadow-amber-500/15 cursor-pointer flex items-center justify-center gap-2"
                >
                  تثبيت الآن مباشرة
                </button>
              </div>
            )
          )}

          {/* Device Tabs */}
          <div className="flex border-b border-slate-800 mb-6 p-1 bg-slate-950/60 rounded-xl">
            <button
              onClick={() => setActiveTab('desktop')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'desktop'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Laptop className="w-4 h-4" />
              الكمبيوتر واللابتوب
            </button>
            <button
              onClick={() => setActiveTab('ios')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'ios'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              آيفون وآيباد (iOS)
            </button>
            <button
              onClick={() => setActiveTab('android')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'android'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              أندرويد (Android)
            </button>
          </div>

          {/* Instructions panels */}
          <div className="space-y-4">
            {activeTab === 'desktop' && (
              <div className="space-y-3.5">
                <div className="flex gap-3 items-start p-3 bg-slate-950/40 rounded-xl border border-slate-800/40">
                  <span className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-xs font-black shrink-0 font-mono">١</span>
                  <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                    انظر إلى شريط العنوان بأعلى المتصفح (بجانب زر المفضلة Star ⭐ أو في الزاوية اليمنى).
                  </p>
                </div>
                <div className="flex gap-3 items-start p-3 bg-slate-950/40 rounded-xl border border-slate-800/40">
                  <span className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-xs font-black shrink-0 font-mono">٢</span>
                  <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                    ستجد أيقونة على شكل شاشة صغيرة وبها سهم للأسفل <strong className="text-amber-400">"تثبيت التطبيق" (Install)</strong>، اضغط عليها.
                  </p>
                </div>
                <div className="flex gap-3 items-start p-3 bg-slate-950/40 rounded-xl border border-slate-800/40">
                  <span className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-xs font-black shrink-0 font-mono">٣</span>
                  <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                    أو اضغط على زر الخيارات بمتصفحك (الثلاث نقاط الرأسية <span className="font-bold">⋮</span>) ثم اختر <strong className="text-amber-400">تثبيت مؤسسة رميح للمحاماة (Install App)</strong> من القائمة.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'ios' && (
              <div className="space-y-3.5">
                <div className="flex gap-3 items-start p-3 bg-slate-950/40 rounded-xl border border-slate-800/40">
                  <span className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-xs font-black shrink-0 font-mono">١</span>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-300 leading-relaxed font-semibold flex items-center gap-1.5">
                      افتح التطبيق عبر متصفح <span className="text-amber-400 font-bold">Safari</span> الافتراضي، ثم اضغط على زر <span className="text-amber-400 font-bold">مشاركة (Share)</span>
                      <Share2 className="w-3.5 h-3.5 text-amber-500" />
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 items-start p-3 bg-slate-950/40 rounded-xl border border-slate-800/40">
                  <span className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-xs font-black shrink-0 font-mono">٢</span>
                  <p className="text-xs text-slate-300 leading-relaxed font-semibold flex items-center gap-1.5 flex-wrap">
                    اسحب القائمة لأسفل واختر <strong className="text-amber-400">"إضافة إلى الشاشة الرئيسية" (Add to Home Screen)</strong>
                    <PlusSquare className="w-4 h-4 text-amber-500" />
                  </p>
                </div>
                <div className="flex gap-3 items-start p-3 bg-slate-950/40 rounded-xl border border-slate-800/40">
                  <span className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-xs font-black shrink-0 font-mono">٣</span>
                  <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                    اضغط على <strong className="text-amber-400">"إضافة" (Add)</strong> في الزاوية العلوية اليمنى لتأكيد التثبيت بنجاح.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'android' && (
              <div className="space-y-3.5">
                <div className="flex gap-3 items-start p-3 bg-slate-950/40 rounded-xl border border-slate-800/40">
                  <span className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-xs font-black shrink-0 font-mono">١</span>
                  <p className="text-xs text-slate-300 leading-relaxed font-semibold flex items-center gap-1.5">
                    افتح متصفح <span className="text-amber-400 font-bold">Chrome</span> واضغط على زر الخيارات (الثلاث نقاط الرأسية <span className="font-bold">⋮</span>).
                  </p>
                </div>
                <div className="flex gap-3 items-start p-3 bg-slate-950/40 rounded-xl border border-slate-800/40">
                  <span className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-xs font-black shrink-0 font-mono">٢</span>
                  <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                    اختر <strong className="text-amber-400">"تثبيت التطبيق" (Install app)</strong> أو إضافة إلى الشاشة الرئيسية من القائمة.
                  </p>
                </div>
                <div className="flex gap-3 items-start p-3 bg-slate-950/40 rounded-xl border border-slate-800/40">
                  <span className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-xs font-black shrink-0 font-mono">٣</span>
                  <p className="text-xs text-slate-300 leading-relaxed font-semibold flex items-center gap-1">
                    أكد عملية التثبيت بالضغط على <strong className="text-amber-400">تثبيت (Install)</strong> لتجده متاحاً على شاشتك الرئيسية كأي تطبيق رسمي.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-amber-500" />
            يدعم التشغيل بدون إنترنت (Offline mode)
          </span>
          <span className="flex items-center gap-1 text-emerald-400 font-bold">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            متوافق مع الهواتف والكمبيوتر
          </span>
        </div>
      </div>
    </div>
  );
}
