import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw, LogOut } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  // @ts-ignore
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  constructor(props: Props) {
    super(props);
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    // @ts-ignore
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    // @ts-ignore
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleClearAndReload = () => {
    try {
      localStorage.removeItem('romeih_current_user');
    } catch {}
    window.location.reload();
  };

  public render() {
    // @ts-ignore
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#081528] text-white flex items-center justify-center p-4 font-sans" dir="rtl">
          <div className="bg-[#0b1d36] border-2 border-amber-500/40 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 text-center relative overflow-hidden">
            {/* Ambient background glow */}
            <div className="absolute -top-20 -right-20 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center text-amber-500 mx-auto shadow-lg">
              <ShieldAlert className="w-8 h-8 text-amber-500" />
            </div>

            <div className="space-y-2">
              <h2 className="text-base sm:text-lg font-black text-white">حدث استثناء أثناء تحميل الواجهة</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                تم التقاط خطأ غير متوقع ومنع الشاشة البيضاء بنجاح. يمكنك إعادة تحميل الصفحة للعودة للعمل مباشرة.
              </p>
            </div>

            {/* @ts-ignore */}
            {this.state.error && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-right text-[11px] font-mono text-rose-300 max-h-32 overflow-y-auto ltr">
                {/* @ts-ignore */}
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="flex-1 bg-gradient-to-r from-[#FCD34D] to-[#F5B041] hover:from-[#FCD34D]/90 hover:to-[#F5B041]/90 text-slate-950 font-black text-xs py-3 px-4 rounded-xl transition-all shadow-md shadow-amber-500/15 cursor-pointer flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                إعادة تحميل التطبيق
              </button>

              <button
                onClick={this.handleClearAndReload}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs py-3 px-4 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4 text-amber-400" />
                تسجيل الخروج
              </button>
            </div>
          </div>
        </div>
      );
    }

    // @ts-ignore
    return this.props.children;
  }
}

export default ErrorBoundary;


