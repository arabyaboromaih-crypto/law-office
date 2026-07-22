/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Scale, Lock, ShieldAlert, KeyRound, User, Phone, Mail, CheckCircle2 } from 'lucide-react';
import { User as UserType, UserPermissions } from '../types';
import { cleanDigits } from '../utils/arabicNumbers';

interface InitializationScreenProps {
  onInitializationComplete: (adminData: UserType) => void;
}

export default function InitializationScreen({ onInitializationComplete }: InitializationScreenProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [systemPassword, setSystemPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Director Details Form
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');

  const handleVerifyPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (systemPassword === '1993') {
      setSuccess('تم التحقق من كلمة سر النظام بنجاح! يرجى إدخال بيانات المدير العام لتهيئة الحساب الأول.');
      setTimeout(() => {
        setStep(2);
        setError('');
        setSuccess('');
      }, 1000);
    } else {
      setError('كلمة سر النظام غير صحيحة. يرجى إدخال كلمة المرور الأمنية المحددة للتهيئة (1993).');
    }
  };

  const handleSaveDirectorDetails = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!fullName || !username || !phone || !password) {
      setError('يرجى ملء كافة الحقول الإجبارية لتهيئة حساب المدير العام.');
      return;
    }

    if (username.trim().length < 3) {
      setError('اسم المستخدم يجب أن يتكون من 3 أحرف على الأقل.');
      return;
    }

    if (phone.trim().length < 5) {
      setError('رقم الهاتف المدخل غير صالح.');
      return;
    }

    if (password.length < 4) {
      setError('كلمة المرور يجب أن لا تقل عن 4 خانات للأمان.');
      return;
    }

    // Default full permissions for General Director (admin)
    const adminPermissions: UserPermissions = {
      viewCases: true, addCase: true, editCase: true, deleteCase: true, archiveCase: true, restoreCase: true, printCase: true,
      viewCompanies: true, addCompany: true, editCompany: true, deleteCompany: true, archiveCompany: true, restoreCompany: true, printCompany: true,
      viewClients: true, addClient: true, editClient: true, deleteClient: true,
      addSession: true, editSession: true, deleteSession: true, recordSessionDecision: true, editSessionDecision: true,
      uploadDoc: true, downloadDoc: true, deleteDoc: true, printDoc: true,
      viewFees: true, addReceipt: true, editFees: true, deleteFees: true,
      viewReports: true, printReports: true, exportPdf: true, exportExcel: true,
      manageUsers: true,
      manageTasks: true, viewUserTaskTracking: true, viewTaskExecutionTracking: true
    };

    const newDirector: UserType = {
      id: 'user-admin', // Keep consistent with existing system permissions & checks
      fullName: fullName.trim(),
      phone: phone.trim(),
      username: username.trim().toLowerCase(),
      email: email.trim() || undefined,
      role: 'admin',
      title: 'المدير العام للمؤسسة',
      hireDate: new Date().toISOString().split('T')[0],
      status: 'active',
      permissions: adminPermissions,
      forcePasswordChange: false,
      password: password
    };

    onInitializationComplete(newDirector);
  };

  return (
    <div className="min-h-screen bg-[#0d121f] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans select-none text-right" dir="rtl">
      
      {/* Decorative luxury backgrounds */}
      <div className="absolute inset-0 pointer-events-none select-none z-0 overflow-hidden bg-gradient-to-b from-[#0b0e17] via-[#0f1524] to-[#0c0f1a]" />
      <div className="absolute top-[10%] left-[20%] w-[450px] h-[450px] bg-amber-500/[0.04] rounded-full blur-[110px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[5%] w-[550px] h-[550px] bg-sky-500/[0.03] rounded-full blur-[140px] pointer-events-none" />

      {/* Brand Header */}
      <div className="flex flex-col items-center justify-center mb-8 relative z-10 animate-fadeIn">
        <div className="relative flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-b from-[#102a52] to-[#0a1931] border-2 border-amber-500/50 shadow-2xl p-1.5 overflow-hidden">
          <div className="absolute inset-1 rounded-full border border-dashed border-amber-400/30 z-10 pointer-events-none" />
          <div className="flex items-center justify-center w-full h-full rounded-full bg-[#0a1931]">
            <Scale className="w-10 h-10 text-amber-500" />
          </div>
        </div>
        <div className="text-center mt-4 space-y-1">
          <h1 className="text-2xl font-black text-white tracking-wider font-sans drop-shadow-md">
            <span>مؤسسة رميح للمحاماة</span>
          </h1>
          <span className="text-[10px] bg-amber-500/10 text-amber-400 font-extrabold px-4 py-0.5 border border-amber-500/20 rounded-full uppercase tracking-wider">
            بوابة الإدارة الرقمية للأنظمة القانونية
          </span>
        </div>
      </div>

      {/* Form Container */}
      <div className="w-full max-w-lg bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-2xl p-6 sm:p-8 relative z-10 transition-all duration-300">
        
        {/* Step Title Indicator */}
        <div className="border-b border-slate-100 pb-3 mb-6 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-900">
            {step === 1 ? 'تهيئة النظام وتأمينه' : 'تسجيل بيانات المدير العام للمؤسسة'}
          </span>
          <span className="text-[10px] bg-amber-500/10 text-amber-700 font-extrabold px-2.5 py-0.5 rounded-md">
            {step === 1 ? 'الخطوة الأولى: التحقق' : 'الخطوة الثانية: البيانات'}
          </span>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mb-5 p-4 bg-red-500/10 border-r-4 border-red-500 border-y border-l border-red-500/20 rounded-xl text-red-700 text-xs flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
            <span className="font-semibold leading-relaxed">{error}</span>
          </div>
        )}

        {/* Success Notification */}
        {success && (
          <div className="mb-5 p-4 bg-emerald-500/10 border-r-4 border-emerald-500 border-y border-l border-emerald-500/20 rounded-xl text-emerald-700 text-xs flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500 mt-0.5" />
            <span className="font-semibold leading-relaxed">{success}</span>
          </div>
        )}

        {/* STEP 1: Verify System Password */}
        {step === 1 && (
          <form onSubmit={handleVerifyPassword} className="space-y-6">
            <div className="space-y-2">
              <p className="text-xs text-slate-600 leading-relaxed">
                مرحباً بك في نظام المحاماة الذكي لمؤسسة رميح. يرجى إدخال كلمة سر النظام السرية للبدء في تفعيل منصة الإدارة القانونية وإنشاء حساب المدير العام.
              </p>
              <div className="relative mt-2">
                <span className="absolute right-3.5 top-3.5 text-slate-400">
                  <Lock className="w-5 h-5" />
                </span>
                <input
                  type="password"
                  placeholder="أدخل كلمة سر تهيئة النظام (1993)"
                  value={systemPassword}
                  onChange={(e) => setSystemPassword(e.target.value)}
                  className="w-full pl-4 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all text-center font-mono placeholder:text-slate-400"
                  required
                />
              </div>
              <p className="text-[10px] text-amber-600 font-semibold">
                * ملاحظة: لا يمكن إكمال تهيئة النظام إلا بإدخال كلمة سر النظام المحددة وهي: <span className="font-bold font-mono">1993</span>
              </p>
            </div>

            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 transition-all active:scale-[0.98] cursor-pointer"
            >
              <KeyRound className="w-4 h-4 text-slate-950" />
              <span>التحقق والبدء بالتهيئة</span>
            </button>
          </form>
        )}

        {/* STEP 2: General Director Details */}
        {step === 2 && (
          <form onSubmit={handleSaveDirectorDetails} className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              تم التحقق بنجاح. يرجى ملء البيانات التالية لإنشاء حساب <strong>المدير العام ومدير المؤسسة</strong> الرئيسي. هذا الحساب سيمتلك الصلاحيات الكاملة لإدارة كافة القضايا والمستخدمين.
            </p>

            {/* Full Name */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">الاسم بالكامل للمدير العام <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="absolute right-3 top-3 text-slate-400">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="الأستاذ عربي رميح"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Username & Phone Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Username */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">اسم المستخدم للولوج <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="araby"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all font-mono text-left"
                  dir="ltr"
                />
              </div>

              {/* Phone */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">رقم الهاتف للولوج والتواصل <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute right-3 top-3 text-slate-400">
                    <Phone className="w-4 h-4" />
                  </span>
                  <input
                    type="tel"
                    required
                    placeholder="01012345678"
                    value={phone}
                    onChange={(e) => setPhone(cleanDigits(e.target.value))}
                    className="w-full pl-4 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all font-mono text-left"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>

            {/* Password & Email Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Password */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">كلمة المرور آمنة <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute right-3 top-3 text-slate-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-4 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all font-mono text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">البريد الإلكتروني (اختياري)</label>
                <div className="relative">
                  <span className="absolute right-3 top-3 text-slate-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    placeholder="araby@romeih-law.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-4 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all font-mono text-left"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 transition-all active:scale-[0.98] mt-4 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-slate-950" />
              <span>حفظ بيانات المدير العام وتفعيل النظام</span>
            </button>
          </form>
        )}

        {/* Footer info text */}
        <div className="text-center mt-6 text-[10px] text-slate-500 font-mono">
          بوابة الإدارة الرقمية لمؤسسة رميح للمحاماة © 2026 جميع الحقوق محفوظة
        </div>
      </div>
    </div>
  );
}
