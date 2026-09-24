import React, { ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw, Scale } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  props: Props;
  state: State;

  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unexpected runtime error:', error, errorInfo);
    (this as any).setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleClearCacheAndReload = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        for (const key of cacheKeys) {
          await caches.delete(key);
        }
      }
      localStorage.removeItem('romeih_current_user');
      sessionStorage.clear();
    } catch (e) {
      console.error('Error clearing cache:', e);
    }
    // Force reload with cache busting query param
    window.location.href = window.location.pathname + '?v=' + Date.now();
  };

  handleCopyError = () => {
    const errorDetails = `Error: ${this.state.error?.toString()}\n\nStack:\n${this.state.error?.stack || 'No stack'}\n\nComponentStack:\n${this.state.errorInfo?.componentStack || 'No component stack'}`;
    navigator.clipboard.writeText(errorDetails).then(() => {
      alert('تم نسخ تفاصيل الخطأ بنجاح!');
    }).catch(() => {
      alert(errorDetails);
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0d121f] text-slate-100 flex flex-col items-center justify-center p-4 font-sans select-none text-right" dir="rtl">
          <div className="w-full max-w-lg bg-slate-900 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">
            
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-500 shadow-lg">
              <Scale className="w-8 h-8 text-amber-500" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-black text-white">مؤسسة رميح للمحاماة والاستشارات القانونية</h2>
              <p className="text-xs text-amber-400 font-bold">حدث تنبيه تقني بسيط أثناء عرض الصفحة</p>
              <p className="text-xs text-slate-400 leading-relaxed pt-2">
                تم احتواء التنبيه بنجاح لحماية بيانات القضايا والموكلين. اضغط على الزر أدناه لتحديث الجلسة وتنظيف الذاكرة المؤقتة.
              </p>
            </div>

            {this.state.error && (
              <div className="space-y-2">
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-[11px] text-slate-400 font-mono text-left dir-ltr overflow-x-auto max-h-36">
                  <div className="font-bold text-rose-400 mb-1">{this.state.error.toString()}</div>
                  {this.state.error.stack && (
                    <div className="text-[10px] text-slate-500 whitespace-pre leading-relaxed">{this.state.error.stack}</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={this.handleCopyError}
                  className="text-[11px] text-amber-400 hover:text-amber-300 underline cursor-pointer"
                >
                  📋 نسخ تفاصيل الخطأ لإرسالها
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                onClick={this.handleClearCacheAndReload}
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs py-3 px-4 rounded-xl transition-all shadow-lg shadow-amber-500/15 cursor-pointer flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4 text-slate-950" />
                تحديث ومسح الذاكرة المؤقتة
              </button>
              
              <button
                onClick={this.handleReload}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs py-3 px-4 rounded-xl border border-slate-700 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                إعادة المحاولة السريعة
              </button>
            </div>

            <div className="text-[10px] text-slate-500 pt-2 font-mono">
              نظام إدارة القضايا والشركات الموحد © 2026
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
