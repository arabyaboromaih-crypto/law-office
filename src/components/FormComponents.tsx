/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, LucideIcon } from 'lucide-react';

// ==========================================
// BaseModal Component
// ==========================================
interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: LucideIcon;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  children: React.ReactNode;
  footerActions?: React.ReactNode;
  bodyClassName?: string;
  headerClassName?: string;
}

export const BaseModal: React.FC<BaseModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  icon: Icon,
  size = 'md',
  children,
  footerActions,
  bodyClassName,
  headerClassName
}) => {
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-2xl',
    xl: 'max-w-3xl',
    '2xl': 'max-w-4xl',
    '3xl': 'max-w-4xl xl:max-w-5xl',
    '4xl': 'max-w-5xl xl:max-w-6xl',
  };

  React.useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden p-3 sm:p-4 lg:p-6" dir="rtl">
          {/* High-performance, lag-free backdrop overlay without CPU-intensive backdrop-filter blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="modal-backdrop fixed inset-0 bg-slate-950/75 transition-opacity z-10"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ type: 'spring', duration: 0.35, bounce: 0.1 }}
            className={`relative bg-[#f8fafc] rounded-2xl shadow-2xl border border-slate-200/90 w-full ${sizeClasses[size]} max-h-[92vh] flex flex-col overflow-hidden text-right z-20 modal-content-container`}
          >
            {/* Modal Header */}
            <div className={`border-b border-slate-200/80 flex items-center justify-between bg-white shrink-0 z-10 ${headerClassName || 'px-5 py-3.5'}`}>
              <div className="flex items-center gap-2.5 text-right">
                {Icon && (
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 border border-amber-500/20">
                    <Icon className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                    {title}
                  </h3>
                  {description && (
                    <p className="text-xs text-slate-500 font-medium mt-0.5 leading-tight">
                      {description}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all cursor-pointer active:scale-95 border border-slate-200/60"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body with GPU acceleration, touch-scroll support, and overscroll lock */}
            <div 
              className={`flex-1 overflow-y-auto overscroll-contain focus:outline-none scroll-smooth bg-slate-50/70 ${bodyClassName || 'p-4 sm:p-6 space-y-5'}`}
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {children}
            </div>

            {/* Modal Footer */}
            {footerActions && (
              <div className="px-5 py-3.5 bg-white border-t border-slate-200/80 flex items-center justify-between sm:justify-end gap-3 shrink-0 z-10 shadow-xs">
                {footerActions}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// ==========================================
// FormCard Component
// ==========================================
interface FormCardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  badge?: string;
  badgeColor?: 'amber' | 'emerald' | 'blue' | 'slate';
  accentClass?: string;
}

export const FormCard: React.FC<FormCardProps> = ({
  children,
  title,
  subtitle,
  icon,
  badge,
  badgeColor = 'amber',
  accentClass = 'bg-amber-500'
}) => {
  const badgeColors = {
    amber: 'bg-amber-100 text-amber-800',
    emerald: 'bg-emerald-100 text-emerald-800',
    blue: 'bg-blue-100 text-blue-800',
    slate: 'bg-slate-100 text-slate-800',
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-sm transition-all duration-200">
      {(title || icon) && (
        <SectionHeader 
          title={title || ''} 
          subtitle={subtitle} 
          icon={icon} 
          badge={badge} 
          badgeColor={badgeColor}
          accentClass={accentClass}
        />
      )}
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
};

// ==========================================
// SectionHeader Component
// ==========================================
interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  badge?: string;
  badgeColor?: 'amber' | 'emerald' | 'blue' | 'slate';
  accentClass?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  icon: Icon,
  badge,
  badgeColor = 'amber',
  accentClass = 'bg-amber-500'
}) => {
  const badgeColors = {
    amber: 'bg-amber-100 text-amber-800 border-amber-200',
    emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    blue: 'bg-blue-100 text-blue-800 border-blue-200',
    slate: 'bg-slate-100 text-slate-800 border-slate-200',
  };

  return (
    <div className="border-b border-slate-100/90 pb-3 mb-4 flex items-center justify-between gap-2 text-right">
      <div className="flex items-center gap-2">
        {Icon ? (
          <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
            <Icon className="w-4 h-4" />
          </div>
        ) : (
          <span className={`w-2.5 h-2.5 rounded-full ${accentClass}`}></span>
        )}
        <div>
          <h4 className="text-xs sm:text-sm font-black text-slate-900">
            {title}
          </h4>
          {subtitle && (
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {badge && (
        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${badgeColors[badgeColor]}`}>
          {badge}
        </span>
      )}
    </div>
  );
};

// ==========================================
// FormGrid Component
// ==========================================
interface FormGridProps {
  children: React.ReactNode;
  cols?: 1 | 2 | 3 | 4 | 5;
  className?: string;
}

export const FormGrid: React.FC<FormGridProps> = ({
  children,
  cols = 3,
  className = ''
}) => {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4',
    5: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
  };

  return (
    <div className={`grid ${gridCols[cols]} gap-4 ${className}`}>
      {children}
    </div>
  );
};

// ==========================================
// FormField Component
// ==========================================
interface FormFieldProps {
  label: string;
  info?: string;
  error?: string;
  required?: boolean;
  className?: string;
  isMono?: boolean;
  children?: React.ReactNode;
  // Fallback direct inputs support
  type?: 'text' | 'number' | 'email' | 'password' | 'date' | 'time' | 'tel' | 'url';
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  info,
  error,
  required = false,
  className = '',
  isMono = false,
  children,
  type,
  value,
  onChange,
  placeholder,
  disabled = false,
  readOnly = false,
}) => {
  return (
    <div className={`flex flex-col gap-1.5 text-right w-full ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <label className="block text-xs sm:text-[13px] font-bold text-slate-800 select-none">
          {label} {required && <span className="text-red-500 font-bold">*</span>}
        </label>
        {info && (
          <span className="text-[10px] text-slate-400 font-semibold">{info}</span>
        )}
      </div>

      {children ? (
        children
      ) : (
        <input
          type={type || 'text'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          dir={isMono || type === 'date' || type === 'time' ? 'ltr' : 'rtl'}
          className={`w-full px-3.5 py-2 sm:py-2.5 bg-white border ${
            error ? 'border-red-400 focus:ring-red-500/15 focus:border-red-500' : 'border-slate-300 focus:ring-amber-500/20 focus:border-amber-500'
          } rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 transition-all duration-200 disabled:opacity-50 disabled:bg-slate-100 ${
            isMono || type === 'date' || type === 'time' ? 'font-mono text-left' : 'font-sans'
          }`}
        />
      )}

      {error && (
        <p className="text-xs text-red-500 font-bold mt-0.5 animate-fadeIn">
          {error}
        </p>
      )}
    </div>
  );
};

// ==========================================
// PrimaryButton Component
// ==========================================
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  icon?: LucideIcon;
  isLoading?: boolean;
  className?: string;
}

export const PrimaryButton: React.FC<ButtonProps> = ({
  children,
  icon: Icon,
  isLoading = false,
  className = '',
  ...props
}) => {
  return (
    <button
      {...props}
      disabled={isLoading || props.disabled}
      className={`px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-slate-950 text-xs rounded-xl font-bold transition-all shadow-xs hover:shadow-sm active:scale-97 flex items-center justify-center gap-1 cursor-pointer disabled:cursor-not-allowed ${className}`}
    >
      {isLoading ? (
        <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
      ) : Icon ? (
        <Icon className="w-4 h-4" />
      ) : null}
      <span>{children}</span>
    </button>
  );
};

// ==========================================
// SecondaryButton Component
// ==========================================
export const SecondaryButton: React.FC<ButtonProps> = ({
  children,
  icon: Icon,
  isLoading = false,
  className = '',
  ...props
}) => {
  return (
    <button
      {...props}
      disabled={isLoading || props.disabled}
      className={`px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 disabled:bg-slate-50 text-slate-600 hover:text-slate-800 text-xs rounded-xl font-bold transition-all active:scale-97 flex items-center justify-center gap-1 cursor-pointer disabled:cursor-not-allowed ${className}`}
    >
      {isLoading ? (
        <span className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
      ) : Icon ? (
        <Icon className="w-4 h-4" />
      ) : null}
      <span>{children}</span>
    </button>
  );
};

// ==========================================
// DangerButton Component
// ==========================================
export const DangerButton: React.FC<ButtonProps> = ({
  children,
  icon: Icon,
  isLoading = false,
  className = '',
  ...props
}) => {
  return (
    <button
      {...props}
      disabled={isLoading || props.disabled}
      className={`px-5 py-2.5 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white text-xs rounded-xl font-bold transition-all shadow-xs hover:shadow-sm active:scale-97 flex items-center justify-center gap-1 cursor-pointer disabled:cursor-not-allowed ${className}`}
    >
      {isLoading ? (
        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : Icon ? (
        <Icon className="w-4 h-4" />
      ) : null}
      <span>{children}</span>
    </button>
  );
};
