/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { 
  Scale, Phone, Lock, ShieldAlert, KeyRound, 
  Eye, EyeOff, X, Shield, CheckCircle2, Download
} from 'lucide-react';
import { cleanDigits, toEn } from '../utils/arabicNumbers';

// Keyboard layout translations
const enToArMap: { [key: string]: string } = {
  'q': 'ض', 'w': 'ص', 'e': 'ث', 'r': 'ق', 't': 'ف', 'y': 'غ', 'u': 'ع', 'i': 'ه', 'o': 'خ', 'p': 'ح', '[': 'ج', ']': 'د',
  'a': 'ش', 's': 'س', 'd': 'ي', 'f': 'ب', 'g': 'ل', 'h': 'ا', 'j': 'ت', 'k': 'ن', 'l': 'م', ';': 'ك', "'": 'ط',
  'z': 'ئ', 'x': 'ء', 'c': 'ؤ', 'v': 'ر', 'b': 'لا', 'n': 'ى', 'm': 'ة', ',': 'و', '.': 'ز', '/': 'ظ', '`': 'ذ', '\\': '\\',
  'Q': 'َ', 'W': 'ً', 'E': 'ُ', 'R': 'ٌ', 'T': 'لإ', 'Y': 'إ', 'U': '`', 'I': '÷', 'O': '×', 'P': '؛', '{': '<', '}': '>',
  'A': 'ِ', 'S': 'ٍ', 'D': '[', 'F': ']', 'G': 'لأ', 'H': 'أ', 'J': 'ـ', 'K': '،', 'L': '/', ':': ':', '"': '"',
  'Z': '~', 'X': 'ْ', 'C': '}', 'V': '{', 'B': 'لآ', 'N': 'آ', 'M': '’', '<': ',', '>': '.', '?': '؟', '~': 'ّ'
};

const arToEnMap: { [key: string]: string } = {
  'ض': 'q', 'ص': 'w', 'ث': 'e', 'ق': 'r', 'ف': 't', 'غ': 'y', 'ع': 'u', 'ه': 'i', 'خ': 'o', 'ح': 'p', 'ج': '[', 'د': ']',
  'ش': 'a', 'س': 's', 'ي': 'd', 'ب': 'f', 'ل': 'g', 'ا': 'h', 'ت': 'j', 'ن': 'k', 'م': 'l', 'ك': ';', 'ط': "'",
  'ئ': 'z', 'ء': 'x', 'ؤ': 'c', 'ر': 'v', 'ى': 'n', 'ة': 'm', 'و': ',', 'ز': '.', 'ظ': '/', 'ذ': '`', '\\': '\\',
  'َ': 'Q', 'ً': 'W', 'ُ': 'E', 'ٌ': 'R', 'إ': 'Y', '`': 'U', '÷': 'I', '×': 'O', '؛': 'P', '<': '{', '>': '}',
  'ِ': 'A', 'ٍ': 'S', '[': 'D', ']': 'F', 'أ': 'H', 'ـ': 'J', '،': 'K', '/': 'L', ':': ':', '"': '"',
  '~': 'Z', 'ْ': 'X', '}': 'C', '{': 'V', 'آ': 'N', '’': 'M', '؟': '?', 'ّ': '~'
};

function translateEnToAr(str: string): string {
  return str.split('').map(char => enToArMap[char] || char).join('');
}

function translateArToEn(str: string): string {
  let res = str;
  // Replace compound ligatures first
  res = res.replace(/لأ/g, 'G');
  res = res.replace(/لإ/g, 'T');
  res = res.replace(/لآ/g, 'B');
  res = res.replace(/لا/g, 'b');
  return res.split('').map(char => arToEnMap[char] || char).join('');
}

function normalizeTextForComparison(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    // Convert Eastern Arabic digits to Latin
    .replace(/[٠-٩]/g, (char) => String(char.charCodeAt(0) - 1632))
    // Normalize Alifs
    .replace(/[أإآٱ]/g, 'ا')
    // Normalize Ta Marbuta / Ha
    .replace(/ة/g, 'ه')
    // Normalize Ya / Alif Maksura
    .replace(/[ىي]/g, 'ي')
    // Remove diacritics
    .replace(/[\u064B-\u065F]/g, '');
}

