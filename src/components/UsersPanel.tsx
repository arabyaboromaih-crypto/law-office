/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User, AuditLog, UserRole, UserPermissions } from '../types';
import { 
  Users, Key, Shield, ShieldCheck, UserCheck, UserX, Trash2, Search, PlusCircle, 
  Settings, Clock, AlertTriangle, Monitor, ClipboardList, RefreshCw, X,
  Edit, Camera, Calendar, User as UserIcon, Mail, Briefcase, FileText, Image, CheckCircle2,
  AlertCircle, Trash
} from 'lucide-react';
import { cleanDigits } from '../utils/arabicNumbers';
import { validateNationalId } from '../utils/validation';

interface UsersPanelProps {
  users: User[];
  auditLogs: AuditLog[];
  currentUser: User;
  onAddUser: (u: User) => void;
  onUpdateUser: (u: User) => void;
  onResetPassword: (userId: string) => void;
  onDeleteUser: (userId: string, passwordConfirm: string) => boolean;
}

export default function UsersPanel({ 
  users, auditLogs, currentUser, onAddUser, onUpdateUser, onResetPassword, onDeleteUser
}: UsersPanelProps) {
  
  // Tab within panel: Users vs Logs
  const [activeTab, setActiveTab] = useState<'staff' | 'logs'>('staff');

  // Search States
  const [userQuery, setUserQuery] = useState('');
  const [logQuery, setLogQuery] = useState('');

  // Selected User for Permissions editing
  const [selectedUserForPerms, setSelectedUserForPerms] = useState<User | null>(null);

  // New User Form State
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('lawyer');
  const [titleOption, setTitleOption] = useState('محامٍ');
  const [customTitle, setCustomTitle] = useState('');
  const [hireDate, setHireDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<'active' | 'suspended' | 'terminated'>('active');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [notes, setNotes] = useState('');

  // Edit User Form State
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editNationalId, setEditNationalId] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('lawyer');
  const [editTitleOption, setEditTitleOption] = useState('محامٍ');
  const [editCustomTitle, setEditCustomTitle] = useState('');
  const [editHireDate, setEditHireDate] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'suspended' | 'terminated'>('active');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Deletion state
  const [deleteUserTarget, setDeleteUserTarget] = useState<User | null>(null);
  const [deleteUserPassword, setDeleteUserPassword] = useState('');
  const [deleteUserError, setDeleteUserError] = useState('');

  const handleDeleteUserSubmit = () => {
    if (!deleteUserTarget || !onDeleteUser) return;
    if (!deleteUserPassword) {
      setDeleteUserError('كلمة المرور مطلوبة للتأكيد النهائي');
      return;
    }
    const success = onDeleteUser(deleteUserTarget.id, deleteUserPassword);
    if (success) {
      setDeleteUserTarget(null);
      setDeleteUserPassword('');
      setDeleteUserError('');
    } else {
      setDeleteUserError('كلمة المرور غير صحيحة. يرجى إدخال كلمة سر الدخول الخاصة بك لتأكيد الحذف.');
    }
  };

  // Filter users
  const filteredUsers = users.filter(u => 
    u.fullName.includes(userQuery) ||
    u.phone.includes(userQuery) ||
    u.title.includes(userQuery) ||
    (u.nationalId && u.nationalId.includes(userQuery))
  );

  // Filter logs
  const filteredLogs = auditLogs.filter(l => 
    l.fullName.includes(logQuery) ||
    l.details.includes(logQuery) ||
    l.actionType.includes(logQuery)
  );

  // Helper for profile picture upload
  const handleImageFileChange = (file: File | undefined, callback: (base64: string) => void) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('حجم الصورة كبير جداً. يرجى اختيار صورة أصغر من 2 ميجابايت.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      callback(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleOpenEditModal = (u: User) => {
    setSelectedUserForEdit(u);
    setEditFullName(u.fullName);
    setEditPhone(u.phone);
    setEditUsername(u.username || '');
    setEditPassword(u.password || '');
    setEditNationalId(u.nationalId || '');
    setEditEmail(u.email || '');
    setEditRole(u.role);
    setEditHireDate(u.hireDate);
    setEditStatus(u.status);
    setEditAvatarUrl(u.avatarUrl || '');
    setEditNotes(u.notes || '');

    const standardTitles = ['محامٍ', 'محامٍ تحت التمرين', 'سكرتير', 'إداري', 'محاسب', 'مدير'];
    if (standardTitles.includes(u.title)) {
      setEditTitleOption(u.title);
      setEditCustomTitle('');
    } else {
      setEditTitleOption('other');
      setEditCustomTitle(u.title);
    }
  };

  // Toggle user active / suspended status
  const handleToggleUserStatus = (u: User) => {
    if (u.id === 'user-admin') {
      alert('عفواً، لا يمكن حظر أو تعطيل حساب مدير النظام العام الرئيسي.');
      return;
    }
    const updatedStatus = u.status === 'active' ? 'suspended' : 'active';
    onUpdateUser({
      ...u,
      status: updatedStatus
    });
  };

  // Permission toggles
  const handlePermissionToggle = (key: keyof UserPermissions) => {
    if (!selectedUserForPerms) return;
    if (selectedUserForPerms.id === 'user-admin') {
      alert('لا يمكن سحب صلاحيات مدير النظام الرئيسي.');
      return;
    }

    const updatedPermissions = {
      ...selectedUserForPerms.permissions,
      [key]: !selectedUserForPerms.permissions[key]
    };

    const updatedUser = {
      ...selectedUserForPerms,
      permissions: updatedPermissions
    };

    onUpdateUser(updatedUser);
    setSelectedUserForPerms(updatedUser);
  };

  // Submit new user
  const handleAddUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !phone || !username || !password) {
      alert('الرجاء ملء الاسم بالكامل، اسم المستخدم، رقم الهاتف، وكلمة المرور.');
      return;
    }

    let finalNationalId = nationalId || undefined;
    if (nationalId && nationalId.trim().length > 0) {
      const { isValid, normalizedValue } = validateNationalId(nationalId);
      if (!isValid) {
        alert('الرقم القومي يجب أن يتكون من 14 رقمًا صحيحة.');
        return;
      }
      finalNationalId = normalizedValue;
    }

    const normalizedUsername = username.trim().toLowerCase();
    if (users.some(u => u.phone === phone)) {
      alert('هذا الهاتف مسجل بالفعل لمستخدم آخر بالمؤسسة.');
      return;
    }

    if (users.some(u => u.username && u.username.toLowerCase() === normalizedUsername)) {
      alert('اسم المستخدم هذا محجوز لزميل آخر بالفعل. يرجى اختيار اسم مستخدم فريد.');
      return;
    }

    const resolvedTitle = titleOption === 'other' ? customTitle : titleOption;
    if (!resolvedTitle) {
      alert('الرجاء تحديد المسمى الوظيفي.');
      return;
    }

    // Default permissions based on roles
    const defaultPermissions: UserPermissions = {
      viewCases: true,
      addCase: role !== 'employee',
      editCase: role !== 'employee',
      deleteCase: role === 'admin' || role === 'lawyer',
      archiveCase: role === 'admin' || role === 'lawyer',
      restoreCase: role === 'admin',
      printCase: true,
      viewCompanies: true,
      addCompany: role !== 'employee',
      editCompany: role !== 'employee',
      deleteCompany: role === 'admin' || role === 'lawyer',
      archiveCompany: role === 'admin' || role === 'lawyer',
      restoreCompany: role === 'admin',
      printCompany: true,
      viewClients: true,
      addClient: true,
      editClient: true,
      deleteClient: role === 'admin' || role === 'lawyer',
      addSession: role !== 'employee',
      editSession: role !== 'employee',
      deleteSession: role === 'admin' || role === 'lawyer',
      recordSessionDecision: true,
      editSessionDecision: role !== 'employee',
      uploadDoc: true,
      downloadDoc: true,
      deleteDoc: role === 'admin' || role === 'lawyer',
      printDoc: true,
      viewFees: role === 'admin' || role === 'secretary',
      addReceipt: role === 'admin' || role === 'secretary',
      editFees: role === 'admin',
      deleteFees: role === 'admin' || role === 'lawyer',
      viewReports: role === 'admin' || role === 'lawyer',
      printReports: role === 'admin' || role === 'lawyer',
      exportPdf: role === 'admin',
      exportExcel: role === 'admin',
      manageUsers: role === 'admin',
      manageSettings: role === 'admin',
      manageTasks: role === 'admin',
      viewUserTaskTracking: true, // Everyone gets task tracking of their own tasks by default
      viewTaskExecutionTracking: role === 'admin'
    };

    const newUser: User = {
      id: `user-${Date.now()}`,
      fullName: fullName.trim(),
      phone: phone.trim(),
      username: normalizedUsername,
      password: password,
      nationalId: finalNationalId,
      email: email || undefined,
      role,
      title: resolvedTitle,
      hireDate,
      status,
      avatarUrl: avatarUrl || undefined,
      notes: notes || undefined,
      permissions: defaultPermissions,
      forcePasswordChange: false
    };

    onAddUser(newUser);
    setShowAddUserModal(false);
    setFullName('');
    setPhone('');
    setUsername('');
    setPassword('');
    setNationalId('');
    setEmail('');
    setRole('lawyer');
    setTitleOption('محامٍ');
    setCustomTitle('');
    setHireDate(new Date().toISOString().split('T')[0]);
    setStatus('active');
    setAvatarUrl('');
    setNotes('');
  };

  // Submit edit user basic info
  const handleEditUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForEdit) return;
    if (!editFullName || !editPhone || !editUsername || !editPassword) {
      alert('الرجاء ملء الاسم بالكامل، اسم المستخدم، رقم الهاتف، وكلمة المرور.');
      return;
    }

    let finalEditNationalId = editNationalId || undefined;
    if (editNationalId && editNationalId.trim().length > 0) {
      const { isValid, normalizedValue } = validateNationalId(editNationalId);
      if (!isValid) {
        alert('الرقم القومي يجب أن يتكون من 14 رقمًا صحيحة.');
        return;
      }
      finalEditNationalId = normalizedValue;
    }

    const normalizedEditUsername = editUsername.trim().toLowerCase();
    
    // Check uniqueness for phone
    if (users.some(u => u.id !== selectedUserForEdit.id && u.phone === editPhone)) {
      alert('رقم الهاتف هذا مسجل بالفعل لمستخدم آخر.');
      return;
    }

    // Check uniqueness for username
    if (users.some(u => u.id !== selectedUserForEdit.id && u.username && u.username.toLowerCase() === normalizedEditUsername)) {
      alert('اسم المستخدم هذا محجوز لزميل آخر بالفعل.');
      return;
    }

    const resolvedTitle = editTitleOption === 'other' ? editCustomTitle : editTitleOption;
    if (!resolvedTitle) {
      alert('الرجاء تحديد المسمى الوظيفي.');
      return;
    }

    const updatedUser: User = {
      ...selectedUserForEdit,
      fullName: editFullName.trim(),
      phone: editPhone.trim(),
      username: normalizedEditUsername,
      password: editPassword,
      nationalId: finalEditNationalId,
      email: editEmail || undefined,
      role: editRole,
      title: resolvedTitle,
      hireDate: editHireDate,
      status: editStatus,
      avatarUrl: editAvatarUrl || undefined,
      notes: editNotes || undefined
    };

    onUpdateUser(updatedUser);
    setSelectedUserForEdit(null);
  };

  return (
    <div className="space-y-3.5 animate-fadeIn">
      
      {/* Sub tabs switcher */}
      <div className="flex bg-slate-200/60 p-1.5 rounded-xl border border-slate-200 self-start inline-flex">
        <button
          onClick={() => setActiveTab('staff')}
          className={`px-5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${activeTab === 'staff' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <Users className="w-4 h-4" />
          أعضاء المكتب والمحامين ({users.length})
        </button>
        
        {currentUser.role === 'admin' && (
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${activeTab === 'logs' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <ClipboardList className="w-4 h-4" />
            سجل الرقابة والعمليات (Audit Log)
          </button>
        )}
      </div>

      {/* VIEW: STAFF */}
      {activeTab === 'staff' && (
        <div className="space-y-6">
          
          {/* Controls */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-3xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative flex-1 w-full">
              <span className="absolute right-3 top-3 text-slate-400">
                <Search className="w-5 h-5" />
              </span>
              <input
                type="text"
                placeholder="البحث بالاسم، المسمى الوظيفي، الرقم القومي أو الهاتف..."
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                className="w-full pl-4 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-slate-400"
              />
            </div>

            {currentUser.permissions.manageUsers && (
              <button
                onClick={() => {
                  setFullName('');
                  setPhone('');
                  setNationalId('');
                  setEmail('');
                  setRole('lawyer');
                  setTitleOption('محامٍ');
                  setCustomTitle('');
                  setHireDate(new Date().toISOString().split('T')[0]);
                  setStatus('active');
                  setAvatarUrl('');
                  setNotes('');
                  setShowAddUserModal(true);
                }}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs py-2 px-4 rounded-xl transition-colors flex items-center gap-1"
              >
                <PlusCircle className="w-5 h-5" />
                إضافة مستخدم جديد (محامٍ / موظف)
              </button>
            )}
          </div>

          {/* Users Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredUsers.map((u) => {
              const isActive = u.status === 'active';
              const isSuspended = u.status === 'suspended';
              const isTerminated = u.status === 'terminated';
              
              return (
                <div key={u.id} className={`bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-amber-400/50 transition-all ${isSuspended ? 'opacity-70 bg-slate-50/50' : ''} ${isTerminated ? 'opacity-50 bg-slate-100/50' : ''}`}>
                  
                  <div className="space-y-4">
                    {/* Badge and Hire Date Header */}
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        isActive ? 'bg-emerald-100 text-emerald-800' :
                        isSuspended ? 'bg-red-100 text-red-800' :
                        'bg-slate-200 text-slate-700'
                      }`}>
                        {isActive ? 'نشط بالخدمة' : isSuspended ? 'موقوف مؤقتاً' : 'منتهي الخدمة'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        التعيين: {u.hireDate}
                      </span>
                    </div>

                    {/* Avatar & Name Header block */}
                    <div className="flex items-center gap-3">
                      {u.avatarUrl ? (
                        <img 
                          src={u.avatarUrl} 
                          alt={u.fullName} 
                          className="w-12 h-12 rounded-full object-cover border-2 border-amber-500 shadow-3xs shrink-0" 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-50 to-amber-200 text-amber-950 flex items-center justify-center font-bold text-xs border border-amber-300 shadow-3xs shrink-0 select-none">
                          {u.fullName.split(' ').slice(0, 2).map(n => n[0]).join('')}
                        </div>
                      )}
                      
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-800 text-xs truncate" title={u.fullName}>{u.fullName}</h4>
                        <p className="text-[11px] text-amber-700 font-semibold mt-0.5 flex items-center gap-0.5">
                          <Briefcase className="w-3 h-3 shrink-0" />
                          {u.title}
                        </p>
                      </div>
                    </div>

                    {/* Contact & Personal details */}
                    <div className="bg-slate-50 p-3 rounded-xl space-y-2 text-xs text-slate-600 border border-slate-100">
                      <p className="flex items-center gap-1.5 font-mono">
                        <span className="text-slate-400">📞</span>
                        <span className="font-bold">{u.phone}</span>
                      </p>
                      <p className="flex items-center gap-1.5 font-mono truncate" title={u.email || 'لم يسجل بريد إلكتروني'}>
                        <span className="text-slate-400">✉️</span>
                        <span>{u.email || <span className="text-slate-400 italic">بدون بريد</span>}</span>
                      </p>
                      <p className="flex items-center gap-1.5 font-mono">
                        <span className="text-slate-400">💳</span>
                        <span>{u.nationalId ? `الرقم القومي: ${u.nationalId}` : <span className="text-slate-400 italic">بدون رقم قومي</span>}</span>
                      </p>
                    </div>

                    {/* Notes if any */}
                    {u.notes && (
                      <p className="text-[11px] text-slate-500 bg-amber-50/40 p-2 rounded-lg border border-amber-100/50 leading-relaxed">
                        <span className="font-semibold text-amber-800">ملاحظات:</span> {u.notes}
                      </p>
                    )}
                  </div>

                  {/* Actions & Permissions */}
                  <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => setSelectedUserForPerms(u)}
                        className="bg-amber-50 hover:bg-amber-100/80 text-amber-950 text-xs px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 flex-1 justify-center transition-colors"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        الصلاحيات التفصيلية
                      </button>

                      {currentUser.permissions.manageUsers && (
                        <button
                          onClick={() => handleOpenEditModal(u)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 flex-1 justify-center transition-colors"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          تعديل البيانات
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between px-1 pt-1 border-t border-slate-100 mt-2 pt-2">
                      {currentUser.permissions.manageUsers && u.id !== 'user-admin' ? (
                        <div className="flex items-center justify-between w-full gap-2 flex-wrap">
                          <button
                            onClick={() => {
                              onResetPassword(u.id);
                              alert(`تم إعادة تعيين كلمة مرور الزميل [${u.fullName}] بنجاح إلى رقم هاتفه للتأمين.`);
                            }}
                            className="text-[10px] text-blue-600 hover:underline font-bold flex items-center gap-0.5"
                            title="إعادة تعيين كلمة المرور لرقم الهاتف تلقائياً"
                          >
                            <Key className="w-3 h-3" />
                            إعادة ضبط كلمة السر
                          </button>
                          
                          <button
                            onClick={() => handleToggleUserStatus(u)}
                            className={`text-[10px] font-bold flex items-center gap-0.5 ${isSuspended ? 'text-emerald-600 hover:underline' : 'text-slate-500 hover:underline'}`}
                          >
                            {isSuspended ? (
                              <>
                                <UserCheck className="w-3 h-3" />
                                تفعيل
                              </>
                            ) : (
                              <>
                                <UserX className="w-3 h-3" />
                                تجميد
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => {
                              setDeleteUserTarget(u);
                              setDeleteUserPassword('');
                              setDeleteUserError('');
                            }}
                            className="text-[10px] text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-1 rounded-md font-bold flex items-center gap-0.5 transition-all shadow-xs"
                            title="حذف نهائي فوري لحساب المستخدم"
                          >
                            <Trash className="w-3 h-3 text-red-600" />
                            حذف نهائي
                          </button>
                        </div>
                      ) : (
                        u.id === 'user-admin' && (
                          <span className="text-[10px] text-amber-600 font-bold flex items-center gap-0.5 mx-auto">
                            <Shield className="w-3 h-3" />
                            حساب مدير النظام الرئيسي
                          </span>
                        )
                      )}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* VIEW: AUDIT LOGS */}
      {activeTab === 'logs' && currentUser.role === 'admin' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <ClipboardList className="w-5 h-5 text-amber-500" />
              سجل الأمن والعمليات القضائية التلقائي (Audit Trail)
            </h3>
            
            <div className="relative w-64">
              <span className="absolute right-2 top-2.5 text-slate-400">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                placeholder="تصفية السجل بالعمليات..."
                value={logQuery}
                onChange={(e) => setLogQuery(e.target.value)}
                className="w-full pl-3 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-3 max-h-[450px] overflow-y-auto">
            {filteredLogs.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-8">لا توجد عمليات مسجلة متطابقة.</p>
            ) : (
              filteredLogs.map((log) => (
                <div key={log.id} className="p-3 bg-slate-50/70 rounded-lg border border-slate-200/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase font-mono ${log.actionType === 'delete' ? 'bg-red-100 text-red-800' : log.actionType === 'login' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                        {log.actionType}
                      </span>
                      <strong className="text-slate-800">{log.fullName} ({log.username})</strong>
                    </div>
                    <p className="text-slate-600 font-medium">{log.details}</p>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                      <Monitor className="w-3 h-3" />
                      الجهاز المستخدم: {log.deviceInfo}
                    </p>
                  </div>

                  <span className="text-[10px] font-mono text-slate-400 shrink-0">
                    {new Date(log.timestamp).toLocaleString('ar-EG')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL: ADD USER */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto text-right" dir="rtl">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <PlusCircle className="w-5 h-5 text-amber-500" />
                تعيين زميل جديد وإضافته لطاقم العمل بالمؤسسة
              </h3>
              <button onClick={() => setShowAddUserModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddUserSubmit} className="space-y-4">
              {/* Photo Upload Area */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">الصورة الشخصية للمحامي / الموظف</label>
                <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-dashed border-slate-300">
                  <div className="relative shrink-0">
                    {avatarUrl ? (
                      <img 
                        src={avatarUrl} 
                        alt="Profile Preview" 
                        className="w-16 h-16 rounded-full object-cover border-2 border-amber-500 shadow-3xs" 
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center border border-slate-300">
                        <Camera className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-[10px] text-slate-500">اختر صورة واضحة بصيغة PNG أو JPG (الحد الأقصى 2 ميجابايت)</p>
                    <div className="flex gap-2">
                      <label className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-[11px] font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors inline-block">
                        رفع صورة شخصية
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => handleImageFileChange(e.target.files?.[0], setAvatarUrl)} 
                        />
                      </label>
                      {avatarUrl && (
                        <button 
                          type="button" 
                          onClick={() => setAvatarUrl('')} 
                          className="text-[11px] text-red-600 hover:underline font-bold"
                        >
                          إزالة الصورة
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Grid for Name and National ID */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">الاسم بالكامل للزميل <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="الاسم ثلاثي أو رباعي"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">الرقم القومي (14 رقم - اختياري)</label>
                  <input
                    type="text"
                    maxLength={14}
                    placeholder="29012345678901"
                    value={nationalId}
                    onChange={(e) => setNationalId(cleanDigits(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Grid for Phone and Email */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">رقم الهاتف للتواصل <span className="text-red-500">*</span></label>
                  <input
                    type="tel"
                    required
                    placeholder="01xxxxxxxxx"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-left"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">البريد الإلكتروني (اختياري)</label>
                  <input
                    type="email"
                    placeholder="name@romeih-law.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Grid for Username and Password */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">اسم المستخدم للدخول <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="اسم مستخدم فريد (مثال: ali_lawyer)"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-left"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">كلمة المرور للدخول <span className="text-red-500">*</span></label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Job Titles Dropdown and Custom title input */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">المسمى الوظيفي الرئيسي <span className="text-red-500">*</span></label>
                  <select
                    value={titleOption}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTitleOption(val);
                      if (val === 'مدير') setRole('admin');
                      else if (val === 'محامٍ' || val === 'محامٍ تحت التمرين') setRole('lawyer');
                      else if (val === 'سكرتير') setRole('secretary');
                      else setRole('employee');
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="محامٍ">محامٍ</option>
                    <option value="محامٍ تحت التمرين">محامٍ تحت التمرين</option>
                    <option value="سكرتير">سكرتير</option>
                    <option value="إداري">إداري</option>
                    <option value="محاسب">محاسب</option>
                    <option value="مدير">مدير</option>
                    <option value="other">أخرى (مسمى مخصص...)</option>
                  </select>
                </div>

                {titleOption === 'other' ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">المسمى الوظيفي المخصص <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: مستشار قانوني، شريك رئيسي"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">مستوى الصلاحية البدئي بالنظام</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                    >
                      <option value="lawyer">محامي (جدول رصد ومتابعة القضايا)</option>
                      <option value="admin">مدير (صلاحيات كاملة للمؤسسة)</option>
                      <option value="secretary">سكرتير (رول الجلسات والأتعاب)</option>
                      <option value="employee">موظف (عرض وقراءة فقط للأرشيف)</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Grid for Appointment Date and Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">تاريخ التعيين والالتحاق بالمكتب</label>
                  <input
                    type="date"
                    required
                    value={hireDate}
                    onChange={(e) => setHireDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-left"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">حالة الحساب المبدئية</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="active">نشط بالخدمة</option>
                    <option value="suspended">موقوف مؤقتاً</option>
                    <option value="terminated">منتهي الخدمة</option>
                  </select>
                </div>
              </div>

              {/* Notes Area */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ملاحظات مهنية / تفاصيل إضافية</label>
                <textarea
                  placeholder="سجل أي ملاحظات خاصة بملف الزميل هنا..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs h-20 resize-none"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-lg text-[10px] text-amber-800 leading-relaxed border border-amber-100">
                ℹ️ <strong>ملاحظة أمان:</strong> سيتم فرض تغيير كلمة المرور للمستخدم عند أول عملية دخول ناجحة للتأمين، وستكون كلمة المرور المبدئية هي نفس رقم الهاتف المسجل أعلاه.
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-4 py-2 rounded-lg font-semibold"
                >
                  إلغاء التعيين
                </button>
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs px-4 py-2 rounded-lg"
                >
                  إضافة للمكتب وتفعيل
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT USER (تعديل بيانات المحامي) */}
      {selectedUserForEdit && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto text-right" dir="rtl">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Edit className="w-5 h-5 text-blue-500" />
                تعديل ملف وبيانات الزميل: {selectedUserForEdit.fullName}
              </h3>
              <button onClick={() => setSelectedUserForEdit(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleEditUserSubmit} className="space-y-4">
              {/* Photo Upload Area */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">الصورة الشخصية للمحامي / الموظف</label>
                <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-dashed border-slate-300">
                  <div className="relative shrink-0">
                    {editAvatarUrl ? (
                      <img 
                        src={editAvatarUrl} 
                        alt="Profile Preview" 
                        className="w-16 h-16 rounded-full object-cover border-2 border-amber-500 shadow-3xs" 
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center border border-slate-300">
                        <Camera className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-[10px] text-slate-500">اختر صورة واضحة بصيغة PNG أو JPG (الحد الأقصى 2 ميجابايت)</p>
                    <div className="flex gap-2">
                      <label className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-[11px] font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors inline-block">
                        رفع صورة شخصية جديدة
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => handleImageFileChange(e.target.files?.[0], setEditAvatarUrl)} 
                        />
                      </label>
                      {editAvatarUrl && (
                        <button 
                          type="button" 
                          onClick={() => setEditAvatarUrl('')} 
                          className="text-[11px] text-red-600 hover:underline font-bold"
                        >
                          إزالة الصورة
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Grid for Name and National ID */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">الاسم بالكامل للزميل <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="الاسم ثلاثي أو رباعي"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">الرقم القومي (14 رقم - اختياري)</label>
                  <input
                    type="text"
                    maxLength={14}
                    placeholder="29012345678901"
                    value={editNationalId}
                    onChange={(e) => setEditNationalId(cleanDigits(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Grid for Phone and Email */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">رقم الهاتف للتواصل <span className="text-red-500">*</span></label>
                  <input
                    type="tel"
                    required
                    placeholder="01xxxxxxxxx"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-left"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">البريد الإلكتروني (اختياري)</label>
                  <input
                    type="email"
                    placeholder="name@romeih-law.com"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Grid for Username and Password */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">اسم المستخدم للدخول <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="اسم مستخدم فريد (مثال: ali_lawyer)"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-left"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">كلمة المرور للدخول <span className="text-red-500">*</span></label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Job Titles Dropdown and Custom title input */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">المسمى الوظيفي الرئيسي <span className="text-red-500">*</span></label>
                  <select
                    value={editTitleOption}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditTitleOption(val);
                      if (val === 'مدير') setEditRole('admin');
                      else if (val === 'محامٍ' || val === 'محامٍ تحت التمرين') setEditRole('lawyer');
                      else if (val === 'سكرتير') setEditRole('secretary');
                      else setEditRole('employee');
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="محامٍ">محامٍ</option>
                    <option value="محامٍ تحت التمرين">محامٍ تحت التمرين</option>
                    <option value="سكرتير">سكرتير</option>
                    <option value="إداري">إداري</option>
                    <option value="محاسب">محاسب</option>
                    <option value="مدير">مدير</option>
                    <option value="other">أخرى (مسمى مخصص...)</option>
                  </select>
                </div>

                {editTitleOption === 'other' ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">المسمى الوظيفي المخصص <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: مستشار قانوني، شريك رئيسي"
                      value={editCustomTitle}
                      onChange={(e) => setEditCustomTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">مستوى الصلاحية بالنظام</label>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as UserRole)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                    >
                      <option value="lawyer">محامي (جدول رصد ومتابعة القضايا)</option>
                      <option value="admin">مدير (صلاحيات كاملة للمؤسسة)</option>
                      <option value="secretary">سكرتير (رول الجلسات والأتعاب)</option>
                      <option value="employee">موظف (عرض وقراءة فقط للأرشيف)</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Grid for Appointment Date and Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">تاريخ التعيين والالتحاق بالمكتب</label>
                  <input
                    type="date"
                    required
                    value={editHireDate}
                    onChange={(e) => setEditHireDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-left"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">حالة الحساب الحالية</label>
                  <select
                    disabled={selectedUserForEdit.id === 'user-admin'}
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs disabled:opacity-65"
                  >
                    <option value="active">نشط بالخدمة</option>
                    <option value="suspended">موقوف مؤقتاً</option>
                    <option value="terminated">منتهي الخدمة</option>
                  </select>
                </div>
              </div>

              {/* Notes Area */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ملاحظات مهنية / تفاصيل إضافية</label>
                <textarea
                  placeholder="سجل أي ملاحظات خاصة بملف الزميل هنا..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs h-20 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setSelectedUserForEdit(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-4 py-2 rounded-lg font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-lg font-bold"
                >
                  حفظ وتحديث الملف
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL: DETAIL PERMISSIONS WITH CHECKBOXES */}
      {selectedUserForPerms && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 text-right" dir="rtl">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-6xl p-6 max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1">
                  <ShieldCheck className="w-5 h-5 text-amber-500" />
                  مصفوفة التحكم في صلاحيات النظام للزميل: {selectedUserForPerms.fullName}
                </h3>
                <p className="text-xs text-slate-500">{selectedUserForPerms.title} ({selectedUserForPerms.role})</p>
              </div>
              <button onClick={() => setSelectedUserForPerms(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              
              {/* Checkboxes layout grouped in a 3-column elegant grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* Group 1: Cases */}
                <div className="space-y-2.5 bg-slate-50/50 p-3 rounded-xl border border-slate-200/60">
                  <h4 className="text-xs font-black text-amber-800 bg-amber-50 border border-amber-200/50 p-2 rounded-lg flex items-center gap-1.5">📁 صلاحيات إدارة القضايا والنزاعات</h4>
                  
                  <div className="space-y-2 px-1 pt-1">
                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.viewCases}
                        onChange={() => handlePermissionToggle('viewCases')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>عرض القضايا ورول رصد الجلسات</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.addCase}
                        onChange={() => handlePermissionToggle('addCase')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>إضافة قضية جديدة للجدول</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.editCase}
                        onChange={() => handlePermissionToggle('editCase')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>تعديل بيانات وملفات القضايا النشطة</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-red-600 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.deleteCase}
                        onChange={() => handlePermissionToggle('deleteCase')}
                        className="rounded border-slate-300 text-red-500 focus:ring-red-500 mt-0.5"
                      />
                      <span>حذف القضايا نهائياً من النظام ⚠️</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.archiveCase}
                        onChange={() => handlePermissionToggle('archiveCase')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>أرشفة وترحيل القضايا المنتهية</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.restoreCase}
                        onChange={() => handlePermissionToggle('restoreCase')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>استعادة القضايا المؤرشفة للجدول</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.printCase}
                        onChange={() => handlePermissionToggle('printCase')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>اطلاع على بروفايل القضية وطباعته</span>
                    </label>
                  </div>
                </div>

                {/* Group 2: Sessions */}
                <div className="space-y-2.5 bg-slate-50/50 p-3 rounded-xl border border-slate-200/60">
                  <h4 className="text-xs font-black text-amber-800 bg-amber-50 border border-amber-200/50 p-2 rounded-lg flex items-center gap-1.5">📅 أجندة وجلسات المحاكم</h4>
                  
                  <div className="space-y-2 px-1 pt-1">
                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.addSession}
                        onChange={() => handlePermissionToggle('addSession')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>إضافة وتسجيل جلسة جديدة بالأجندة</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.editSession}
                        onChange={() => handlePermissionToggle('editSession')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>تعديل مواعيد وتفاصيل الجلسات المقيدة</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-red-600 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.deleteSession}
                        onChange={() => handlePermissionToggle('deleteSession')}
                        className="rounded border-slate-300 text-red-500 focus:ring-red-500 mt-0.5"
                      />
                      <span>حذف جلسة دفاع من الأجندة نهائياً ⚠️</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-amber-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.recordSessionDecision}
                        onChange={() => handlePermissionToggle('recordSessionDecision')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>تسجيل ورصد قرارات الجلسات بالأجندة</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-amber-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.editSessionDecision}
                        onChange={() => handlePermissionToggle('editSessionDecision')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>تعديل قرارات ومخرجات الجلسات المرصودة</span>
                    </label>
                  </div>
                </div>

                {/* Group 3: Clients */}
                <div className="space-y-2.5 bg-slate-50/50 p-3 rounded-xl border border-slate-200/60">
                  <h4 className="text-xs font-black text-amber-800 bg-amber-50 border border-amber-200/50 p-2 rounded-lg flex items-center gap-1.5">👥 سجل الموكلين الأفراد</h4>
                  
                  <div className="space-y-2 px-1 pt-1">
                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.viewClients}
                        onChange={() => handlePermissionToggle('viewClients')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>عرض وتصفح ملفات الموكلين الأفراد</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.addClient}
                        onChange={() => handlePermissionToggle('addClient')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>إضافة موكل فرد جديد لقاعدة البيانات</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.editClient}
                        onChange={() => handlePermissionToggle('editClient')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>تعديل بروفايل وبيانات الموكلين الأفراد</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-red-600 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.deleteClient}
                        onChange={() => handlePermissionToggle('deleteClient')}
                        className="rounded border-slate-300 text-red-500 focus:ring-red-500 mt-0.5"
                      />
                      <span>حذف موكل فردي نهائياً من السجلات ⚠️</span>
                    </label>
                  </div>
                </div>

                {/* Group 4: Companies */}
                <div className="space-y-2.5 bg-slate-50/50 p-3 rounded-xl border border-slate-200/60">
                  <h4 className="text-xs font-black text-amber-800 bg-amber-50 border border-amber-200/50 p-2 rounded-lg flex items-center gap-1.5">🏢 سجل الشركات وعقود التأسيس</h4>
                  
                  <div className="space-y-2 px-1 pt-1">
                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.viewCompanies}
                        onChange={() => handlePermissionToggle('viewCompanies')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>عرض ملفات وسجلات الشركات الشريكة</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.addCompany}
                        onChange={() => handlePermissionToggle('addCompany')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>تأسيس وإضافة شركة جديدة للدفاتر</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.editCompany}
                        onChange={() => handlePermissionToggle('editCompany')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>تعديل بروفايل ومستندات وسجلات الشركات</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-red-600 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.deleteCompany}
                        onChange={() => handlePermissionToggle('deleteCompany')}
                        className="rounded border-slate-300 text-red-500 focus:ring-red-500 mt-0.5"
                      />
                      <span>حذف شركة نهائياً من السجلات ⚠️</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.archiveCompany}
                        onChange={() => handlePermissionToggle('archiveCompany')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>أرشفة وترحيل سجلات الشركات للتصفية</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.restoreCompany}
                        onChange={() => handlePermissionToggle('restoreCompany')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>إلغاء أرشفة واستعادة الشركات النشطة</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.printCompany}
                        onChange={() => handlePermissionToggle('printCompany')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>طباعة وتصدير مستندات وملفات الشركة</span>
                    </label>
                  </div>
                </div>

                {/* Group 5: Tasks */}
                <div className="space-y-2.5 bg-slate-50/50 p-3 rounded-xl border border-slate-200/60">
                  <h4 className="text-xs font-black text-amber-800 bg-amber-50 border border-amber-200/50 p-2 rounded-lg flex items-center gap-1.5">🎯 صلاحيات قسم المهام والتكاليف</h4>
                  
                  <div className="space-y-2 px-1 pt-1">
                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.viewTasks}
                        onChange={() => handlePermissionToggle('viewTasks')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>عرض وتصفح قسم المهام والتكاليف اليومية</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.addTask}
                        onChange={() => handlePermissionToggle('addTask')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>تكليف وإنشاء مهمة عمل قانونية جديدة</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.editTask}
                        onChange={() => handlePermissionToggle('editTask')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>تعديل بيانات وتواريخ المهام القائمة</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-red-600 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.deleteTask}
                        onChange={() => handlePermissionToggle('deleteTask')}
                        className="rounded border-slate-300 text-red-500 focus:ring-red-500 mt-0.5"
                      />
                      <span>حذف المهام كلياً ونهائياً من النظام ⚠️</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.assignTask}
                        onChange={() => handlePermissionToggle('assignTask')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>إسناد وتكليف المهام لأعضاء طاقم العمل</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.reassignTask}
                        onChange={() => handlePermissionToggle('reassignTask')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>إعادة إسناد المهام لمسؤول تنفيذ آخر</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.changeTaskStatus}
                        onChange={() => handlePermissionToggle('changeTaskStatus')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>تحديث حالة المهمة ومستوى التقدم الفعلي</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.sendTaskWhatsapp}
                        onChange={() => handlePermissionToggle('sendTaskWhatsapp')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>إرسال إشعارات وتفاصيل المهام عبر WhatsApp</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.viewAllTasks}
                        onChange={() => handlePermissionToggle('viewAllTasks')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>عرض كافة المهام لكل طاقم العمل (شاملة)</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.viewOwnTasksOnly}
                        onChange={() => handlePermissionToggle('viewOwnTasksOnly')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>حصر عرض المهام على المهام الخاصة بالمحامي فقط</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.approveTaskCompletion}
                        onChange={() => handlePermissionToggle('approveTaskCompletion')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>اعتماد واغلاق المهام المكتملة من المدير</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.reopenTask}
                        onChange={() => handlePermissionToggle('reopenTask')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>إعادة فتح المهمة بعد إنجازها للمراجعة والتعديل</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.manageTasks}
                        onChange={() => handlePermissionToggle('manageTasks')}
                        className="rounded text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>إدارة وتوجيه وتصنيف كل المهام العامة</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.viewUserTaskTracking}
                        onChange={() => handlePermissionToggle('viewUserTaskTracking')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>متابعة المستخدم للمهام المسندة لنفسه</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.viewTaskExecutionTracking}
                        onChange={() => handlePermissionToggle('viewTaskExecutionTracking')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>متابعة وتقييم الأداء العام في تنفيذ كل المهام</span>
                    </label>
                  </div>
                </div>

                {/* Group 6: Finance & Receipts */}
                <div className="space-y-2.5 bg-slate-50/50 p-3 rounded-xl border border-slate-200/60">
                  <h4 className="text-xs font-black text-amber-800 bg-amber-50 border border-amber-200/50 p-2 rounded-lg flex items-center gap-1.5">💰 حسابات الأتعاب المالية وعقود الموكلين</h4>
                  
                  <div className="space-y-2 px-1 pt-1">
                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.viewFees}
                        onChange={() => handlePermissionToggle('viewFees')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>عرض كشوف الأتعاب والمدفوع والمتبقي من المبالغ</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.addReceipt}
                        onChange={() => handlePermissionToggle('addReceipt')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>تحرير وسند الأرصدة وإيصالات السداد والقبض</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.editFees}
                        onChange={() => handlePermissionToggle('editFees')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>تعديل قيم الأتعاب المتفق عليها والاتفاقيات بالدفاتر</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-red-600 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.deleteFees}
                        onChange={() => handlePermissionToggle('deleteFees')}
                        className="rounded border-slate-300 text-red-500 focus:ring-red-500 mt-0.5"
                      />
                      <span>حذف أو تعديل إيصالات القبض الصادرة ⚠️</span>
                    </label>
                  </div>
                </div>

                {/* Group 7: Documents */}
                <div className="space-y-2.5 bg-slate-50/50 p-3 rounded-xl border border-slate-200/60">
                  <h4 className="text-xs font-black text-amber-800 bg-amber-50 border border-amber-200/50 p-2 rounded-lg flex items-center gap-1.5">📄 إدارة المستندات والوثائق</h4>
                  
                  <div className="space-y-2 px-1 pt-1">
                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.uploadDoc}
                        onChange={() => handlePermissionToggle('uploadDoc')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>رفع وحفظ ملفات ومستندات جديدة بالخادم</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.downloadDoc}
                        onChange={() => handlePermissionToggle('downloadDoc')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>تنزيل واستعراض مستندات الموكلين والقضايا</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-red-600 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.deleteDoc}
                        onChange={() => handlePermissionToggle('deleteDoc')}
                        className="rounded border-slate-300 text-red-500 focus:ring-red-500 mt-0.5"
                      />
                      <span>حذف مستند أو وثيقة مرفوعة نهائياً ⚠️</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.printDoc}
                        onChange={() => handlePermissionToggle('printDoc')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>طباعة وتصدير الوثائق والمستندات المرفقة</span>
                    </label>
                  </div>
                </div>

                {/* Group 8: Reports */}
                <div className="space-y-2.5 bg-slate-50/50 p-3 rounded-xl border border-slate-200/60">
                  <h4 className="text-xs font-black text-amber-800 bg-amber-50 border border-amber-200/50 p-2 rounded-lg flex items-center gap-1.5">📈 التقارير والتصدير الذكي</h4>
                  
                  <div className="space-y-2 px-1 pt-1">
                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.viewReports}
                        onChange={() => handlePermissionToggle('viewReports')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>عرض تقارير الأداء والموقف الإداري والمالي للمكتب</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.printReports}
                        onChange={() => handlePermissionToggle('printReports')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>طباعة تقارير الموقف القضائي والمالي للمكتب</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.exportPdf}
                        onChange={() => handlePermissionToggle('exportPdf')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>تصدير البيانات والتقارير بصيغة PDF للطباعة</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.exportExcel}
                        onChange={() => handlePermissionToggle('exportExcel')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>تصدير الجداول والبيانات والتقارير بصيغة Excel</span>
                    </label>
                  </div>
                </div>

                {/* Group 9: System & Staff */}
                <div className="space-y-2.5 bg-slate-50/50 p-3 rounded-xl border border-slate-200/60">
                  <h4 className="text-xs font-black text-amber-800 bg-amber-50 border border-amber-200/50 p-2 rounded-lg flex items-center gap-1.5">🛡️ حوكمة الحسابات وأعضاء طاقم العمل</h4>
                  
                  <div className="space-y-2 px-1 pt-1">
                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.manageUsers}
                        onChange={() => handlePermissionToggle('manageUsers')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>إدارة بيانات طاقم العمل وتعديل الصلاحيات بالكامل</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-slate-700 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!selectedUserForPerms.permissions.manageSettings}
                        onChange={() => handlePermissionToggle('manageSettings')}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 mt-0.5"
                      />
                      <span>إدارة إعدادات النظام وتعديل قوالب وتصدير الأرشفة</span>
                    </label>

                    <label className="flex items-start gap-2 text-[11px] text-red-600 font-black select-none cursor-default">
                      <input
                        type="checkbox"
                        checked={selectedUserForPerms.role === 'admin'}
                        disabled
                        className="rounded text-red-500 focus:ring-red-500 mt-0.5 disabled:opacity-75"
                      />
                      <span>رتبة مدير النظام الشامل (Super Admin)</span>
                    </label>
                  </div>
                </div>

              </div>

              {selectedUserForPerms.id === 'user-admin' && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed">
                  ⚠️ <strong>تنبيه الأمان الرئيسي:</strong> هذا الحساب يمثل مدير النظام العام الرئيسي للمؤسسة. كافة الصلاحيات مفعلة لديه بصورة تلقائية ولا يمكن حظرها لضمان عدم حدوث إغلاق مفاجئ للنظام.
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  onClick={() => setSelectedUserForPerms(null)}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs px-5 py-2 rounded-lg font-bold"
                >
                  تأكيد وحفظ الصلاحيات
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* MODAL: DELETE USER CONFIRMATION WITH PASSWORD */}
      {deleteUserTarget && (
        <div className="fixed inset-0 bg-black/65 z-50 flex items-center justify-center p-4 text-right animate-fadeIn" dir="rtl">
          <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">تأكيد الحذف النهائي للمستخدم</h3>
                <p className="text-[11px] text-slate-400">إجراء أمني صارم لحماية بيانات الموظفين والمحامين</p>
              </div>
            </div>

            <div className="bg-red-50/50 border border-red-100/80 rounded-xl p-3 space-y-1.5 text-xs">
              <p className="text-red-800 font-bold leading-relaxed">
                ⚠️ تحذير: أنت على وشك حذف حساب الزميل <span className="underline">{deleteUserTarget.fullName}</span> ({deleteUserTarget.title}) نهائياً من قاعدة البيانات.
              </p>
              <p className="text-slate-500 text-[11px]">
                سيتم إلغاء صلاحية دخوله بالكامل وشطب بياناته، ولن يكون بإمكانه استخدام رقم الهاتف كاسم مستخدم مجدداً إلا بعد إعادة تعيينه.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 block">يرجى كتابة كلمة مرور الدخول الخاصة بك للتأكيد:</label>
              <input
                type="password"
                value={deleteUserPassword}
                onChange={(e) => setDeleteUserPassword(e.target.value)}
                placeholder="أدخل كلمة السر الخاصة بك هنا..."
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-1 focus:ring-red-400 focus:outline-none font-mono"
              />
              {deleteUserError && (
                <p className="text-[11px] text-red-600 font-medium">{deleteUserError}</p>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => {
                  setDeleteUserTarget(null);
                  setDeleteUserPassword('');
                  setDeleteUserError('');
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-4 py-2 rounded-xl font-bold transition-colors"
              >
                إلغاء الأمر
              </button>
              <button
                onClick={handleDeleteUserSubmit}
                className="bg-red-500 hover:bg-red-600 text-white text-xs px-5 py-2 rounded-xl font-bold shadow-md shadow-red-500/10 transition-colors"
              >
                تأكيد الحذف نهائياً
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
