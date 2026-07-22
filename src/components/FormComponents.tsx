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
}

export const BaseModal: React.FC<BaseModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  icon: Icon,
  size = 'md',
  children,
  footerActions
}) => {
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-2xl',
    xl: 'max-w-3xl',
    '2xl': 'max-w-4xl',
    '3xl': 'max-w-5xl',
    '4xl': 'max-w-6xl',
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
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden p-4" dir="rtl">
          {/* High-performance, lag-free backdrop overlay without CPU-intensive backdrop-filter blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="modal-backdrop fixed inset-0 bg-slate-950/70 transition-opacity z-10"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 15 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
            className={`relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full ${sizeClasses[size]} max-h-[90vh] flex flex-col overflow-hidden text-right z-20 modal-content-container`}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-1.5 text-right">
                {Icon && (
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-black text-slate-900 leading-tight">
                    {title}
                  </h3>
                  {description && (
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5 leading-tight">
                      {description}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-all cursor-pointer active:scale-95"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body with GPU acceleration, touch-scroll support, and overscroll lock */}
            <div 
              className="flex-1 overflow-y-auto overscroll-contain p-6 space-y-6 focus:outline-none scroll-smooth"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {children}
            </div>

            {/* Modal Footer */}
            {footerActions && (
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between sm:justify-end gap-3 shrink-0">
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
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:shadow-sm transition-all duration-300">
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
    <div className="border-b border-slate-100 pb-2.5 mb-4 flex items-center justify-between gap-2 text-right">
      <div className="flex items-center gap-1.5">
        {Icon ? (
          <Icon className="w-4 h-4 text-slate-700" />
        ) : (
          <span className={`w-2 h-2 rounded-full ${accentClass}`}></span>
        )}
        <div>
          <h4 className="text-xs font-black text-slate-800">
            {title}
          </h4>
          {subtitle && (
            <p className="text-[9px] text-slate-400 font-semibold mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {badge && (
        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${badgeColors[badgeColor]}`}>
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
        <label className="block text-xs font-bold text-slate-700 select-none">
          {label} {required && <span className="text-red-500 font-bold">*</span>}
        </label>
        {info && (
          <span className="text-[9px] text-slate-400 font-semibold">{info}</span>
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
          className={`w-full px-3 py-2 bg-slate-50/70 border ${
            error ? 'border-red-400 focus:ring-red-500/10 focus:border-red-500' : 'border-slate-200 focus:ring-amber-500/15 focus:border-amber-500'
          } rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 transition-all duration-200 disabled:opacity-50 disabled:bg-slate-100 ${
            isMono || type === 'date' || type === 'time' ? 'font-mono text-left' : 'font-sans'
          }`}
        />
      )}

      {error && (
        <p className="text-[10px] text-red-500 font-bold mt-0.5 animate-fadeIn">
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