function findUserByIdentifier(users: User[], identifier: string): User | undefined {
  if (!identifier) return undefined;
  
  const trimmed = identifier.trim();
  
  // Generate input variants
  const candidates = new Set<string>();
  candidates.add(trimmed);
  candidates.add(translateArToEn(trimmed));
  candidates.add(translateEnToAr(trimmed));
  
  // Add number normalization variants
  const list = Array.from(candidates);
  for (const c of list) {
    candidates.add(toEn(c));
    candidates.add(c.replace(/[0-9]/g, (char) => '٠١٢٣٤٥٦٧٨٩'[char.charCodeAt(0) - 48]));
  }

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeTextForComparison(candidate);
    const cleanCandidate = candidate.replace(/\D/g, '');

    for (const u of users) {
      const normalizedUsername = normalizeTextForComparison(u.username);
      const normalizedPhone = normalizeTextForComparison(u.phone);
      const normalizedEmail = normalizeTextForComparison(u.email);
      const cleanUserPhone = (u.phone || '').replace(/\D/g, '');

      // Check normalized exact string matching
      if (normalizedCandidate && (
        normalizedCandidate === normalizedUsername ||
        normalizedCandidate === normalizedPhone ||
        normalizedCandidate === normalizedEmail
      )) {
        return u;
      }

      // Check purely digit match
      if (cleanCandidate && /^\d+$/.test(cleanCandidate) && cleanUserPhone) {
        if (cleanUserPhone === cleanCandidate || cleanUserPhone.endsWith(cleanCandidate) || cleanCandidate.endsWith(cleanUserPhone)) {
          return u;
        }
      }
    }
  }

  return undefined;
}

interface LoginScreenProps {
  users: User[];
  onLoginSuccess: (user: User) => void;
  isInstalledApp?: boolean;
  onInstallClick?: () => void;
}

export default function LoginScreen({ users, onLoginSuccess, isInstalledApp = false, onInstallClick }: LoginScreenProps) {
  const isDev = (import.meta as any).env?.DEV || window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1') || window.location.hostname.includes('ais-dev');

  const [phone, setPhone] = useState(''); // This acts as identifier (username or phone)
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);

  // Remember me states
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem('romeih_remember_me') === 'true';
  });

  // Forgot Password modal states
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [logoError, setLogoError] = useState(false);

  // Load remembered user
  useEffect(() => {
    if (rememberMe) {
      const savedPhone = localStorage.getItem('romeih_remembered_phone') || '';
      setPhone(savedPhone);
    }
  }, [rememberMe]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!phone || !password) {
      setError('يرجى إدخال اسم المستخدم أو رقم الهاتف وكلمة المرور لتسجيل الدخول');
      return;
    }

    const foundUser = findUserByIdentifier(users, phone);

    if (foundUser) {
      if (foundUser.status === 'suspended') {
        setError('عذراً، هذا الحساب موقوف حالياً بموجب قرار من الإدارة المالية والإدارية للمؤسسة.');
        return;
      }
      
      const userPassword = (foundUser.password || foundUser.phone || '').trim();
      const enteredPassword = password.trim();

      // Generate candidates for entered password
      const passwordCandidates = new Set<string>();
      passwordCandidates.add(enteredPassword);
      passwordCandidates.add(translateArToEn(enteredPassword));
      passwordCandidates.add(translateEnToAr(enteredPassword));

      // Add number normalization variants
      const pList = Array.from(passwordCandidates);
      for (const p of pList) {
        passwordCandidates.add(toEn(p));
        passwordCandidates.add(p.replace(/[0-9]/g, (char) => '٠١٢٣٤٥٦٧٨٩'[char.charCodeAt(0) - 48]));
      }

      // Check if any of these match the user's password exactly or under soft character normalization
      let passwordMatched = false;
      const normalizedUserPassword = normalizeTextForComparison(userPassword);

      for (const pCandidate of passwordCandidates) {
        if (pCandidate === userPassword || normalizeTextForComparison(pCandidate) === normalizedUserPassword) {
          passwordMatched = true;
          break;
        }
      }

      if (!passwordMatched) {
        setError('كلمة المرور التي أدخلتها غير صحيحة. يرجى المحاولة مرة أخرى.');
        return;
      }

      // Save remember credentials
      if (rememberMe) {
        localStorage.setItem('romeih_remember_me', 'true');
        localStorage.setItem('romeih_remembered_phone', phone);
      } else {
        localStorage.removeItem('romeih_remember_me');
        localStorage.removeItem('romeih_remembered_phone');
      }

      setSuccessMsg('تم التحقق بنجاح! جارٍ الدخول للنظام القضائي الموحد للمؤسسة...');
      setTimeout(() => {
        onLoginSuccess(foundUser);
      }, 1000);
    } else {
      setError('اسم المستخدم أو رقم الهاتف المدخل غير مسجل، أو كلمة المرور غير صحيحة.');
    }
  };

  const handleQuickDemo = () => {
    setError('');
    const adminUser = users.find(u => u.role === 'admin') || users[0];
    if (adminUser) {
      onLoginSuccess(adminUser);
    } else {
      setError('عذراً، لا يوجد أي مستخدم مسجل في قاعدة البيانات للولوج السريع.');
    }
  };

  const handleForgotPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMsg('');

    if (!forgotPhone) {
      setForgotMsg('يرجى إدخال رقم هاتف أو اسم مستخدم الحساب أولاً.');
      setForgotSuccess(false);
      return;
    }

    const found = findUserByIdentifier(users, forgotPhone);

    if (found) {
      setForgotMsg(`مرحباً بك زميلنا الأستاذ/الأستاذة: ${found.fullName} (${found.title}).\nلقد وجدنا الحساب بنجاح!\n\n🔒 لدواعي الأمن والحفاظ على سرية البيانات، تم إخفاء كلمات المرور بالنظام الموحد. يرجى التواصل مع المدير العام (الأستاذ / عربي رميح) مباشرة لإعادة تعيين كلمة المرور الخاصة بك.`);
      setForgotSuccess(true);
    } else {
      setForgotMsg('عذراً، البيانات المدخلة غير مسجلة على النظام القضائي لدينا. يرجى التحقق من المدخلات.');
      setForgotSuccess(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d121f] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans select-none text-right" dir="rtl">
      
      {/* Premium background decorations */}
      <div className="absolute inset-0 pointer-events-none select-none z-0 overflow-hidden bg-gradient-to-b from-[#0b0e17] via-[#0f1524] to-[#0c0f1a]" />
      <div className="absolute top-[15%] left-[25%] w-[450px] h-[450px] bg-amber-500/[0.04] rounded-full blur-[110px] pointer-events-none" />
      <div className="absolute bottom-[25%] right-[5%] w-[550px] h-[550px] bg-sky-500/[0.03] rounded-full blur-[140px] pointer-events-none" />

      {/* Brand Header */}
      <div className="flex flex-col items-center justify-center mb-8 relative z-10 animate-fadeIn">
        <div className="relative flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-b from-[#102a52] to-[#0a1931] border-2 border-amber-500/50 shadow-2xl p-1.5 overflow-hidden">
          {/* Decorative inner dotted border */}
          <div className="absolute inset-1 rounded-full border border-dashed border-amber-400/30 z-10 pointer-events-none" />
          <div className="flex items-center justify-center w-full h-full rounded-full overflow-hidden bg-[#0a1931]">
            {!logoError ? (
              <img 
                src="/icon-512.png" 
                alt="شعار مؤسسة رميح" 
                className="w-full h-full object-contain" 
                referrerPolicy="no-referrer" 
                onError={() => setLogoError(true)}
              />
            ) : (
              <Scale className="w-10 h-10 text-amber-500" />
            )}
          </div>
        </div>
        <div className="text-center mt-4 space-y-1">
          <h1 className="text-2xl font-black text-white tracking-wider font-sans flex items-center justify-center gap-1.5 drop-shadow-md">
            <span>مؤسسة رميح للمحاماة</span>
          </h1>
          <span className="text-[10px] bg-amber-500/10 text-amber-400 font-extrabold px-3 py-0.5 border border-amber-500/20 rounded-full uppercase tracking-wider">
            لأعمال المحاماة والاستشارات القانونية
          </span>
        </div>
      </div>

      {/* Main Form Container */}
      <div className="w-full max-w-lg bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-2xl p-6 sm:p-8 relative z-10 transition-all duration-300">
        
        {/* Error Notification Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border-r-4 border-red-500 border-y border-l border-red-500/20 rounded-xl text-red-700 text-xs flex items-start gap-3 animate-shake">
            <ShieldAlert className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
            <span className="font-semibold leading-relaxed">{error}</span>
          </div>
        )}

        {/* Success Notification Banner */}
        {successMsg && (
          <div className="mb-6 p-4 bg-emerald-500/10 border-r-4 border-emerald-500 border-y border-l border-emerald-500/20 rounded-xl text-emerald-700 text-xs flex items-start gap-3 animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500 mt-0.5" />
            <span className="font-semibold leading-relaxed">{successMsg}</span>
          </div>
        )}

        {/* LOGIN FORM */}
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-900">تسجيل دخول الزملاء والمحامين</span>
            <span className="text-[10px] text-amber-600 font-extrabold font-mono">الولوج الآمن للمكتب</span>
          </div>

          {/* Phone or Username */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">اسم المستخدم أو رقم الهاتف</label>
            <div className="relative">
              <span className="absolute right-3.5 top-3.5 text-slate-400">
                <Phone className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="أدخل اسم المستخدم أو رقم الهاتف المسجل"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-4 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all placeholder:text-slate-400 text-right"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-semibold text-slate-700">كلمة المرور</label>
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setForgotPhone('');
                  setForgotMsg('');
                  setForgotSuccess(false);
                  setShowForgotModal(true);
                }}
                className="text-[10px] text-amber-600 hover:text-amber-700 font-extrabold underline transition-colors"
              >
                نسيت كلمة المرور؟
              </button>
            </div>
            <div className="relative">
              <span className="absolute right-3.5 top-3.5 text-slate-400">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all placeholder:text-slate-400 text-left"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Remember me checkbox */}
          <div className="flex items-center gap-2 py-1">
            <input
              type="checkbox"
              id="remember_me"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded-md border-slate-200 bg-slate-50 text-amber-600 focus:ring-amber-500/30 cursor-pointer"
            />
            <label htmlFor="remember_me" className="text-xs text-slate-600 hover:text-slate-800 font-semibold cursor-pointer select-none">
              تذكرني على هذا المتصفح
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 transition-all active:scale-[0.98] cursor-pointer"
          >
            <Shield className="w-4 h-4 text-slate-950" />
            <span>تسجيل الدخول للنظام القضائي الموحد</span>
          </button>


        </form>

        {/* Footer info text */}
        <div className="text-center mt-6 text-[10px] text-slate-600 font-mono">
          بوابة الإدارة الرقمية لمؤسسة رميح للمحاماة © 2026 جميع الحقوق محفوظة
        </div>
      </div>

      {/* FORGOT PASSWORD OVERLAY MODAL */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-[#0a1931]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 relative shadow-2xl animate-scaleUp text-right" dir="rtl">
            
            {/* Header */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <span className="text-sm font-black text-amber-600 flex items-center gap-1.5">
                <KeyRound className="w-5 h-5" />
                <span>استرجاع كلمة المرور للزملاء</span>
              </span>
              <button 
                onClick={() => {
                  setShowForgotModal(false);
                  setForgotPhone('');
                  setForgotMsg('');
                }}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4 pt-4">
              <p className="text-[11px] text-slate-600 leading-relaxed">
                يرجى كتابة رقم الهاتف أو اسم المستخدم المسجل المرتبط بحسابك لعرض كلمة المرور فوراً من ملف العمل الآمن للمؤسسة.
              </p>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">رقم الهاتف أو اسم المستخدم المسجل</label>
                <input
                  type="text"
                  placeholder="أدخل رقم الهاتف أو اسم المستخدم"
                  value={forgotPhone}
                  onChange={(e) => setForgotPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 text-right"
                />
              </div>

              {/* Message Display */}
              {forgotMsg && (
                <div className={`p-3 rounded-lg text-xs leading-relaxed whitespace-pre-line ${
                  forgotSuccess 
                    ? 'bg-amber-500/10 border border-amber-500/30 text-amber-700' 
                    : 'bg-red-500/10 border border-red-500/30 text-red-700'
                }`}>
                  {forgotMsg}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(false);
                    setForgotPhone('');
                    setForgotMsg('');
                  }}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs rounded-lg transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  تحقق وعرض كلمة المرور
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
