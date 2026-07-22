/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import { 
  User, Client, Company, Case, LegalTask, TaskType, TaskPriority, TaskStatus, TaskAttachment, TaskFollowUp 
} from '../types';
import { 
  ClipboardList, Briefcase, Eye, Search, Plus, Filter, RefreshCw, 
  Trash2, Edit, Calendar, Clock, AlertCircle, FileText, 
  X, PlusCircle, Paperclip, CheckCircle, Upload, Download,
  User as UserIcon, Building2, ChevronDown, Check, History,
  Bold, Italic, List, Users, Scale
} from 'lucide-react';
import { 
  BaseModal, FormCard, FormGrid, FormField, 
  PrimaryButton, SecondaryButton, DangerButton 
} from './FormComponents';
import { saveFileToIndexedDB, getFileFromIndexedDB, uploadToR2 } from '../utils/fileStorage';
import MultiUploadManager from './MultiUploadManager';

interface TasksPanelProps {
  tasks: LegalTask[];
  setTasks: React.Dispatch<React.SetStateAction<LegalTask[]>>;
  users: User[];
  clients: Client[];
  companies: Company[];
  cases: Case[];
  currentUser: User;
  onAddAuditLog: (user: User, actionType: 'add' | 'edit' | 'delete' | 'archive' | 'restore' | 'login', details: string) => void;
}

export default function TasksPanel({
  tasks,
  setTasks,
  users,
  clients,
  companies,
  cases,
  currentUser,
  onAddAuditLog
}: TasksPanelProps) {
  const canManageTasks = currentUser.role === 'admin' || !!currentUser.permissions.manageTasks;
  const canViewUserTaskTracking = currentUser.role === 'admin' || !!currentUser.permissions.viewUserTaskTracking;
  const canViewTaskExecutionTracking = currentUser.role === 'admin' || !!currentUser.permissions.viewTaskExecutionTracking;

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'manage' | 'user' | 'execute'>(() => {
    if (currentUser.role === 'admin' || currentUser.permissions.manageTasks) return 'manage';
    if (currentUser.permissions.viewUserTaskTracking) return 'user';
    if (currentUser.permissions.viewTaskExecutionTracking) return 'execute';
    return 'user';
  });

  // Search and filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  
  const [viewingTask, setViewingTask] = useState<LegalTask | null>(null);
  const [editingTask, setEditingTask] = useState<LegalTask | null>(null);

  // User Tab States
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userFilterPriority, setUserFilterPriority] = useState<string>('all');
  const [userFilterStatus, setUserFilterStatus] = useState<string>('all');
  const [isUserTaskModalOpen, setIsUserTaskModalOpen] = useState(false);
  const [userViewingTask, setUserViewingTask] = useState<LegalTask | null>(null);
  const [userTaskStatus, setUserTaskStatus] = useState<TaskStatus>('جديدة');
  const [userTaskNotes, setUserTaskNotes] = useState('');
  const [userTaskDate, setUserTaskDate] = useState('');
  const [userTaskTime, setUserTaskTime] = useState('');
  const [userTaskProgress, setUserTaskProgress] = useState<number>(0);

  // New specific states for the redesigned user task update and attachments modal
  const [userExistingAttachments, setUserExistingAttachments] = useState<TaskAttachment[]>([]);
  const [userNewAttachmentsList, setUserNewAttachmentsList] = useState<TaskAttachment[]>([]);
  const [userStagedFile, setUserStagedFile] = useState<{
    file: File;
    size: string;
    originalName: string;
    type: 'PDF' | 'Word' | 'صورة' | 'ملف صوتي' | 'فيديو';
  } | null>(null);
  const [userAttachmentName, setUserAttachmentName] = useState('');
  const [userAttachmentFormat, setUserAttachmentFormat] = useState<'PDF' | 'Word' | 'صورة' | 'ملف صوتي' | 'فيديو'>('PDF');
  const [isUserFileUploading, setIsUserFileUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isSavingUserEdits, setIsSavingUserEdits] = useState(false);
  
  // Toast notifications
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({ show: false, message: '', type: 'success' });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  // Execute Tab States
  const [executeSearchQuery, setExecuteSearchQuery] = useState('');
  const [executeFilterPriority, setExecuteFilterPriority] = useState<string>('all');
  const [executeFilterStatus, setExecuteFilterStatus] = useState<string>('all');
  const [executeFilterUser, setExecuteFilterUser] = useState<string>('all');
  const [isManagerDecisionModalOpen, setIsManagerDecisionModalOpen] = useState(false);
  const [managerDecisionTask, setManagerDecisionTask] = useState<LegalTask | null>(null);
  const [decisionType, setDecisionType] = useState<'قبول' | 'عدم قبول' | 'ملاحظات' | ''>('');
  const [decisionNotes, setDecisionNotes] = useState('');

  // Form states for Create/Edit
  const [title, setTitle] = useState('');
  const [type, setType] = useState<TaskType>('حضور جلسة');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('متوسطة');
  const [executionDate, setExecutionDate] = useState('');
  const [executionTime, setExecutionTime] = useState('');
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);
  const [editStatus, setEditStatus] = useState<TaskStatus>('جديدة');
  
  // Optional links
  const [linkedCaseId, setLinkedCaseId] = useState('');
  const [linkedCompanyId, setLinkedCompanyId] = useState('');
  const [linkedClientId, setLinkedClientId] = useState('');
  const [notes, setNotes] = useState('');

  // Attachment states (staged and list)
  const [taskAttachments, setTaskAttachments] = useState<TaskAttachment[]>([]);
  const [stagedFile, setStagedFile] = useState<{
    file: File;
    size: string;
    originalName: string;
    type: 'PDF' | 'Word' | 'صورة' | 'ملف صوتي' | 'فيديو';
  } | null>(null);
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentFormat, setAttachmentFormat] = useState<'PDF' | 'Word' | 'صورة' | 'ملف صوتي' | 'فيديو'>('PDF');
  const [isFileUploading, setIsFileUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Task types list
  const taskTypesList: TaskType[] = [
    'حضور جلسة',
    'إعداد مذكرة',
    'رفع دعوى',
    'تنفيذ حكم',
    'استخراج مستند',
    'مراجعة عقد',
    'تأسيس شركة',
    'تجديد ترخيص',
    'مقابلة موكل',
    'متابعة تنفيذ',
    'مهمة إدارية',
    'أخرى'
  ];

  // Helper: Reset Form
  const resetForm = () => {
    setTitle('');
    setType('حضور جلسة');
    setDescription('');
    setPriority('متوسطة');
    setExecutionDate(new Date().toISOString().split('T')[0]);
    setExecutionTime('09:00');
    setAssignedUserIds([currentUser.id]); // Default assign to current user
    setEditStatus('جديدة');
    setLinkedCaseId('');
    setLinkedCompanyId('');
    setLinkedClientId('');
    setNotes('');
    setTaskAttachments([]);
    setStagedFile(null);
    setAttachmentName('');
    setAttachmentFormat('PDF');
    setIsFileUploading(false);
  };

  // Helper: Open Create modal
  const handleOpenCreateModal = () => {
    resetForm();
    setIsCreateModalOpen(true);
  };

  // Helper: Generate next TSK sequence number
  const generateTaskNumber = () => {
    const year = new Date().getFullYear();
    const currentYearTasks = tasks.filter(t => t.taskNumber?.startsWith(`TSK-${year}-`));
    let maxNum = 0;
    currentYearTasks.forEach(t => {
      const parts = t.taskNumber.split('-');
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    });
    return `TSK-${year}-${String(maxNum + 1).padStart(4, '0')}`;
  };

  // File Upload Handlers (Device picker & attachment addition)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    let detectedType: 'PDF' | 'Word' | 'صورة' | 'ملف صوتي' | 'فيديو' = 'PDF';
    
    if (fileExtension === 'pdf') {
      detectedType = 'PDF';
    } else if (['doc', 'docx'].includes(fileExtension || '')) {
      detectedType = 'Word';
    } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(fileExtension || '')) {
      detectedType = 'صورة';
    } else if (['mp3', 'wav', 'm4a', 'ogg'].includes(fileExtension || '')) {
      detectedType = 'ملف صوتي';
    } else if (['mp4', 'mov', 'avi', 'mkv'].includes(fileExtension || '')) {
      detectedType = 'فيديو';
    }

    const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
    const originalCleanName = file.name.split('.').slice(0, -1).join('.') || file.name;

    setStagedFile({
      file,
      size: `${sizeInMB} MB`,
      originalName: originalCleanName,
      type: detectedType
    });

    setAttachmentName(originalCleanName);
    setAttachmentFormat(detectedType);
    
    // Clear input so same file can be chosen again
    e.target.value = '';
  };

  const handleAddAttachment = async () => {
    if (!attachmentName.trim()) {
      alert('يرجى إدخال اسم المستند أولاً لإتمام الإرفاق.');
      return;
    }
    if (!stagedFile) {
      alert('يرجى اختيار ملف من الجهاز أولاً.');
      return;
    }

    setIsFileUploading(true);
    try {
      const finalFileId = `file-${Date.now()}`;
      
      // Upload using cloud helper R2 presigned upload
      const downloadURL = await uploadToR2(stagedFile.file);
      
      // Save permanently to IndexedDB backup
      await saveFileToIndexedDB(finalFileId, stagedFile.file);

      const newAttachment: TaskAttachment = {
        id: finalFileId,
        name: attachmentName.trim(),
        type: attachmentFormat,
        uploadDate: new Date().toISOString().split('T')[0],
        uploadedBy: currentUser.fullName,
        fileUrl: downloadURL,
        size: stagedFile.size
      };

      setTaskAttachments(prev => [...prev, newAttachment]);
      
      // Reset staging
      setStagedFile(null);
      setAttachmentName('');
      alert('تم تحميل وإرفاق الملف بنجاح ✅');
    } catch (err: any) {
      console.error("Upload error:", err);
      alert(`فشل تحميل الملف: ${err.message || err}`);
    } finally {
      setIsFileUploading(false);
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setTaskAttachments(prev => prev.filter(att => att.id !== id));
  };

  const handleViewAttachmentFile = async (att: TaskAttachment) => {
    let fileUrl = att.fileUrl;
    // Check if we have this file stored in IndexedDB first
    try {
      const dbBlob = await getFileFromIndexedDB(att.id);
      if (dbBlob) {
        fileUrl = URL.createObjectURL(dbBlob);
      }
    } catch (e) {
      console.warn("IndexedDB fetch failed, using original cloud URL", e);
    }

    // Open in independent dedicated window/tab
    if (att.type === 'PDF') {
      const targetUrl = `/pdf-viewer.html?file=${encodeURIComponent(fileUrl)}&title=${encodeURIComponent(att.name)}&fileId=${att.id}`;
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    } else {
      window.open(fileUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Toggle user/lawyer selection
  const handleToggleUserSelection = (userId: string) => {
    setAssignedUserIds(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Save/Create Task Handler
  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('عنوان المهمة مطلوب وإلزامي.');
      return;
    }

    if (assignedUserIds.length === 0) {
      alert('يرجى إسناد المهمة إلى مستخدم أو محامي واحد على الأقل.');
      return;
    }

    const selectedUsers = users.filter(u => assignedUserIds.includes(u.id));
    const assignedNamesStr = selectedUsers.map(u => u.fullName).join('، ');
    const assignedIdsStr = assignedUserIds.join(', ');

    const linkedCase = cases.find(c => c.id === linkedCaseId);
    const linkedCompany = companies.find(co => co.id === linkedCompanyId);
    const linkedClient = clients.find(cl => cl.id === linkedClientId);

    const generatedNum = generateTaskNumber();
    const nowStr = new Date().toISOString();

    const newTask: LegalTask = {
      id: `task-${Date.now()}`,
      taskNumber: generatedNum,
      title: title.trim(),
      description: description.trim(),
      type,
      priority,
      createdAt: nowStr,
      executionDate: executionDate || new Date().toISOString().split('T')[0],
      executionTime: executionTime || '09:00',
      dueDate: executionDate || new Date().toISOString().split('T')[0],
      assignedToId: assignedIdsStr,
      assignedToName: assignedNamesStr,
      clientId: linkedClientId || undefined,
      clientName: linkedClient ? linkedClient.name : undefined,
      caseId: linkedCaseId || undefined,
      caseNumber: linkedCase ? linkedCase.caseNumberFirstInstance : undefined,
      companyId: linkedCompanyId || undefined,
      companyName: linkedCompany ? linkedCompany.name : undefined,
      notes: notes.trim() || undefined,
      status: editStatus,
      progress: editStatus === 'مكتملة' ? 100 : 0,
      attachments: taskAttachments,
      followUps: [],
      whatsappLogs: []
    };

    setTasks(prev => [newTask, ...prev]);
    onAddAuditLog(currentUser, 'add', `تم إنشاء مهمة جديدة برقم [${generatedNum}] وعنوان "${newTask.title}"`);
    setIsCreateModalOpen(false);
    alert('تم حفظ وإضافة المهمة بنجاح 💾');
  };

  // Open user task modal
  const handleOpenUserTaskModal = (task: LegalTask) => {
    setUserViewingTask(task);
    setUserTaskStatus(task.status);
    setUserTaskNotes(''); // Reset to allow typing new update notes
    setUserTaskDate(task.executionDate || new Date().toISOString().split('T')[0]);
    setUserTaskTime(task.executionTime || '09:00');
    setUserTaskProgress(task.progress || 0);
    
    // Specific attachments state for this modal session
    setUserExistingAttachments(task.attachments || []);
    setUserNewAttachmentsList([]);
    setUserStagedFile(null);
    setUserAttachmentName('');
    setUserAttachmentFormat('PDF');
    setIsUserFileUploading(false);
    setIsDragActive(false);
    
    setIsUserTaskModalOpen(true);
  };

  // Drag and drop attachment handlers for User Task Modal
  const handleUserDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleUserProcessFile = (file: File) => {
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    let detectedType: 'PDF' | 'Word' | 'صورة' | 'ملف صوتي' | 'فيديو' = 'PDF';
    
    if (fileExtension === 'pdf') {
      detectedType = 'PDF';
    } else if (['doc', 'docx'].includes(fileExtension || '')) {
      detectedType = 'Word';
    } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(fileExtension || '')) {
      detectedType = 'صورة';
    } else if (['mp3', 'wav', 'm4a', 'ogg'].includes(fileExtension || '')) {
      detectedType = 'ملف صوتي';
    } else if (['mp4', 'mov', 'avi', 'mkv'].includes(fileExtension || '')) {
      detectedType = 'فيديو';
    }

    const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
    const originalCleanName = file.name.split('.').slice(0, -1).join('.') || file.name;

    setUserStagedFile({
      file,
      size: `${sizeInMB} MB`,
      originalName: originalCleanName,
      type: detectedType
    });

    setUserAttachmentName(originalCleanName);
    setUserAttachmentFormat(detectedType);
  };

  const handleUserDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUserProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleUserFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUserProcessFile(file);
    }
    e.target.value = '';
  };

  const handleAddUserAttachment = async () => {
    if (!userAttachmentName.trim()) {
      alert('يرجى إدخال اسم المستند أولاً لإتمام الإرفاق.');
      return;
    }
    if (!userStagedFile) {
      alert('يرجى اختيار ملف من جهازك أو سحبه وإفلاته أولاً.');
      return;
    }

    setIsUserFileUploading(true);
    try {
      const finalFileId = `file-${Date.now()}`;
      
      // Upload using cloud helper R2 and backup in IndexedDB
      const downloadURL = await uploadToR2(userStagedFile.file);
      await saveFileToIndexedDB(finalFileId, userStagedFile.file);

      const newAttachment: TaskAttachment = {
        id: finalFileId,
        name: userAttachmentName.trim(),
        type: userAttachmentFormat,
        uploadDate: new Date().toISOString().split('T')[0],
        uploadedBy: currentUser.fullName,
        fileUrl: downloadURL,
        size: userStagedFile.size
      };

      setUserNewAttachmentsList(prev => [...prev, newAttachment]);
      
      // Reset staging states
      setUserStagedFile(null);
      setUserAttachmentName('');
      showToast('تم تحميل وإضافة المستند بنجاح 📎');
    } catch (err: any) {
      console.error("User upload error:", err);
      alert(`فشل تحميل الملف: ${err.message || err}`);
    } finally {
      setIsUserFileUploading(false);
    }
  };

  const handleRemoveExistingUserAttachment = (id: string) => {
    setUserExistingAttachments(prev => prev.filter(att => att.id !== id));
  };

  const handleRemoveNewUserAttachment = (id: string) => {
    setUserNewAttachmentsList(prev => prev.filter(att => att.id !== id));
  };

  // Rich-text formatting toolbar helper for text notes
  const insertUserTextAtCursor = (tag: 'bold' | 'italic' | 'list' | 'clear') => {
    const textarea = document.getElementById('user-task-notes-textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    if (tag === 'clear') {
      setUserTaskNotes('');
      textarea.focus();
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = userTaskNotes;
    const selectedText = currentText.substring(start, end);
    
    let textToInsert = '';
    if (tag === 'bold') {
      textToInsert = `**${selectedText || 'نص عريض'}**`;
    } else if (tag === 'italic') {
      textToInsert = `*${selectedText || 'نص مائل'}*`;
    } else if (tag === 'list') {
      textToInsert = `\n- ${selectedText || 'بند جديد'}`;
    }

    const updatedText = currentText.substring(0, start) + textToInsert + currentText.substring(end);
    setUserTaskNotes(updatedText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
    }, 50);
  };

  // Core save and send handler
  const saveTaskWithUpdates = async (isSubmitToDepartment: boolean) => {
    if (!userViewingTask) return;

    // Validation
    if (isSubmitToDepartment && !userTaskNotes.trim() && userNewAttachmentsList.length === 0) {
      showToast('يرجى كتابة تقرير الإنجاز أو إرفاق مستند جديد قبل إرسال المهمة للاعتماد الإداري ⚠️', 'error');
      return;
    }

    setIsSavingUserEdits(true);

    try {
      // Simulate saving state
      await new Promise(resolve => setTimeout(resolve, 800));

      const finalStatus = isSubmitToDepartment ? 'بانتظار اعتماد المدير' : userTaskStatus;
      const finalProgress = isSubmitToDepartment ? 100 : userTaskProgress;

      // Construct timeline follow-up
      let updatedFollowUps = [...(userViewingTask.followUps || [])];
      
      // We always append to follow-up if notes are written OR new attachments are uploaded OR status/progress changed
      if (userTaskNotes.trim() || userNewAttachmentsList.length > 0 || finalStatus !== userViewingTask.status || finalProgress !== userViewingTask.progress) {
        const newFollowUp: TaskFollowUp = {
          id: `followup-${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: false }),
          username: currentUser.fullName,
          action: isSubmitToDepartment 
            ? 'تم إرسال تقرير إنجاز المهمة للاعتماد والتقييم'
            : `تحديث حالة المهمة إلى [${finalStatus}] بنسبة إنجاز ${finalProgress}%`,
          notes: userTaskNotes.trim() || 'تم تحديث بيانات المتابعة وملفات المهمة دون ملاحظات مكتوبة.',
          attachments: [...userNewAttachmentsList]
        };
        updatedFollowUps = [newFollowUp, ...updatedFollowUps];
      }

      setTasks(prev => prev.map(t => {
        if (t.id === userViewingTask.id) {
          return {
            ...t,
            status: finalStatus,
            notes: userTaskNotes.trim() || t.notes,
            executionDate: userTaskDate,
            executionTime: userTaskTime,
            progress: finalProgress,
            attachments: [...userExistingAttachments, ...userNewAttachmentsList],
            followUps: updatedFollowUps
          };
        }
        return t;
      }));

      onAddAuditLog(
        currentUser, 
        'edit', 
        isSubmitToDepartment 
          ? `تم إرسال المهمة [${userViewingTask.taskNumber}] للمدير الإداري للاعتماد النهائي`
          : `تم تحديث المتابعة ومستندات المهمة [${userViewingTask.taskNumber}]`
      );

      setIsUserTaskModalOpen(false);
      setUserViewingTask(null);
      
      showToast(
        isSubmitToDepartment
          ? 'تم إرسال تقرير المهمة بنجاح إلى الإدارة للاعتماد والمراجعة 🚀'
          : 'تم حفظ تعديلات وتحديثات المتابعة بنجاح ومزامنة الجدول الزمني للعملية 💾',
        'success'
      );
    } catch (err: any) {
      console.error("Save error:", err);
      showToast(`فشل حفظ التحديثات: ${err.message || err}`, 'error');
    } finally {
      setIsSavingUserEdits(false);
    }
  };

  // Open manager decision modal
  const handleOpenManagerDecisionModal = (task: LegalTask) => {
    setManagerDecisionTask(task);
    setDecisionType(task.managerDecision || '');
    setDecisionNotes(task.managerDecisionNotes || '');
    setIsManagerDecisionModalOpen(true);
  };

  // Save manager decision
  const handleSaveManagerDecision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!managerDecisionTask) return;

    const currentDecisionType = decisionType;
    setTasks(prev => prev.map(t => {
      if (t.id === managerDecisionTask.id) {
        return {
          ...t,
          managerDecision: currentDecisionType ? currentDecisionType as any : undefined,
          managerDecisionNotes: decisionNotes,
          managerDecisionDate: new Date().toISOString().split('T')[0],
          status: currentDecisionType === 'قبول' ? 'مكتملة' : t.status,
          progress: currentDecisionType === 'قبول' ? 100 : t.progress
        };
      }
      return t;
    }));

    onAddAuditLog(currentUser, 'edit', `تم اعتماد قرار [${decisionType}] بشأن المهمة [${managerDecisionTask.taskNumber}]`);
    setIsManagerDecisionModalOpen(false);
    setManagerDecisionTask(null);
    alert('تم تسجيل قرار الاعتماد بنجاح 📋');
  };

  // Populate form for editing
  const handleOpenEditModal = (task: LegalTask) => {
    setEditingTask(task);
    setTitle(task.title);
    setType(task.type);
    setDescription(task.description);
    setPriority(task.priority);
    setExecutionDate(task.executionDate);
    setExecutionTime(task.executionTime);
    
    // Parse assigned ids
    const parsedIds = task.assignedToId ? task.assignedToId.split(',').map(id => id.trim()) : [];
    setAssignedUserIds(parsedIds);
    setEditStatus(task.status);

    setLinkedCaseId(task.caseId || '');
    setLinkedCompanyId(task.companyId || '');
    setLinkedClientId(task.clientId || '');
    setNotes(task.notes || '');
    setTaskAttachments(task.attachments || []);
    
    // Clear attachment inputs
    setStagedFile(null);
    setAttachmentName('');
    setAttachmentFormat('PDF');

    setIsEditModalOpen(true);
  };

  // Edit Task Handler
  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;

    if (!title.trim()) {
      alert('عنوان المهمة مطلوب وإلزامي.');
      return;
    }

    if (assignedUserIds.length === 0) {
      alert('يرجى إسناد المهمة إلى مستخدم أو محامي واحد على الأقل.');
      return;
    }

    const selectedUsers = users.filter(u => assignedUserIds.includes(u.id));
    const assignedNamesStr = selectedUsers.map(u => u.fullName).join('، ');
    const assignedIdsStr = assignedUserIds.join(', ');

    const linkedCase = cases.find(c => c.id === linkedCaseId);
    const linkedCompany = companies.find(co => co.id === linkedCompanyId);
    const linkedClient = clients.find(cl => cl.id === linkedClientId);

    const updatedTask: LegalTask = {
      ...editingTask,
      title: title.trim(),
      description: description.trim(),
      type,
      priority,
      status: editStatus,
      progress: editStatus === 'مكتملة' ? 100 : (editStatus === 'جديدة' && editingTask.progress === 100 ? 0 : editingTask.progress),
      executionDate: executionDate || editingTask.executionDate,
      executionTime: executionTime || editingTask.executionTime,
      dueDate: executionDate || editingTask.dueDate,
      assignedToId: assignedIdsStr,
      assignedToName: assignedNamesStr,
      clientId: linkedClientId || undefined,
      clientName: linkedClient ? linkedClient.name : undefined,
      caseId: linkedCaseId || undefined,
      caseNumber: linkedCase ? linkedCase.caseNumberFirstInstance : undefined,
      companyId: linkedCompanyId || undefined,
      companyName: linkedCompany ? linkedCompany.name : undefined,
      notes: notes.trim() || undefined,
      attachments: taskAttachments
    };

    setTasks(prev => prev.map(t => t.id === editingTask.id ? updatedTask : t));
    onAddAuditLog(currentUser, 'edit', `تم تعديل بيانات المهمة رقم [${editingTask.taskNumber}] وعنوان "${updatedTask.title}"`);
    setIsEditModalOpen(false);
    setEditingTask(null);
    alert('تم تحديث وتعديل المهمة بنجاح 💾');
  };

  // Delete Task Handler
  const handleDeleteTask = (task: LegalTask) => {
    const confirmDelete = window.confirm(`هل أنت متأكد من رغبتك في حذف المهمة رقم [${task.taskNumber}] بشكل كامل؟`);
    if (!confirmDelete) return;

    setTasks(prev => prev.filter(t => t.id !== task.id));
    onAddAuditLog(currentUser, 'delete', `تم حذف المهمة رقم [${task.taskNumber}] وعنوان "${task.title}"`);
    alert('تم حذف المهمة بنجاح 🗑️');
  };

  // Quick Status change directly from the sections/tables
  const handleQuickStatusChange = (taskId: string, newStatus: TaskStatus) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        // Construct follow-up entry for the status change
        const newFollowUp: TaskFollowUp = {
          id: `followup-${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: false }),
          username: currentUser.fullName,
          action: `تحديث سريع لحالة المهمة إلى [${newStatus}]`,
          notes: `تم تغيير حالة المهمة مباشرة وبشكل متزامن من جدول المتابعة الموحد للأقسام.`,
          attachments: []
        };
        return {
          ...t,
          status: newStatus,
          progress: newStatus === 'مكتملة' ? 100 : (newStatus === 'جديدة' && t.progress === 100 ? 0 : t.progress),
          followUps: [newFollowUp, ...(t.followUps || [])]
        };
      }
      return t;
    }));
    onAddAuditLog(currentUser, 'edit', `تحديث سريع ومزامن لحالة المهمة إلى [${newStatus}]`);
  };

  // Direct print of a beautifully detailed PDF Report for a Legal Task
  const handlePrintTaskPdf = (task: LegalTask | null) => {
    if (!task) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('يرجى السماح بالنوافذ المنبثقة لطباعة التقرير.');
      return;
    }

    const formattedDate = new Date().toISOString().split('T')[0];
    const generatedBy = currentUser.fullName;

    // Build Follow-ups table
    let followUpsRows = '';
    if (task.followUps && task.followUps.length > 0) {
      task.followUps.forEach((item) => {
        let attsStr = '';
        if (item.attachments && item.attachments.length > 0) {
          attsStr = `<div style="margin-top: 5px; font-size: 10px; color: #b45309;">📎 المرفقات: ${item.attachments.map(a => a.name).join('، ')}</div>`;
        }
        followUpsRows += `
          <tr>
            <td style="font-weight: bold; width: 15%;">${item.date} ${item.time}</td>
            <td style="font-weight: bold; width: 15%;">${item.username}</td>
            <td style="width: 25%; color: #b45309; font-weight: bold;">${item.action}</td>
            <td style="width: 45%;">${item.notes || '-'}${attsStr}</td>
          </tr>
        `;
      });
    } else {
      followUpsRows = `<tr><td colspan="4" style="text-align: center; color: #64748b; padding: 20px;">لا توجد أي إجراءات متابعة مسجلة حتى الآن.</td></tr>`;
    }

    // Build Attachments table
    let attachmentsRows = '';
    if (task.attachments && task.attachments.length > 0) {
      task.attachments.forEach((att) => {
        attachmentsRows += `
          <tr>
            <td style="font-weight: bold;">${att.name}</td>
            <td>${att.type}</td>
            <td style="font-family: monospace;">${att.size || '-'}</td>
            <td>${att.uploadDate || '-'}</td>
            <td>${att.uploadedBy || '-'}</td>
          </tr>
        `;
      });
    } else {
      attachmentsRows = `<tr><td colspan="5" style="text-align: center; color: #64748b; padding: 15px;">لا توجد مستندات مرفقة بهذه المهمة.</td></tr>`;
    }

    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>تقرير متابعة المهمة رقم ${task.taskNumber}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
            
            @page {
              size: A4;
              margin: 15mm;
            }
            
            body {
              font-family: 'Cairo', sans-serif;
              direction: rtl;
              text-align: right;
              background-color: #fff;
              color: #1e293b;
              margin: 0;
              padding: 0;
              line-height: 1.6;
              font-size: 11px;
            }

            .report-container {
              padding: 0px;
            }

            /* Header Table */
            .header-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 25px;
              border-bottom: 3px double #b45309;
              padding-bottom: 15px;
            }

            .header-cell {
              border: none !important;
              padding: 0 0 10px 0 !important;
              background: none !important;
            }

            .title-badge {
              font-size: 20px;
              font-weight: 800;
              color: #1e293b;
              margin: 0;
            }

            .subtitle-badge {
              font-size: 11px;
              color: #b45309;
              font-weight: 700;
              margin-top: 5px;
            }

            .logo-placeholder {
              border: 2px solid #b45309;
              padding: 8px 15px;
              display: inline-block;
              font-weight: 800;
              font-size: 14px;
              color: #b45309;
              letter-spacing: 1px;
            }

            .section-title {
              font-size: 12px;
              font-weight: 800;
              color: #b45309;
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 5px;
              margin-top: 30px;
              margin-bottom: 12px;
              display: flex;
              align-items: center;
              gap: 8px;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }

            th, td {
              border: 1px solid #cbd5e1;
              padding: 8px 10px;
              text-align: right;
              vertical-align: top;
            }

            th {
              background-color: #f8fafc;
              color: #334155;
              font-weight: 700;
              font-size: 10.5px;
            }

            .badge {
              display: inline-block;
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 9.5px;
              font-weight: 700;
            }

            .badge-urgent { background-color: #fee2e2; color: #991b1b; }
            .badge-high { background-color: #ffedd5; color: #c2410c; }
            .badge-normal { background-color: #f1f5f9; color: #334155; }
            .badge-active { background-color: #fef3c7; color: #92400e; }
            .badge-done { background-color: #d1fae5; color: #065f46; }

            .desc-box {
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-right: 4px solid #b45309;
              padding: 12px;
              font-size: 11px;
              margin-bottom: 20px;
              border-radius: 4px;
              white-space: pre-wrap;
            }

            .footer-signature {
              margin-top: 50px;
              width: 100%;
              border-collapse: collapse;
            }

            .footer-signature td {
              border: none !important;
              padding: 10px !important;
              text-align: center;
              font-size: 10px;
            }

            .signature-box {
              border: 1px dashed #cbd5e1 !important;
              height: 70px;
              margin-top: 8px;
              border-radius: 6px;
            }

            .print-btn {
              background-color: #1e293b;
              color: #f59e0b;
              font-family: 'Cairo', sans-serif;
              font-weight: 800;
              font-size: 12px;
              padding: 10px 20px;
              border: none;
              border-radius: 8px;
              cursor: pointer;
              margin: 15px auto;
              display: block;
              box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
              transition: all 0.2s;
            }
            .print-btn:hover {
              background-color: #0f172a;
              transform: translateY(-1px);
            }

            @media print {
              .print-btn {
                display: none !important;
              }
              body {
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          <button class="print-btn" onclick="window.print()">🖨️ بدء طباعة التقرير الآن</button>

          <div class="report-container">
            <!-- Institutional Header -->
            <table class="header-table">
              <tr>
                <td class="header-cell" style="width: 50%;">
                  <div class="title-badge">مؤسسة رميح للمحاماة والاستشارات القانونية</div>
                  <div class="subtitle-badge">قسم المتابعة الرقمية والتحول التقني للملفات</div>
                  <div style="font-size: 9px; color: #64748b; margin-top: 5px;">
                    عنوان التقرير: تقرير متابعة الأداء الفني والزمني للعملية القانونية
                  </div>
                </td>
                <td class="header-cell" style="width: 50%; text-align: left; vertical-align: middle;">
                  <div class="logo-placeholder">مجموعة رميح</div>
                </td>
              </tr>
            </table>

            <!-- Document Meta -->
            <table style="margin-bottom: 25px;">
              <tr>
                <th style="width: 25%">رقم المهمة الرئيسي</th>
                <td style="font-weight: bold; color: #b45309; font-size: 12px;">${task.taskNumber}</td>
                <th style="width: 25%">تاريخ استخراج التقرير</th>
                <td>${formattedDate}</td>
              </tr>
              <tr>
                <th>اسم الموظف المستخرج</th>
                <td>${generatedBy}</td>
                <th>الجهة الموجه إليها</th>
                <td style="font-weight: bold;">إدارة الرقابة والجودة الفنية</td>
              </tr>
            </table>

            <!-- SECTION 1: Task Core Information -->
            <div class="section-title">⚖️ أولاً: بيانات المهمة الأساسية والمسؤول التنفيذي</div>
            <table>
              <tr>
                <th style="width: 20%">عنوان المهمة</th>
                <td colspan="3" style="font-weight: bold; font-size: 11.5px;">${task.title}</td>
              </tr>
              <tr>
                <th>تصنيف العمل / النوع</th>
                <td style="font-weight: bold;">${task.type}</td>
                <th>المسؤول المعين بالتنفيذ</th>
                <td style="font-weight: bold; color: #1e293b;">${task.assignedToName || 'غير محدد'}</td>
              </tr>
              <tr>
                <th>درجة الأولوية والأهمية</th>
                <td>
                  <span class="badge ${
                    task.priority === 'عاجلة' ? 'badge-urgent' :
                    task.priority === 'عالية' ? 'badge-high' :
                    'badge-normal'
                  }">${task.priority}</span>
                </td>
                <th>نسبة إنجاز العمل الحالي</th>
                <td style="font-weight: bold; color: #059669;">${task.progress || 0}%</td>
              </tr>
              <tr>
                <th>الحالة الإجرائية الحالية</th>
                <td>
                  <span class="badge badge-active">${task.status}</span>
                </td>
                <th>تاريخ وتوقيت المتابعة المطلوب</th>
                <td style="font-family: monospace; font-weight: bold;">${task.executionDate || '-'} ${task.executionTime || '-'}</td>
              </tr>
              <tr>
                <th>العميل ذو الصلة</th>
                <td>${task.clientName || 'غير مرتبط'}</td>
                <th>القضية / الشركة المرتبطة</th>
                <td>
                  ${task.caseNumber ? ('قضية رقم ' + task.caseNumber) : ''}
                  ${task.companyName ? ('شركة: ' + task.companyName) : ''}
                  ${(!task.caseNumber && !task.companyName) ? 'عام / غير مرتبط' : ''}
                </td>
              </tr>
            </table>

            <!-- SECTION 2: Task Description -->
            ${task.description ? (
              '<div class="section-title">📄 ثانياً: الإرشادات ووصف طبيعة المهمة المطلوب إنجازها</div><div class="desc-box">' + task.description + '</div>'
            ) : ''}

            <!-- SECTION 3: Attachments -->
            <div class="section-title">📎 ثالثاً: المستندات والوثائق المرفقة بالمهمة</div>
            <table>
              <thead>
                <tr>
                  <th style="width: 40%">اسم المستند / الوثيقة الثبوتية</th>
                  <th style="width: 15%">النوع</th>
                  <th style="width: 15%">الحجم</th>
                  <th style="width: 15%">تاريخ الرفع</th>
                  <th style="width: 15%">الموظف الرافع</th>
                </tr>
              </thead>
              <tbody>
                ${attachmentsRows}
              </tbody>
            </table>

            <!-- SECTION 4: Timeline Follow-ups -->
            <div class="section-title">⏱️ رابعاً: السجل الزمني للتحديثات ومحاضر المتابعة السابقة</div>
            <table>
              <thead>
                <tr>
                  <th style="width: 15%">توقيت التحديث</th>
                  <th style="width: 15%">بواسطة الموظف</th>
                  <th style="width: 25%">الإجراء المتخذ</th>
                  <th style="width: 45%">ملاحظات وتقرير الإجراء التفصيلي</th>
                </tr>
              </thead>
              <tbody>
                ${followUpsRows}
              </tbody>
            </table>

            <!-- Signatures Section -->
            <table class="footer-signature">
              <tr>
                <td style="width: 33%">
                  <strong>المسؤول المكلف بالتنفيذ</strong>
                  <br />
                  <span style="font-size: 9px; color: #64748b;">التوقيع والاعتماد الفني</span>
                  <div class="signature-box"></div>
                </td>
                <td style="width: 34%">
                  <strong>مدير قسم متابعة المهام</strong>
                  <br />
                  <span style="font-size: 9px; color: #64748b;">التفتيش الإداري والتقييم</span>
                  <div class="signature-box"></div>
                </td>
                <td style="width: 33%">
                  <strong>الختم الرسمي للمؤسسة</strong>
                  <br />
                  <span style="font-size: 9px; color: #64748b;">مجموعة رميح القانونية</span>
                  <div class="signature-box" style="border-style: solid !important; border-color: #b45309 !important; border-width: 2px !important;"></div>
                </td>
              </tr>
            </table>

          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 400);
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  // Refresh toolbar handler
  const handleRefresh = () => {
    setSearchQuery('');
    setFilterPriority('all');
    setFilterType('all');
    setFilterStatus('all');
    alert('تم تحديث قائمة المهام وإعادة ضبط الفلاتر 🔄');
  };

  // Filter & Search computation
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Search matches title, taskNumber, type, assigned names, or linked names
      const s = searchQuery.toLowerCase().trim();
      const matchesSearch = !s || 
        task.title?.toLowerCase().includes(s) ||
        task.taskNumber?.toLowerCase().includes(s) ||
        task.type?.toLowerCase().includes(s) ||
        task.assignedToName?.toLowerCase().includes(s) ||
        task.clientName?.toLowerCase().includes(s) ||
        task.companyName?.toLowerCase().includes(s) ||
        task.caseNumber?.toLowerCase().includes(s);

      const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;
      const matchesType = filterType === 'all' || task.type === filterType;
      const matchesStatus = filterStatus === 'all' || task.status === filterStatus;

      return matchesSearch && matchesPriority && matchesType && matchesStatus;
    });
  }, [tasks, searchQuery, filterPriority, filterType, filterStatus]);

  // User tab task filtering & sorting
  const userFilteredAndSortedTasks = useMemo(() => {
    // Filter tasks assigned to me
    const myTasks = tasks.filter(task => {
      const assignedIds = task.assignedToId ? task.assignedToId.split(',').map(id => id.trim()) : [];
      return assignedIds.includes(currentUser.id);
    });

    // Apply Search & filters
    return myTasks.filter(task => {
      const q = userSearchQuery.trim().toLowerCase();
      const matchesSearch = !q ||
        task.title?.toLowerCase().includes(q) ||
        task.description?.toLowerCase().includes(q) ||
        task.taskNumber?.toLowerCase().includes(q);

      const matchesPriority = userFilterPriority === 'all' || task.priority === userFilterPriority;
      const matchesStatus = userFilterStatus === 'all' || task.status === userFilterStatus;

      return matchesSearch && matchesPriority && matchesStatus;
    }).sort((a, b) => {
      const getPriorityWeight = (p: TaskPriority) => {
        switch (p) {
          case 'عاجلة': return 4;
          case 'عالية': return 3;
          case 'متوسطة': return 2;
          case 'منخفضة': return 1;
          default: return 0;
        }
      };
      const weightA = getPriorityWeight(a.priority);
      const weightB = getPriorityWeight(b.priority);
      if (weightB !== weightA) return weightB - weightA;
      return a.executionDate.localeCompare(b.executionDate);
    });
  }, [tasks, userSearchQuery, userFilterPriority, userFilterStatus, currentUser.id]);

  // Execute tab task filtering & sorting
  const executeFilteredAndSortedTasks = useMemo(() => {
    return tasks.filter(task => {
      const q = executeSearchQuery.trim().toLowerCase();
      const matchesSearch = !q ||
        task.title?.toLowerCase().includes(q) ||
        task.description?.toLowerCase().includes(q) ||
        task.taskNumber?.toLowerCase().includes(q) ||
        task.assignedToName?.toLowerCase().includes(q);

      const matchesPriority = executeFilterPriority === 'all' || task.priority === executeFilterPriority;
      const matchesStatus = executeFilterStatus === 'all' || task.status === executeFilterStatus;
      
      let matchesUser = true;
      if (executeFilterUser !== 'all') {
        const assignedIds = task.assignedToId ? task.assignedToId.split(',').map(id => id.trim()) : [];
        matchesUser = assignedIds.includes(executeFilterUser);
      }

      return matchesSearch && matchesPriority && matchesStatus && matchesUser;
    }).sort((a, b) => {
      return b.executionDate.localeCompare(a.executionDate);
    });
  }, [tasks, executeSearchQuery, executeFilterPriority, executeFilterStatus, executeFilterUser]);

  // Stats computation for Execute tab
  const executeStats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    let active = 0;
    let completed = 0;
    let overdue = 0;
    let totalProgressSum = 0;

    tasks.forEach(t => {
      const isActive = t.status !== 'مكتملة' && t.status !== 'ملغاة';
      if (isActive) {
        active++;
        if (t.executionDate < todayStr) {
          overdue++;
        }
      } else if (t.status === 'مكتملة') {
        completed++;
      }

      if (t.status === 'مكتملة') {
        totalProgressSum += 100;
      } else {
        totalProgressSum += (t.progress || 0);
      }
    });

    const avgProgress = tasks.length > 0 ? Math.round(totalProgressSum / tasks.length) : 0;

    return { active, completed, overdue, avgProgress };
  }, [tasks]);

  // Priority Badge style getter
  const getPriorityBadgeClass = (p: TaskPriority) => {
    switch (p) {
      case 'عاجلة':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      case 'عالية':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'متوسطة':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'منخفضة':
        return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
    }
  };

  // Status Badge style getter
  const getStatusBadgeClass = (s: TaskStatus) => {
    switch (s) {
      case 'جديدة':
        return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
      case 'قيد التنفيذ':
        return 'bg-sky-500/10 text-sky-400 border border-sky-500/20';
      case 'بانتظار مستندات':
        return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20';
      case 'بانتظار إجراء':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'بانتظار اعتماد المدير':
        return 'bg-teal-500/10 text-teal-400 border border-teal-500/20';
      case 'مؤجلة':
        return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
      case 'مكتملة':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'ملغاة':
        return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
    }
  };

  // Dynamic interactive status selector
  const renderStatusSelect = (task: LegalTask, allowed: boolean) => {
    if (!allowed) {
      return (
        <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded-full ${getStatusBadgeClass(task.status)}`}>
          {task.status}
        </span>
      );
    }

    return (
      <select
        value={task.status}
        onChange={(e) => handleQuickStatusChange(task.id, e.target.value as TaskStatus)}
        className={`text-[10px] font-black px-2 py-0.5 rounded-full outline-none border transition-all cursor-pointer bg-slate-950 focus:ring-2 focus:ring-amber-500/30 ${getStatusBadgeClass(task.status)}`}
      >
        <option value="جديدة" className="bg-slate-950 text-indigo-400">جديدة 🆕</option>
        <option value="قيد التنفيذ" className="bg-slate-950 text-sky-400">قيد التنفيذ ⚙️</option>
        <option value="بانتظار مستندات" className="bg-slate-950 text-yellow-400">بانتظار مستندات 📄</option>
        <option value="بانتظار إجراء" className="bg-slate-950 text-amber-400">بانتظار إجراء ⏳</option>
        <option value="بانتظار اعتماد المدير" className="bg-slate-950 text-teal-400">بانتظار اعتماد المدير 👔</option>
        <option value="مؤجلة" className="bg-slate-950 text-purple-400">مؤجلة 📅</option>
        <option value="مكتملة" className="bg-slate-950 text-emerald-400">مكتملة ✅</option>
        <option value="ملغاة" className="bg-slate-950 text-slate-400">ملغاة ❌</option>
      </select>
    );
  };

  return (
    <div className="space-y-3.5 animate-fadeIn relative p-3.5 sm:p-4 rounded-2xl bg-gradient-to-b from-[#0a1931] via-[#102a52] to-[#153460] border border-[#2C3F67]/40 shadow-[0_20px_50px_rgba(0,0,0,0.4)] overflow-hidden" dir="rtl">
      {/* 3% Transparent Gold Geometric Grid Lines Background */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] overflow-hidden z-0">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="gold-grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#F5B041" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#gold-grid)" />
          {/* Subtle gold elegant orbits */}
          <circle cx="20%" cy="30%" r="200" fill="none" stroke="#F5B041" strokeWidth="1" strokeDasharray="5 5" />
          <circle cx="80%" cy="75%" r="350" fill="none" stroke="#F5B041" strokeWidth="1" />
        </svg>
      </div>

      {/* Navigation tabs */}
      <div className="grid w-full gap-6 grid-cols-1 sm:grid-cols-3 relative z-10">
        {/* Tab 1: إدارة المهام */}
        {canManageTasks && (
          <button
            onClick={() => setActiveTab('manage')}
            id="tab-manage-tasks"
            className={`group text-right p-[26px] transition-all duration-[250ms] relative overflow-hidden flex flex-col justify-between gap-6 cursor-pointer rounded-[30px] min-h-[190px] border shadow-[0_25px_60px_rgba(0,0,0,0.35)] hover:scale-[1.03] ${
              activeTab === 'manage'
                ? 'bg-[#121B30]/98 border-[#1565FF] shadow-[0_0_30px_rgba(21,101,255,0.25)] ring-2 ring-[#1565FF]/20'
                : 'bg-[#121B30]/90 border-[#2F4168] hover:border-[#1565FF]/50 text-slate-300'
            }`}
          >
            {/* Soft background glow */}
            <div className={`absolute top-0 right-0 w-36 h-36 rounded-full blur-[60px] opacity-20 transition-all ${
              activeTab === 'manage' ? 'bg-[#1565FF]' : 'bg-[#1565FF]/40 group-hover:bg-[#1565FF]'
            }`} />

            <div className="flex items-center justify-between w-full z-10">
              {/* Glass Box Icon */}
              <div 
                className={`w-[70px] h-[70px] rounded-[22px] flex items-center justify-center transition-all duration-[250ms] border shadow-inner ${
                  activeTab === 'manage'
                    ? 'bg-gradient-to-br from-[#1565FF] to-[#4DA3FF] border-[#4DA3FF]/40 text-white shadow-[0_0_20px_rgba(21,101,255,0.4)]'
                    : 'bg-slate-900/60 border-[#2F4168] text-[#4DA3FF] group-hover:text-white group-hover:bg-gradient-to-br group-hover:from-[#1565FF] group-hover:to-[#4DA3FF] group-hover:shadow-[0_0_15px_rgba(21,101,255,0.3)]'
                }`}
              >
                <ClipboardList className="w-[34px] h-[34px]" />
              </div>

              {/* Dynamic Illustration: Clipboard + Luxury Pen + transparent scale of justice */}
              <div className="relative w-24 h-16 opacity-40 group-hover:opacity-100 transition-all duration-300">
                {/* Scale of Justice (BG) */}
                <Scale className="absolute inset-0 w-16 h-16 text-slate-500/15 stroke-[1]" />
                {/* Clipboard */}
                <div className="absolute left-2 bottom-1 w-11 h-14 bg-[#121B30]/90 rounded-md border border-[#2F4168] p-1.5 flex flex-col gap-1 shadow-inner">
                  <div className="w-4 h-1 bg-[#1565FF]/40 rounded-xs mx-auto mb-1" />
                  <div className="w-full h-1 bg-slate-700/50 rounded-xs" />
                  <div className="w-4/5 h-1 bg-slate-700/50 rounded-xs" />
                  <div className="w-full h-1 bg-slate-700/50 rounded-xs" />
                </div>
                {/* Luxury Pen */}
                <div className="absolute left-6 top-1 w-1.5 h-14 bg-gradient-to-b from-[#F5B041] via-amber-600 to-amber-900 rounded-full transform rotate-[35deg] shadow-md shadow-amber-500/35 border border-[#F5B041]/30" />
              </div>
            </div>

            <div className="space-y-1.5 z-10 text-right">
              <h4 className="text-base font-bold text-white tracking-wide">إدارة المهام</h4>
              <p className="text-xs text-[#A5B4CF] font-light leading-[170%]">إنشاء وتخصيص ومتابعة المهام بكفاءة عالية</p>
            </div>
          </button>
        )}

        {/* Tab 2: متابعة المستخدم للمهام */}
        {canViewUserTaskTracking && (
          <button
            onClick={() => setActiveTab('user')}
            id="tab-user-tasks"
            className={`group text-right p-[26px] transition-all duration-[250ms] relative overflow-hidden flex flex-col justify-between gap-6 cursor-pointer rounded-[30px] min-h-[190px] border shadow-[0_25px_60px_rgba(0,0,0,0.35)] hover:scale-[1.03] ${
              activeTab === 'user'
                ? 'bg-[#121B30]/98 border-[#00796B] shadow-[0_0_30px_rgba(0,121,107,0.25)] ring-2 ring-[#00796B]/20'
                : 'bg-[#121B30]/90 border-[#2F4168] hover:border-[#00796B]/50 text-slate-300'
            }`}
          >
            {/* Soft background glow */}
            <div className={`absolute top-0 right-0 w-36 h-36 rounded-full blur-[60px] opacity-20 transition-all ${
              activeTab === 'user' ? 'bg-[#00796B]' : 'bg-[#00796B]/40 group-hover:bg-[#00796B]'
            }`} />

            <div className="flex items-center justify-between w-full z-10">
              {/* Glass Box Icon */}
              <div 
                className={`w-[70px] h-[70px] rounded-[22px] flex items-center justify-center transition-all duration-[250ms] border shadow-inner ${
                  activeTab === 'user'
                    ? 'bg-gradient-to-br from-[#00796B] to-[#43D6C3] border-[#43D6C3]/40 text-white shadow-[0_0_20px_rgba(0,121,107,0.4)]'
                    : 'bg-slate-900/60 border-[#2F4168] text-[#43D6C3] group-hover:text-white group-hover:bg-gradient-to-br group-hover:from-[#00796B] group-hover:to-[#43D6C3] group-hover:shadow-[0_0_15px_rgba(0,121,107,0.3)]'
                }`}
              >
                <Users className="w-[34px] h-[34px]" />
              </div>

              {/* Dynamic Illustration: User card + search lens + performance chart */}
              <div className="relative w-24 h-16 opacity-40 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
                {/* Chart Background */}
                <div className="absolute right-2 bottom-1 flex items-end gap-[3px] h-10 w-12 text-[#43D6C3]/20">
                  <div className="w-[5px] h-5 bg-current rounded-[1px]" />
                  <div className="w-[5px] h-8 bg-current rounded-[1px]" />
                  <div className="w-[5px] h-6 bg-current rounded-[1px]" />
                  <div className="w-[5px] h-10 bg-current rounded-[1px]" />
                </div>
                {/* Floating User Card */}
                <div className="absolute left-2 top-2 w-12 h-10 bg-[#121B30]/90 rounded-md border border-[#2F4168] p-1 flex items-center gap-1 shadow-inner z-10">
                  <div className="w-4 h-4 rounded-full bg-[#00796B]/30 flex items-center justify-center">
                    <UserIcon className="w-2.5 h-2.5 text-[#43D6C3]" />
                  </div>
                  <div className="flex-1 flex flex-col gap-0.5">
                    <div className="w-5 h-1 bg-slate-600/60 rounded-xs" />
                    <div className="w-3 h-1 bg-slate-600/40 rounded-xs" />
                  </div>
                </div>
                {/* Search Lens */}
                <Search className="absolute left-1 bottom-1 w-6 h-6 text-[#43D6C3] drop-shadow-[0_0_8px_rgba(67,214,195,0.6)] transform -translate-x-1 translate-y-1 z-20 stroke-[2.5]" />
              </div>
            </div>

            <div className="space-y-1.5 z-10 text-right">
              <h4 className="text-base font-bold text-white tracking-wide">متابعة المستخدم للمهام</h4>
              <p className="text-xs text-[#A5B4CF] font-light leading-[170%]">استعراض المهام المكلف بها المستخدم</p>
            </div>
          </button>
        )}

        {/* Tab 3: متابعة تنفيذ المهام */}
        {canViewTaskExecutionTracking && (
          <button
            onClick={() => setActiveTab('execute')}
            id="tab-execute-tasks"
            className={`group text-right p-[26px] transition-all duration-[250ms] relative overflow-hidden flex flex-col justify-between gap-6 cursor-pointer rounded-[30px] min-h-[190px] border shadow-[0_25px_60px_rgba(0,0,0,0.35)] hover:scale-[1.03] ${
              activeTab === 'execute'
                ? 'bg-[#121B30]/98 border-[#5E35B1] shadow-[0_0_30px_rgba(94,53,177,0.25)] ring-2 ring-[#5E35B1]/20'
                : 'bg-[#121B30]/90 border-[#2F4168] hover:border-[#5E35B1]/50 text-slate-300'
            }`}
          >
            {/* Soft background glow */}
            <div className={`absolute top-0 right-0 w-36 h-36 rounded-full blur-[60px] opacity-20 transition-all ${
              activeTab === 'execute' ? 'bg-[#5E35B1]' : 'bg-[#5E35B1]/40 group-hover:bg-[#5E35B1]'
            }`} />

            <div className="flex items-center justify-between w-full z-10">
              {/* Glass Box Icon */}
              <div 
                className={`w-[70px] h-[70px] rounded-[22px] flex items-center justify-center transition-all duration-[250ms] border shadow-inner ${
                  activeTab === 'execute'
                    ? 'bg-gradient-to-br from-[#5E35B1] to-[#A855F7] border-[#A855F7]/40 text-white shadow-[0_0_20px_rgba(94,53,177,0.4)]'
                    : 'bg-slate-900/60 border-[#2F4168] text-[#A855F7] group-hover:text-white group-hover:bg-gradient-to-br group-hover:from-[#5E35B1] group-hover:to-[#A855F7] group-hover:shadow-[0_0_15px_rgba(94,53,177,0.3)]'
                }`}
              >
                <Eye className="w-[34px] h-[34px]" />
              </div>

              {/* Dynamic Illustration: Target + Arrow + Progress */}
              <div className="relative w-24 h-16 opacity-40 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
                {/* Target concentric rings */}
                <div className="absolute right-3 w-14 h-14 rounded-full border border-[#A855F7]/20 flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full border border-[#A855F7]/40 flex items-center justify-center">
                    <div className="w-5 h-5 rounded-full bg-[#5E35B1]/30 flex items-center justify-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#A855F7] shadow-[0_0_8px_#A855F7]" />
                    </div>
                  </div>
                </div>
                {/* Golden Arrow */}
                <div className="absolute right-0 top-1 w-16 h-[2px] bg-gradient-to-l from-[#F5B041] to-transparent transform -rotate-[40deg] origin-right shadow-sm shadow-[#F5B041]/40">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1 bg-[#F5B041] rounded-full" />
                </div>
                {/* Circular Progress Accent */}
                <div className="absolute left-2 bottom-1 w-10 h-10 rounded-full border-2 border-dashed border-[#A855F7]/20 flex items-center justify-center">
                  <span className="text-[9px] font-bold text-[#A855F7] font-mono">85%</span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5 z-10 text-right">
              <h4 className="text-base font-bold text-white tracking-wide">متابعة تنفيذ المهام</h4>
              <p className="text-xs text-[#A5B4CF] font-light leading-[170%]">مراقبة تنفيذ المهام ومراجعة التقدم</p>
            </div>
          </button>
        )}
      </div>

      {/* Active Tasks Banner Card */}
      <div className="w-full bg-[#111827] border border-[#F5B041]/45 rounded-[30px] p-[26px] shadow-[0_25px_60px_rgba(0,0,0,0.35)] relative overflow-hidden flex items-center justify-between z-10 transition-all duration-[250ms] hover:scale-[1.01] bg-gradient-to-r from-[#111827] via-[#121B30] to-[#111827]">
        {/* Soft Gold ambient glow */}
        <div className="absolute left-10 -bottom-10 w-48 h-48 rounded-full bg-[#F5B041]/10 blur-[50px] pointer-events-none" />
        
        {/* Right side: Texts */}
        <div className="flex flex-col gap-1.5 text-right">
          <span className="text-sm font-bold text-[#F5B041] tracking-wide">المهام النشطة</span>
          <span className="text-5xl font-black text-white font-mono leading-none">{tasks.filter(t => t.status === 'قيد التنفيذ').length}</span>
          <span className="text-xs text-[#A5B4CF] font-light mt-1">مهام قيد التنفيذ حالياً</span>
        </div>

        {/* Left side: Large Gold Circle with Briefcase */}
        <div className="w-[66px] h-[66px] rounded-full bg-gradient-to-br from-[#F5B041] to-[#B7950B] flex items-center justify-center shadow-[0_0_25px_rgba(245,176,65,0.4)] border border-[#F5B041]/40 shrink-0">
          <Briefcase className="w-8 h-8 text-slate-950 stroke-[2.5]" />
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-[#121B30]/94 border border-[#2F4168] rounded-[30px] p-[26px] shadow-[0_25px_60px_rgba(0,0,0,0.35)] min-h-[450px] relative z-10">
        {activeTab === 'manage' && (
          <div className="space-y-6">
            
            {/* Toolbar at top of the page */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-950/45 p-4 rounded-2xl border border-slate-800/80 shadow-xs">
              
              {/* Action Buttons */}
              <div className="flex items-center flex-wrap gap-2 order-2 md:order-1">
                <button
                  onClick={handleOpenCreateModal}
                  id="btn-create-task"
                  className="bg-amber-500 hover:bg-amber-600 active:scale-97 text-slate-950 text-xs font-black px-5 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-sm shadow-amber-500/10 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-slate-950 stroke-[3]" />
                  إنشاء مهمة جديدة
                </button>

                <button
                  onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                  className={`border text-xs font-bold px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                    showFilterDropdown || filterPriority !== 'all' || filterType !== 'all' || filterStatus !== 'all'
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  تصفية الفرز
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showFilterDropdown ? 'rotate-180' : ''}`} />
                </button>

                <button
                  onClick={handleRefresh}
                  className="bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 p-2.5 rounded-xl transition-all active:scale-95 cursor-pointer"
                  title="تحديث وإعادة ضبط القائمة"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:max-w-xs order-1 md:order-2">
                <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                  <Search className="w-4 h-4 text-slate-500" />
                </span>
                <input
                  type="text"
                  placeholder="بحث باسم المهمة، الرقم، أو المسؤول..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pr-10 pl-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/30 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

            </div>

            {/* Filter Dropdown Body */}
            {showFilterDropdown && (
              <div className="bg-slate-950/65 border border-slate-800/80 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fadeIn">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-1.5">حسب الأولوية</label>
                  <select
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-xs font-bold text-slate-200 outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="all">الكل</option>
                    <option value="عاجلة">عاجلة</option>
                    <option value="عالية">عالية</option>
                    <option value="متوسطة">متوسطة</option>
                    <option value="منخفضة">منخفضة</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-1.5">حسب نوع المهمة</label>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-xs font-bold text-slate-200 outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="all">الكل</option>
                    {taskTypesList.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-1.5">حسب الحالة</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-xs font-bold text-slate-200 outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="all">الكل</option>
                    <option value="جديدة">جديدة</option>
                    <option value="قيد التنفيذ">قيد التنفيذ</option>
                    <option value="بانتظار مستندات">بانتظار مستندات</option>
                    <option value="بانتظار إجراء">بانتظار إجراء</option>
                    <option value="بانتظار اعتماد المدير">بانتظار اعتماد المدير</option>
                    <option value="مؤجلة">مؤجلة</option>
                    <option value="مكتملة">مكتملة</option>
                    <option value="ملغاة">ملغاة</option>
                  </select>
                </div>
              </div>
            )}

            {/* Tasks Table */}
            <div className="overflow-x-auto bg-slate-950/25 border border-slate-800/60 rounded-2xl">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-950/60 text-slate-400 border-b border-slate-800/80">
                    <th className="py-4 px-4 text-xs font-black">رقم المهمة</th>
                    <th className="py-4 px-4 text-xs font-black">عنوان المهمة</th>
                    <th className="py-4 px-4 text-xs font-black">نوع المهمة</th>
                    <th className="py-4 px-4 text-xs font-black">المسؤول</th>
                    <th className="py-4 px-4 text-xs font-black">تاريخ التنفيذ</th>
                    <th className="py-4 px-4 text-xs font-black">الأولوية</th>
                    <th className="py-4 px-4 text-xs font-black">الحالة</th>
                    <th className="py-4 px-4 text-xs font-black text-left">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/50">
                  {filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500 font-bold text-xs">
                        <AlertCircle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                        لا توجد أي مهام مسجلة تطابق معايير البحث أو التصفية الحالية.
                      </td>
                    </tr>
                  ) : (
                    filteredTasks.map((task) => {
                      const assignedNames = task.assignedToName ? task.assignedToName.split('،').map(name => name.trim()) : [];
                      
                      return (
                        <tr key={task.id} className="hover:bg-slate-900/20 transition-all group">
                          {/* رقم المهمة */}
                          <td className="py-3 px-4 text-xs font-black font-mono text-amber-500">
                            {task.taskNumber || 'TSK-XXXX'}
                          </td>
                          {/* عنوان المهمة */}
                          <td className="py-3 px-4 text-xs font-bold text-white max-w-xs truncate" title={task.title}>
                            {task.title}
                          </td>
                          {/* نوع المهمة */}
                          <td className="py-3 px-4 text-xs font-bold text-slate-300">
                            {task.type}
                          </td>
                          {/* المسؤول */}
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {assignedNames.map((name, idx) => (
                                <span key={idx} className="inline-flex items-center gap-1 bg-slate-950 border border-slate-800 text-[10px] font-bold px-2 py-0.5 rounded-full text-slate-300">
                                  <UserIcon className="w-2.5 h-2.5 text-amber-500" />
                                  {name}
                                </span>
                              ))}
                            </div>
                          </td>
                          {/* تاريخ التنفيذ */}
                          <td className="py-3 px-4 text-xs font-bold font-mono text-slate-400">
                            {task.executionDate}
                          </td>
                          {/* الأولوية */}
                          <td className="py-3 px-4">
                            <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded-full ${getPriorityBadgeClass(task.priority)}`}>
                              {task.priority}
                            </span>
                          </td>
                          {/* الحالة */}
                          <td className="py-3 px-4">
                            {renderStatusSelect(task, true)}
                          </td>
                          {/* الإجراءات */}
                          <td className="py-3 px-4 text-left">
                            <div className="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => { setViewingTask(task); setIsViewModalOpen(true); }}
                                className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-amber-400 transition-all cursor-pointer"
                                title="عرض تفاصيل المهمة"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleOpenEditModal(task)}
                                className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-amber-400 transition-all cursor-pointer"
                                title="تعديل المهمة"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteTask(task)}
                                className="p-1.5 bg-slate-900 hover:bg-red-950/60 border border-slate-800 hover:border-red-900/50 rounded-lg text-slate-400 hover:text-red-400 transition-all cursor-pointer"
                                title="حذف المهمة"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* Tab 2: متابعة المستخدم للمهام */}
        {activeTab === 'user' && (
          <div className="space-y-6">
            {/* Toolbar at top of the page */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-950/45 p-4 rounded-2xl border border-slate-800/80 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-amber-500 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/10">
                  📋 المهام المسندة إليك: {userFilteredAndSortedTasks.length} مهمة
                </span>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:max-w-xl justify-end">
                {/* Search */}
                <div className="relative w-full sm:max-w-xs">
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <Search className="w-4 h-4 text-slate-500" />
                  </span>
                  <input
                    type="text"
                    placeholder="بحث في مهامي..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="w-full pr-9 pl-4 py-2 bg-slate-900/90 border border-slate-800 rounded-xl text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/30 transition-all"
                  />
                  {userSearchQuery && (
                    <button
                      onClick={() => setUserSearchQuery('')}
                      className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Priority */}
                <select
                  value={userFilterPriority}
                  onChange={(e) => setUserFilterPriority(e.target.value)}
                  className="w-full sm:w-32 bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-xs font-bold text-slate-200 outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="all">كل الأولويات</option>
                  <option value="عاجلة">عاجلة</option>
                  <option value="عالية">عالية</option>
                  <option value="متوسطة">متوسطة</option>
                  <option value="منخفضة">منخفضة</option>
                </select>

                {/* Status */}
                <select
                  value={userFilterStatus}
                  onChange={(e) => setUserFilterStatus(e.target.value)}
                  className="w-full sm:w-36 bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-xs font-bold text-slate-200 outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="all">كل الحالات</option>
                  <option value="جديدة">جديدة</option>
                  <option value="قيد التنفيذ">قيد التنفيذ</option>
                  <option value="بانتظار مستندات">بانتظار مستندات</option>
                  <option value="بانتظار إجراء">بانتظار إجراء</option>
                  <option value="بانتظار اعتماد المدير">بانتظار اعتماد المدير</option>
                  <option value="مؤجلة">مؤجلة</option>
                  <option value="مكتملة">مكتملة</option>
                  <option value="ملغاة">ملغاة</option>
                </select>
              </div>
            </div>

            {/* Tasks Table */}
            <div className="overflow-x-auto bg-slate-950/25 border border-slate-800/60 rounded-2xl">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-950/60 text-slate-400 border-b border-slate-800/80">
                    <th className="py-4 px-4 text-xs font-black">رقم المهمة</th>
                    <th className="py-4 px-4 text-xs font-black">عنوان المهمة</th>
                    <th className="py-4 px-4 text-xs font-black">الموعد النهائي</th>
                    <th className="py-4 px-4 text-xs font-black">الأولوية</th>
                    <th className="py-4 px-4 text-xs font-black">نسبة الإنجاز</th>
                    <th className="py-4 px-4 text-xs font-black">الحالة</th>
                    <th className="py-4 px-4 text-xs font-black">قرار واعتماد المدير</th>
                    <th className="py-4 px-4 text-xs font-black text-left">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/50">
                  {userFilteredAndSortedTasks.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500 font-bold text-xs">
                        <AlertCircle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                        لا توجد أي مهام مسندة إليك حالياً تطابق الفلاتر المحددة.
                      </td>
                    </tr>
                  ) : (
                    userFilteredAndSortedTasks.map((task) => (
                      <tr key={task.id} className="hover:bg-slate-900/20 transition-all group">
                        <td className="py-3.5 px-4 text-xs font-black font-mono text-amber-500">
                          {task.taskNumber}
                        </td>
                        <td className="py-3.5 px-4 text-xs font-bold text-white max-w-xs truncate" title={task.title}>
                          {task.title}
                        </td>
                        <td className="py-3.5 px-4 text-xs font-bold font-mono text-slate-400">
                          {task.executionDate} {task.executionTime}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded-full ${getPriorityBadgeClass(task.priority)}`}>
                            {task.priority}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2 max-w-[120px]">
                            <div className="flex-1 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                                style={{ width: `${task.progress || 0}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-mono font-black text-slate-300">{task.progress || 0}%</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {renderStatusSelect(task, true)}
                        </td>
                        <td className="py-3.5 px-4">
                          {task.managerDecision ? (
                            <div className="flex flex-col gap-0.5">
                              <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded-full w-max ${
                                task.managerDecision === 'قبول' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                task.managerDecision === 'عدم قبول' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}>
                                {task.managerDecision}
                              </span>
                              {task.managerDecisionNotes && (
                                <span className="text-[10px] text-slate-400 font-bold max-w-[150px] truncate block" title={task.managerDecisionNotes}>
                                  الرد: {task.managerDecisionNotes}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-600 font-bold">قيد الانتظار</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-left">
                          <div className="flex items-center justify-end gap-1.5 opacity-90 hover:opacity-100 transition-opacity">
                            {/* زر اطلاع */}
                            <button
                              onClick={() => { setViewingTask(task); setIsViewModalOpen(true); }}
                              className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-amber-400 transition-all cursor-pointer"
                              title="اطلاع على التفاصيل الكاملة"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* زر إرفاق مستندات وتحديث */}
                            <button
                              onClick={() => handleOpenUserTaskModal(task)}
                              className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-amber-400 transition-all cursor-pointer"
                              title="إرفاق مستندات وتحديث الحالة"
                            >
                              <Paperclip className="w-3.5 h-3.5" />
                            </button>

                            {/* زر طباعة تقرير بيدي اف */}
                            <button
                              onClick={() => handlePrintTaskPdf(task)}
                              className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-amber-400 transition-all cursor-pointer"
                              title="طباعة تقرير PDF للمهمة"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>

                            {/* زر حذف */}
                            <button
                              onClick={() => handleDeleteTask(task)}
                              className="p-1.5 bg-slate-900 hover:bg-red-950/60 border border-slate-800 hover:border-red-900/50 rounded-lg text-slate-400 hover:text-red-400 transition-all cursor-pointer"
                              title="حذف المهمة"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: متابعة تنفيذ المهام */}
        {activeTab === 'execute' && (
          <div className="space-y-6">
            {/* Stats Dashboard Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Stat 1 */}
              <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-slate-500 block mb-0.5">المهام النشطة</span>
                  <span className="text-xl font-black text-white font-mono">{executeStats.active}</span>
                </div>
                <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400">
                  <Briefcase className="w-5 h-5" />
                </div>
              </div>

              {/* Stat 2 */}
              <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-slate-500 block mb-0.5">المهام المكتملة</span>
                  <span className="text-xl font-black text-emerald-400 font-mono">{executeStats.completed}</span>
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
                  <CheckCircle className="w-5 h-5" />
                </div>
              </div>

              {/* Stat 3 */}
              <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-slate-500 block mb-0.5">المهام المتأخرة</span>
                  <span className={`text-xl font-black font-mono ${executeStats.overdue > 0 ? 'text-rose-400 underline decoration-rose-500/50' : 'text-slate-400'}`}>
                    {executeStats.overdue}
                  </span>
                </div>
                <div className="p-3 bg-rose-500/10 rounded-xl text-rose-400">
                  <Clock className="w-5 h-5" />
                </div>
              </div>

              {/* Stat 4 */}
              <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-slate-500 block mb-0.5">نسبة إنجاز المؤسسة</span>
                  <span className="text-xl font-black text-amber-400 font-mono">{executeStats.avgProgress}%</span>
                </div>
                <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400">
                  <FileText className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Filter toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-950/45 p-4 rounded-2xl border border-slate-800/80 shadow-xs">
              <div className="relative w-full md:max-w-xs">
                <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                  <Search className="w-4 h-4 text-slate-500" />
                </span>
                <input
                  type="text"
                  placeholder="بحث باسم المهمة، الرقم، أو المسؤول..."
                  value={executeSearchQuery}
                  onChange={(e) => setExecuteSearchQuery(e.target.value)}
                  className="w-full pr-10 pl-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/80"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Lawyer filter */}
                <select
                  value={executeFilterUser}
                  onChange={(e) => setExecuteFilterUser(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-xs font-bold text-slate-200 outline-none cursor-pointer"
                >
                  <option value="all">كل المسؤولين</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.fullName}</option>
                  ))}
                </select>

                {/* Priority filter */}
                <select
                  value={executeFilterPriority}
                  onChange={(e) => setExecuteFilterPriority(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-xs font-bold text-slate-200 outline-none cursor-pointer"
                >
                  <option value="all">كل الأولويات</option>
                  <option value="عاجلة">عاجلة</option>
                  <option value="عالية">عالية</option>
                  <option value="متوسطة">متوسطة</option>
                  <option value="منخفضة">منخفضة</option>
                </select>

                {/* Status filter */}
                <select
                  value={executeFilterStatus}
                  onChange={(e) => setExecuteFilterStatus(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-xs font-bold text-slate-200 outline-none cursor-pointer"
                >
                  <option value="all">كل الحالات</option>
                  <option value="جديدة">جديدة</option>
                  <option value="قيد التنفيذ">قيد التنفيذ</option>
                  <option value="بانتظار مستندات">بانتظار مستندات</option>
                  <option value="بانتظار إجراء">بانتظار إجراء</option>
                  <option value="بانتظار اعتماد المدير">بانتظار اعتماد المدير</option>
                  <option value="مؤجلة">مؤجلة</option>
                  <option value="مكتملة">مكتملة</option>
                  <option value="ملغاة">ملغاة</option>
                </select>
              </div>
            </div>

            {/* Execution Table */}
            <div className="overflow-x-auto bg-slate-950/25 border border-slate-800/60 rounded-2xl">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-950/60 text-slate-400 border-b border-slate-800/80">
                    <th className="py-4 px-4 text-xs font-black">رقم المهمة</th>
                    <th className="py-4 px-4 text-xs font-black">عنوان المهمة</th>
                    <th className="py-4 px-4 text-xs font-black">المسؤول عن التنفيذ</th>
                    <th className="py-4 px-4 text-xs font-black">موعد التنفيذ</th>
                    <th className="py-4 px-4 text-xs font-black">نسبة الإنجاز</th>
                    <th className="py-4 px-4 text-xs font-black">الحالة</th>
                    <th className="py-4 px-4 text-xs font-black">قرار الاعتماد</th>
                    <th className="py-4 px-4 text-xs font-black text-left">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/50">
                  {executeFilteredAndSortedTasks.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500 font-bold text-xs">
                        <AlertCircle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                        لا توجد نتائج تطابق خيارات التصفية الحالية.
                      </td>
                    </tr>
                  ) : (
                    executeFilteredAndSortedTasks.map((task) => {
                      const assignedNames = task.assignedToName ? task.assignedToName.split('،').map(name => name.trim()) : [];
                      return (
                        <tr key={task.id} className="hover:bg-slate-900/20 transition-all group">
                          <td className="py-3.5 px-4 text-xs font-black font-mono text-amber-500">
                            {task.taskNumber}
                          </td>
                          <td className="py-3.5 px-4 text-xs font-bold text-white max-w-xs truncate" title={task.title}>
                            {task.title}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap gap-1 max-w-[150px]">
                              {assignedNames.map((name, idx) => (
                                <span key={idx} className="inline-flex items-center gap-1 bg-slate-950 border border-slate-800 text-[9px] font-bold px-2 py-0.5 rounded-full text-slate-300">
                                  {name}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-xs font-bold font-mono text-slate-400">
                            {task.executionDate} {task.executionTime}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2 max-w-[120px]">
                              <div className="flex-1 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                <div 
                                  className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                                  style={{ width: `${task.progress || 0}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-mono font-black text-slate-300">{task.progress || 0}%</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            {renderStatusSelect(task, true)}
                          </td>
                          <td className="py-3.5 px-4">
                            {task.managerDecision ? (
                              <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded-full ${
                                task.managerDecision === 'قبول' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                task.managerDecision === 'عدم قبول' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}>
                                {task.managerDecision}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-600 font-bold">قيد الانتظار</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-left">
                            <button
                              onClick={() => handleOpenManagerDecisionModal(task)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/30 text-[10px] font-black text-amber-400 rounded-lg transition-all cursor-pointer"
                            >
                              <CheckCircle className="w-3 h-3" />
                              تقييم واعتماد
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      <BaseModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="إنشاء مهمة جديدة"
        description="يرجى ملء البيانات التالية لإنشاء وإسناد المهمة"
        icon={ClipboardList}
        size="2xl"
        footerActions={
          <div className="flex gap-2">
            <SecondaryButton onClick={() => setIsCreateModalOpen(false)}>
              ❌ إلغاء
            </SecondaryButton>
            <PrimaryButton onClick={handleSaveTask}>
              💾 حفظ المهمة
            </PrimaryButton>
          </div>
        }
      >
        {isCreateModalOpen && (
          <form onSubmit={handleSaveTask} className="space-y-6 text-right">
          
          {/* بيانات المهمة */}
          <FormCard title="بيانات المهمة الأساسية" icon={ClipboardList}>
            <FormGrid cols={2}>
              <FormField label="عنوان المهمة ✏️" required>
                <input
                  type="text"
                  placeholder="مثال: تقديم مذكرة دفاع استئنافية..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/60 hover:bg-slate-50/80 border border-slate-200 border-r-3 border-r-amber-500/40 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all placeholder:text-slate-400"
                  required
                />
              </FormField>

              <FormField label="نوع المهمة 💼">
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as TaskType)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/60 hover:bg-slate-50/80 border border-slate-200 border-r-3 border-r-amber-500/40 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all cursor-pointer"
                >
                  {taskTypesList.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </FormField>
            </FormGrid>

            <FormField label="وصف المهمة بالتفصيل 📝">
              <textarea
                placeholder="اكتب تفاصيل وإرشادات المهمة هنا..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3.5 py-2.5 bg-slate-50/60 hover:bg-slate-50/80 border border-slate-200 border-r-3 border-r-amber-500/40 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all placeholder:text-slate-400"
              />
            </FormField>
          </FormCard>

          {/* ربط المهمة */}
          <FormCard title="ربط المهمة (اختياري)" icon={Building2}>
            <p className="text-[10px] text-slate-400 font-bold mb-3">يمكنك ربط هذه المهمة بقضية، شركة، أو موكل مسجل بالنظام</p>
            <FormGrid cols={3}>
              <FormField label="ربط بقضية ⚖️">
                <select
                  value={linkedCaseId}
                  onChange={(e) => setLinkedCaseId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/60 hover:bg-slate-50/80 border border-slate-200 border-r-3 border-r-amber-500/40 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all cursor-pointer"
                >
                  <option value="">بدون ربط بقضية</option>
                  {cases.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.caseNumberFirstInstance} - {c.type}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="ربط بشركة 🏢">
                <select
                  value={linkedCompanyId}
                  onChange={(e) => setLinkedCompanyId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/60 hover:bg-slate-50/80 border border-slate-200 border-r-3 border-r-amber-500/40 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all cursor-pointer"
                >
                  <option value="">بدون ربط بشركة</option>
                  {companies.map(co => (
                    <option key={co.id} value={co.id}>
                      {co.name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="ربط بموكل 👤">
                <select
                  value={linkedClientId}
                  onChange={(e) => setLinkedClientId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/60 hover:bg-slate-50/80 border border-slate-200 border-r-3 border-r-amber-500/40 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all cursor-pointer"
                >
                  <option value="">بدون ربط بموكل</option>
                  {clients.map(cl => (
                    <option key={cl.id} value={cl.id}>
                      {cl.name}
                    </option>
                  ))}
                </select>
              </FormField>
            </FormGrid>
          </FormCard>

          {/* إسناد المهمة */}
          <FormCard title="إسناد المهمة (المحامون والمستخدمون المسؤولون)" icon={UserIcon}>
            <p className="text-[10px] text-slate-400 font-bold mb-3">يمكنك اختيار محامي واحد أو إسنادها لعدة محامين ومستخدمين معاً</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-44 overflow-y-auto p-2 border border-slate-100 rounded-xl bg-slate-50/50">
              {users.map(u => {
                const isSelected = assignedUserIds.includes(u.id);
                return (
                  <label
                    key={u.id}
                    onClick={() => handleToggleUserSelection(u.id)}
                    className={`flex items-center gap-2.5 p-2.5 border rounded-xl cursor-pointer select-none transition-all ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500/50 text-slate-900 font-black'
                        : 'bg-white border-slate-150 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                      isSelected ? 'bg-amber-500 border-amber-500 text-slate-950' : 'border-slate-300'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span className="text-[11px] leading-tight">{u.fullName}</span>
                  </label>
                );
              })}
            </div>
          </FormCard>

          {/* الموعد */}
          <FormCard title="موعد التنفيذ والأولوية والحالة" icon={Calendar}>
            <FormGrid cols={2}>
              <FormField label="تاريخ التنفيذ 📅">
                <input
                  type="date"
                  value={executionDate}
                  onChange={(e) => setExecutionDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/60 hover:bg-slate-50/80 border border-slate-200 border-r-3 border-r-amber-500/40 rounded-xl text-xs font-bold font-mono text-slate-800 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all"
                />
              </FormField>

              <FormField label="وقت التنفيذ ⏰">
                <input
                  type="time"
                  value={executionTime}
                  onChange={(e) => setExecutionTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/60 hover:bg-slate-50/80 border border-slate-200 border-r-3 border-r-amber-500/40 rounded-xl text-xs font-bold font-mono text-slate-800 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all"
                />
              </FormField>

              <FormField label="أولوية المهمة 🎯">
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/60 hover:bg-slate-50/80 border border-slate-200 border-r-3 border-r-amber-500/40 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all cursor-pointer"
                >
                  <option value="منخفضة">منخفضة</option>
                  <option value="متوسطة">متوسطة</option>
                  <option value="عالية">عالية</option>
                  <option value="عاجلة">عاجلة</option>
                </select>
              </FormField>

              <FormField label="حالة المهمة ⚙️">
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as TaskStatus)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/60 hover:bg-slate-50/80 border border-slate-200 border-r-3 border-r-amber-500/40 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all cursor-pointer"
                >
                  <option value="جديدة">جديدة 🆕</option>
                  <option value="قيد التنفيذ">قيد التنفيذ ⚙️</option>
                  <option value="بانتظار مستندات">بانتظار مستندات 📄</option>
                  <option value="بانتظار إجراء">بانتظار إجراء ⏳</option>
                  <option value="بانتظار اعتماد المدير">بانتظار اعتماد المدير 👔</option>
                  <option value="مؤجلة">مؤجلة 📅</option>
                  <option value="مكتملة">مكتملة ✅</option>
                  <option value="ملغاة">ملغاة ❌</option>
                </select>
              </FormField>
            </FormGrid>
          </FormCard>

          {/* المرفقات */}
          <FormCard title="المستندات والمرفقات الرسمية للمهمة" icon={Paperclip}>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-4">
              <MultiUploadManager
                categories={['عقد تأسيس', 'سجل تجاري', 'مستند قضائي', 'توكيل قانوني', 'أخرى']}
                defaultCategory="مستند قضائي"
                uploaderName={currentUser.fullName}
                onFilesUploaded={(uploadedFiles) => {
                  setTaskAttachments(prev => {
                    const mapped = uploadedFiles.map(f => ({
                      id: f.id,
                      name: f.name,
                      type: f.type === 'word' ? 'Word' : f.type === 'pdf' ? 'PDF' : 'صورة' as any,
                      uploadDate: f.uploadDate,
                      uploadedBy: f.uploadedBy || currentUser.fullName,
                      fileUrl: f.fileUrl,
                      size: f.size
                    }));
                    return [...prev, ...mapped];
                  });
                }}
              />

              {/* Uploaded Attachments List */}
              {taskAttachments.length > 0 && (
                <div className="border-t border-slate-200/60 pt-3">
                  <h6 className="text-[10px] font-black text-slate-800 mb-2">المرفقات والمستندات الحالية:</h6>
                  <div className="space-y-2">
                    {taskAttachments.map((att) => (
                      <div key={att.id} className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 shadow-xs">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-amber-500" />
                          <div>
                            <span className="text-[11px] font-bold text-slate-800 block">{att.name}</span>
                            <span className="text-[9px] text-slate-400 font-semibold font-mono">
                              ({att.type}) - {att.size} • رفع بواسطة {att.uploadedBy}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleViewAttachmentFile(att)}
                            className="p-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-slate-500 hover:text-amber-500 transition-all cursor-pointer"
                            title="عرض المستند"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveAttachment(att.id)}
                            className="p-1 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded text-slate-500 hover:text-red-500 transition-all cursor-pointer"
                            title="إزالة المرفق"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </FormCard>

          {/* الملاحظات */}
          <FormCard title="الملاحظات والتوجيهات الإضافية" icon={FileText}>
            <FormField label="ملاحظات وتوصيات للمهمة 🗒️">
              <textarea
                placeholder="اكتب أي ملاحظات أو شروط خاصة هنا للتنفيذ..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:border-amber-500 outline-none placeholder:text-slate-400"
              />
            </FormField>
          </FormCard>

        </form>
        )}
      </BaseModal>

      {/* EDIT MODAL */}
      <BaseModal
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setEditingTask(null); }}
        title={`تعديل المهمة: ${editingTask?.taskNumber || ''}`}
        description="يرجى تعديل بيانات المهمة وحفظ التغييرات"
        icon={Edit}
        size="2xl"
        footerActions={
          <div className="flex gap-2">
            <SecondaryButton onClick={() => { setIsEditModalOpen(false); setEditingTask(null); }}>
              ❌ إلغاء
            </SecondaryButton>
            <PrimaryButton onClick={handleUpdateTask}>
              💾 حفظ التغييرات
            </PrimaryButton>
          </div>
        }
      >
        {isEditModalOpen && (
          <form onSubmit={handleUpdateTask} className="space-y-6 text-right">
          
          {/* بيانات المهمة */}
          <FormCard title="بيانات المهمة الأساسية" icon={ClipboardList}>
            <FormGrid cols={2}>
              <FormField label="عنوان المهمة ✏️" required>
                <input
                  type="text"
                  placeholder="مثال: تقديم مذكرة دفاع استئنافية..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/60 hover:bg-slate-50/80 border border-slate-200 border-r-3 border-r-amber-500/40 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all placeholder:text-slate-400"
                  required
                />
              </FormField>

              <FormField label="نوع المهمة 💼">
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as TaskType)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/60 hover:bg-slate-50/80 border border-slate-200 border-r-3 border-r-amber-500/40 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all cursor-pointer"
                >
                  {taskTypesList.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </FormField>
            </FormGrid>

            <FormField label="وصف المهمة بالتفصيل 📝">
              <textarea
                placeholder="اكتب تفاصيل وإرشادات المهمة هنا..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3.5 py-2.5 bg-slate-50/60 hover:bg-slate-50/80 border border-slate-200 border-r-3 border-r-amber-500/40 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all placeholder:text-slate-400"
              />
            </FormField>
          </FormCard>

          {/* ربط المهمة */}
          <FormCard title="ربط المهمة (اختياري)" icon={Building2}>
            <p className="text-[10px] text-slate-400 font-bold mb-3">يمكنك ربط هذه المهمة بقضية، شركة، أو موكل مسجل بالنظام</p>
            <FormGrid cols={3}>
              <FormField label="ربط بقضية ⚖️">
                <select
                  value={linkedCaseId}
                  onChange={(e) => setLinkedCaseId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/60 hover:bg-slate-50/80 border border-slate-200 border-r-3 border-r-amber-500/40 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all cursor-pointer"
                >
                  <option value="">بدون ربط بقضية</option>
                  {cases.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.caseNumberFirstInstance} - {c.type}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="ربط بشركة 🏢">
                <select
                  value={linkedCompanyId}
                  onChange={(e) => setLinkedCompanyId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/60 hover:bg-slate-50/80 border border-slate-200 border-r-3 border-r-amber-500/40 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all cursor-pointer"
                >
                  <option value="">بدون ربط بشركة</option>
                  {companies.map(co => (
                    <option key={co.id} value={co.id}>
                      {co.name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="ربط بموكل 👤">
                <select
                  value={linkedClientId}
                  onChange={(e) => setLinkedClientId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/60 hover:bg-slate-50/80 border border-slate-200 border-r-3 border-r-amber-500/40 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all cursor-pointer"
                >
                  <option value="">بدون ربط بموكل</option>
                  {clients.map(cl => (
                    <option key={cl.id} value={cl.id}>
                      {cl.name}
                    </option>
                  ))}
                </select>
              </FormField>
            </FormGrid>
          </FormCard>

          {/* إسناد المهمة */}
          <FormCard title="إسناد المهمة (المحامون والمستخدمون المسؤولون)" icon={UserIcon}>
            <p className="text-[10px] text-slate-400 font-bold mb-3">يمكنك اختيار محامي واحد أو إسنادها لعدة محامين ومستخدمين معاً</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-44 overflow-y-auto p-2 border border-slate-100 rounded-xl bg-slate-50/50">
              {users.map(u => {
                const isSelected = assignedUserIds.includes(u.id);
                return (
                  <label
                    key={u.id}
                    onClick={() => handleToggleUserSelection(u.id)}
                    className={`flex items-center gap-2.5 p-2.5 border rounded-xl cursor-pointer select-none transition-all ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500/50 text-slate-900 font-black'
                        : 'bg-white border-slate-150 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                      isSelected ? 'bg-amber-500 border-amber-500 text-slate-950' : 'border-slate-300'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span className="text-[11px] leading-tight">{u.fullName}</span>
                  </label>
                );
              })}
            </div>
          </FormCard>

          {/* الموعد */}
          <FormCard title="موعد التنفيذ والأولوية والحالة" icon={Calendar}>
            <FormGrid cols={2}>
              <FormField label="تاريخ التنفيذ 📅">
                <input
                  type="date"
                  value={executionDate}
                  onChange={(e) => setExecutionDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/60 hover:bg-slate-50/80 border border-slate-200 border-r-3 border-r-amber-500/40 rounded-xl text-xs font-bold font-mono text-slate-800 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all"
                />
              </FormField>

              <FormField label="وقت التنفيذ ⏰">
                <input
                  type="time"
                  value={executionTime}
                  onChange={(e) => setExecutionTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/60 hover:bg-slate-50/80 border border-slate-200 border-r-3 border-r-amber-500/40 rounded-xl text-xs font-bold font-mono text-slate-800 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all"
                />
              </FormField>

              <FormField label="أولوية المهمة 🎯">
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/60 hover:bg-slate-50/80 border border-slate-200 border-r-3 border-r-amber-500/40 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all cursor-pointer"
                >
                  <option value="منخفضة">منخفضة</option>
                  <option value="متوسطة">متوسطة</option>
                  <option value="عالية">عالية</option>
                  <option value="عاجلة">عاجلة</option>
                </select>
              </FormField>

              <FormField label="حالة المهمة ⚙️">
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as TaskStatus)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/60 hover:bg-slate-50/80 border border-slate-200 border-r-3 border-r-amber-500/40 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all cursor-pointer"
                >
                  <option value="جديدة">جديدة 🆕</option>
                  <option value="قيد التنفيذ">قيد التنفيذ ⚙️</option>
                  <option value="بانتظار مستندات">بانتظار مستندات 📄</option>
                  <option value="بانتظار إجراء">بانتظار إجراء ⏳</option>
                  <option value="بانتظار اعتماد المدير">بانتظار اعتماد المدير 👔</option>
                  <option value="مؤجلة">مؤجلة 📅</option>
                  <option value="مكتملة">مكتملة ✅</option>
                  <option value="ملغاة">ملغاة ❌</option>
                </select>
              </FormField>
            </FormGrid>
          </FormCard>

          {/* المرفقات */}
          <FormCard title="المستندات والمرفقات الرسمية للمهمة" icon={Paperclip}>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-4">
              <MultiUploadManager
                categories={['عقد تأسيس', 'سجل تجاري', 'مستند قضائي', 'توكيل قانوني', 'أخرى']}
                defaultCategory="مستند قضائي"
                uploaderName={currentUser.fullName}
                onFilesUploaded={(uploadedFiles) => {
                  setTaskAttachments(prev => {
                    const mapped = uploadedFiles.map(f => ({
                      id: f.id,
                      name: f.name,
                      type: f.type === 'word' ? 'Word' : f.type === 'pdf' ? 'PDF' : 'صورة' as any,
                      uploadDate: f.uploadDate,
                      uploadedBy: f.uploadedBy || currentUser.fullName,
                      fileUrl: f.fileUrl,
                      size: f.size
                    }));
                    return [...prev, ...mapped];
                  });
                }}
              />

              {/* Uploaded Attachments List */}
              {taskAttachments.length > 0 && (
                <div className="border-t border-slate-200/60 pt-3">
                  <h6 className="text-[10px] font-black text-slate-800 mb-2">المرفقات والمستندات الحالية:</h6>
                  <div className="space-y-2">
                    {taskAttachments.map((att) => (
                      <div key={att.id} className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 shadow-xs">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-amber-500" />
                          <div>
                            <span className="text-[11px] font-bold text-slate-800 block">{att.name}</span>
                            <span className="text-[9px] text-slate-400 font-semibold font-mono">
                              ({att.type}) - {att.size} • رفع بواسطة {att.uploadedBy}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleViewAttachmentFile(att)}
                            className="p-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-slate-500 hover:text-amber-500 transition-all cursor-pointer"
                            title="عرض المستند"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveAttachment(att.id)}
                            className="p-1 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded text-slate-500 hover:text-red-500 transition-all cursor-pointer"
                            title="إزالة المرفق"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </FormCard>

          {/* الملاحظات */}
          <FormCard title="الملاحظات والتوجيهات الإضافية" icon={FileText}>
            <FormField label="ملاحظات وتوصيات للمهمة 🗒️">
              <textarea
                placeholder="اكتب أي ملاحظات أو شروط خاصة هنا للتنفيذ..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:border-amber-500 outline-none"
              />
            </FormField>
          </FormCard>

        </form>
        )}
      </BaseModal>

      {/* VIEW MODAL */}
      <BaseModal
        isOpen={isViewModalOpen}
        onClose={() => { setIsViewModalOpen(false); setViewingTask(null); }}
        title={`تفاصيل المهمة: ${viewingTask?.taskNumber || ''}`}
        description="تفاصيل كاملة حول المهمة المسندة وملحقاتها والموعد المطلوب"
        icon={ClipboardList}
        size="lg"
        footerActions={
          <SecondaryButton onClick={() => { setIsViewModalOpen(false); setViewingTask(null); }}>
            إغلاق النافذة
          </SecondaryButton>
        }
      >
        {viewingTask && (
          <div className="space-y-5 text-right">
            
            {/* Title, type & priority header card */}
            <div className="bg-slate-50 border border-slate-150 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-black text-amber-600 block mb-1">
                  {viewingTask.type} • رقم {viewingTask.taskNumber}
                </span>
                <h4 className="text-sm font-black text-slate-900 leading-tight">
                  {viewingTask.title}
                </h4>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <span className={`text-[9px] font-black px-3 py-1 rounded-full ${getPriorityBadgeClass(viewingTask.priority)}`}>
                  الأولوية: {viewingTask.priority}
                </span>
                <span className={`text-[9px] font-black px-3 py-1 rounded-full ${getStatusBadgeClass(viewingTask.status)}`}>
                  الحالة: {viewingTask.status}
                </span>
              </div>
            </div>

            {/* Detailed Description */}
            {viewingTask.description && (
              <div className="p-4 bg-white border border-slate-100 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 block mb-1">وصف المهمة بالتفصيل:</span>
                <p className="text-xs text-slate-700 font-semibold leading-relaxed whitespace-pre-wrap">
                  {viewingTask.description}
                </p>
              </div>
            )}

            {/* Execution Schedule */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 flex items-center gap-2.5">
                <Calendar className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block">تاريخ التنفيذ المطلوبة</span>
                  <span className="text-xs font-mono font-black text-slate-800">{viewingTask.executionDate}</span>
                </div>
              </div>
              <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block">وقت التنفيذ المطلوب</span>
                  <span className="text-xs font-mono font-black text-slate-800">{viewingTask.executionTime}</span>
                </div>
              </div>
            </div>

            {/* Assigned Users list */}
            <div className="p-4 bg-white border border-slate-100 rounded-xl">
              <span className="text-[10px] font-bold text-slate-400 block mb-2">المحامون والمستخدمون المسؤولون عن التنفيذ:</span>
              <div className="flex flex-wrap gap-2">
                {viewingTask.assignedToName?.split('،').map((name, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200">
                    <UserIcon className="w-3.5 h-3.5 text-amber-500" />
                    {name.trim()}
                  </span>
                ))}
              </div>
            </div>

            {/* Optional Links info */}
            {(viewingTask.caseNumber || viewingTask.companyName || viewingTask.clientName) && (
              <div className="p-4 bg-slate-50/40 border border-slate-100 rounded-xl space-y-2.5">
                <span className="text-[10px] font-bold text-slate-400 block">العناصر المرتبطة بالمهمة:</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {viewingTask.caseNumber && (
                    <div className="bg-white p-2 rounded-lg border border-slate-150 text-right">
                      <span className="text-[9px] text-slate-400 font-bold block">رقم القضية المرتبطة</span>
                      <span className="text-[11px] font-black font-mono text-slate-800">{viewingTask.caseNumber}</span>
                    </div>
                  )}
                  {viewingTask.companyName && (
                    <div className="bg-white p-2 rounded-lg border border-slate-150 text-right">
                      <span className="text-[9px] text-slate-400 font-bold block">الشركة المرتبطة</span>
                      <span className="text-[11px] font-black text-slate-800">{viewingTask.companyName}</span>
                    </div>
                  )}
                  {viewingTask.clientName && (
                    <div className="bg-white p-2 rounded-lg border border-slate-150 text-right">
                      <span className="text-[9px] text-slate-400 font-bold block">الموكل المرتبط</span>
                      <span className="text-[11px] font-black text-slate-800">{viewingTask.clientName}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Attachments Section */}
            {viewingTask.attachments && viewingTask.attachments.length > 0 && (
              <div className="p-4 bg-white border border-slate-100 rounded-xl space-y-2.5">
                <span className="text-[10px] font-bold text-slate-400 block">المرفقات والمستندات الرسمية:</span>
                <div className="space-y-2">
                  {viewingTask.attachments.map((att) => (
                    <div key={att.id} className="flex items-center justify-between p-2 rounded-lg border border-slate-150 bg-slate-50/50">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-amber-500" />
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">{att.name}</span>
                          <span className="text-[9px] text-slate-400 font-semibold font-mono">
                            ({att.type}) - {att.size} • رفع بواسطة {att.uploadedBy}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleViewAttachmentFile(att)}
                        className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[10px] py-1.5 px-3.5 rounded-lg flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        عرض المستند
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Manager Decision Section */}
            {viewingTask.managerDecision && (
              <div className={`p-4 rounded-xl border ${
                viewingTask.managerDecision === 'قبول' ? 'bg-emerald-500/5 border-emerald-500/10' :
                viewingTask.managerDecision === 'عدم قبول' ? 'bg-rose-500/5 border-rose-500/10' :
                'bg-amber-500/5 border-amber-500/10'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-slate-800">قرار واعتماد الإدارة للمهمة 👔</span>
                    {viewingTask.managerDecisionDate && (
                      <span className="text-[9px] font-mono font-black text-slate-500">({viewingTask.managerDecisionDate})</span>
                    )}
                  </div>
                  <span className={`text-[9px] font-black px-2.5 py-1 rounded-full ${
                    viewingTask.managerDecision === 'قبول' ? 'bg-emerald-500/20 text-emerald-600 border border-emerald-500/30' :
                    viewingTask.managerDecision === 'عدم قبول' ? 'bg-rose-500/20 text-red-600 border border-rose-500/30' :
                    'bg-amber-500/20 text-amber-600 border border-amber-500/30'
                  }`}>
                    {viewingTask.managerDecision}
                  </span>
                </div>
                {viewingTask.managerDecisionNotes && (
                  <div className="bg-slate-900/5 p-3 rounded-lg border border-slate-900/5 text-slate-700 font-semibold text-xs leading-relaxed whitespace-pre-wrap">
                    <span className="font-bold text-slate-800 block mb-1">الرد والتوجيه الإداري:</span>
                    {viewingTask.managerDecisionNotes}
                  </div>
                )}
              </div>
            )}

            {/* Notes Section */}
            {viewingTask.notes && (
              <div className="p-4 bg-amber-50/10 border border-amber-500/10 rounded-xl">
                <span className="text-[10px] font-bold text-amber-600 block mb-1">ملاحظات وتوجيهات وتوصيات إضافية:</span>
                <p className="text-xs text-slate-700 font-semibold leading-relaxed whitespace-pre-wrap">
                  {viewingTask.notes}
                </p>
              </div>
            )}

          </div>
        )}
      </BaseModal>

      {/* USER TASK UPDATE MODAL */}
      <BaseModal
        isOpen={isUserTaskModalOpen}
        onClose={() => { setIsUserTaskModalOpen(false); setUserViewingTask(null); }}
        title={`متابعة وتنفيذ المهمة: ${userViewingTask?.taskNumber || ''}`}
        description="تحديث حالة المتابعة، رفع المستندات والتقارير التنفيذية، وإخطار الإدارة للمراجعة"
        icon={Briefcase}
        size="2xl"
        footerActions={
          <div className="flex flex-col sm:flex-row justify-between items-center w-full gap-3 bg-slate-50 p-1 rounded-xl">
             {/* Left cancellation side */}
             <div className="flex gap-2">
               <SecondaryButton 
                 onClick={() => { setIsUserTaskModalOpen(false); setUserViewingTask(null); }}
                 disabled={isSavingUserEdits}
               >
                 ❌ إلغاء وإغلاق
               </SecondaryButton>
               <button
                 type="button"
                 onClick={() => handlePrintTaskPdf(userViewingTask)}
                 className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-400 font-black text-xs rounded-xl transition-all cursor-pointer active:scale-95"
                 title="طباعة تقرير PDF للمهمة"
               >
                 <FileText className="w-3.5 h-3.5 text-amber-400" />
                 <span>🖨️ طباعة تقرير PDF</span>
               </button>
             </div>

            {/* Right main save triggers */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => saveTaskWithUpdates(false)}
                disabled={isSavingUserEdits}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-200 hover:bg-slate-300 active:scale-95 text-slate-800 font-black text-xs rounded-xl border border-slate-300 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSavingUserEdits ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-500" />
                ) : (
                  <span>💾 حفظ التحديث كمسودة</span>
                )}
              </button>
              
              <button
                type="button"
                onClick={() => saveTaskWithUpdates(true)}
                disabled={isSavingUserEdits}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-xl shadow-md border border-amber-500 hover:border-amber-600 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {isSavingUserEdits ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                ) : (
                  <>
                    <span>🚀 إرسال إلى قسم متابعة المهام</span>
                  </>
                )}
              </button>
            </div>
          </div>
        }
      >
        {userViewingTask && (
          <div className="space-y-6 text-right" dir="rtl">
            {/* ALERT BANNER: MANAGER DECISION */}
            {userViewingTask.managerDecision && (
              <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
                userViewingTask.managerDecision === 'قبول' ? 'bg-emerald-500/5 border-emerald-500/15 text-slate-800' :
                userViewingTask.managerDecision === 'عدم قبول' ? 'bg-rose-500/5 border-rose-500/15 text-slate-800' :
                'bg-amber-500/5 border-amber-500/15 text-slate-800'
              }`}>
                <div className={`p-2 rounded-xl shrink-0 ${
                  userViewingTask.managerDecision === 'قبول' ? 'bg-emerald-500/10 text-emerald-600' :
                  userViewingTask.managerDecision === 'عدم قبول' ? 'bg-rose-500/10 text-rose-600' :
                  'bg-amber-500/10 text-amber-600'
                }`}>
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="space-y-1 w-full">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black">قرار واعتماد المدير السابق للمهمة:</span>
                    <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded-full ${
                      userViewingTask.managerDecision === 'قبول' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' :
                      userViewingTask.managerDecision === 'عدم قبول' ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' :
                      'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                    }`}>
                      {userViewingTask.managerDecision}
                    </span>
                    {userViewingTask.managerDecisionDate && (
                      <span className="text-[9px] font-mono font-bold text-slate-500">تاريخ القرار: {userViewingTask.managerDecisionDate}</span>
                    )}
                  </div>
                  {userViewingTask.managerDecisionNotes && (
                    <p className="text-xs text-slate-700 font-semibold bg-white/60 p-2.5 rounded-xl border border-slate-100 mt-1 leading-relaxed">
                      <span className="font-bold text-slate-800 block mb-0.5">الرد والتوجيه الإداري:</span>
                      {userViewingTask.managerDecisionNotes}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* MAIN CONTAINER GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* RIGHT HAND COLUMN: MAIN FORM CONTROLS (8 cols) */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* CARD 1: MAIN METRICS UPDATER */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                    <Edit className="w-5 h-5 text-amber-500" />
                    <h3 className="text-xs font-black text-slate-800">بيانات التحديث والمتابعة الحالية</h3>
                  </div>

                  <FormGrid cols={2}>
                    {/* Status select input */}
                    <FormField label="حالة المهمة الحالية ⚙️">
                      <select
                        value={userTaskStatus}
                        onChange={(e) => {
                          const val = e.target.value as TaskStatus;
                          setUserTaskStatus(val);
                          if (val === 'مكتملة') {
                            setUserTaskProgress(100);
                          }
                        }}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-amber-500 outline-none cursor-pointer transition-all"
                      >
                        <option value="جديدة">جديدة 🆕</option>
                        <option value="قيد التنفيذ">قيد التنفيذ ⚙️</option>
                        <option value="بانتظار مستندات">بانتظار مستندات 📄</option>
                        <option value="بانتظار إجراء">بانتظار إجراء ⏳</option>
                        <option value="بانتظار اعتماد المدير">بانتظار اعتماد المدير 👔</option>
                        <option value="مؤجلة">مؤجلة 📅</option>
                        <option value="مكتملة">مكتملة ✅</option>
                        <option value="ملغاة">ملغاة ❌</option>
                      </select>
                    </FormField>

                    {/* Dynamic progress slider */}
                    <FormField label={`نسبة الإنجاز الحالية: ${userTaskProgress}% 📊`}>
                      <div className="space-y-2 mt-1 bg-slate-50 p-2 rounded-xl border border-slate-150">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={userTaskProgress}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setUserTaskProgress(val);
                            if (val === 100) {
                              setUserTaskStatus('مكتملة');
                            } else if (val > 0 && userTaskStatus === 'جديدة') {
                              setUserTaskStatus('قيد التنفيذ');
                            }
                          }}
                          className="w-full accent-amber-500 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-[9px] text-slate-400 font-bold px-1">
                          <span>0%</span>
                          <span className={`${userTaskProgress >= 50 ? 'text-amber-600 font-black' : ''}`}>50%</span>
                          <span className={`${userTaskProgress === 100 ? 'text-emerald-600 font-black' : ''}`}>100%</span>
                        </div>
                      </div>
                    </FormField>
                  </FormGrid>

                  <FormGrid cols={2}>
                    {/* Date picker */}
                    <FormField label="تاريخ التنفيذ المتوقع 📅">
                      <input
                        type="date"
                        value={userTaskDate}
                        onChange={(e) => setUserTaskDate(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono text-slate-800 focus:bg-white focus:border-amber-500 outline-none transition-all"
                      />
                    </FormField>

                    {/* Time picker */}
                    <FormField label="وقت التنفيذ المتوقع ⏰">
                      <input
                        type="time"
                        value={userTaskTime}
                        onChange={(e) => setUserTaskTime(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono text-slate-800 focus:bg-white focus:border-amber-500 outline-none transition-all"
                      />
                    </FormField>
                  </FormGrid>
                </div>

                {/* CARD 2: NEW UPDATE TEXT AREA WITH RICH TOOLBAR */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-amber-500" />
                      <h3 className="text-xs font-black text-slate-800">تقرير الإنجاز والتحديث المكتوب</h3>
                    </div>
                    {/* Character limit badge */}
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${userTaskNotes.length > 1500 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                      {userTaskNotes.length} / 2000 حرف
                    </span>
                  </div>

                  {/* Formatting toolbar */}
                  <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-50 border border-slate-150 rounded-xl">
                    <button
                      type="button"
                      onClick={() => insertUserTextAtCursor('bold')}
                      title="خط عريض"
                      className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-all cursor-pointer"
                    >
                      <Bold className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertUserTextAtCursor('italic')}
                      title="خط مائل"
                      className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-all cursor-pointer"
                    >
                      <Italic className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertUserTextAtCursor('list')}
                      title="قائمة نقطية"
                      className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-all cursor-pointer"
                    >
                      <List className="w-4 h-4" />
                    </button>
                    
                    <div className="h-4 w-px bg-slate-300 mx-1" />

                    <button
                      type="button"
                      onClick={() => insertUserTextAtCursor('clear')}
                      className="text-[10px] font-bold text-red-500 hover:text-red-700 px-2 py-1 hover:bg-red-50 rounded-lg transition-all cursor-pointer mr-auto"
                    >
                      🗑️ مسح النص
                    </button>
                  </div>

                  <textarea
                    id="user-task-notes-textarea"
                    placeholder="اكتب هنا التحديث الجديد بالتفصيل وملاحظات الإجراء المنفذ أو المعوقات..."
                    value={userTaskNotes}
                    onChange={(e) => {
                      if (e.target.value.length <= 2000) {
                        setUserTaskNotes(e.target.value);
                      }
                    }}
                    rows={4}
                    className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-amber-500 outline-none leading-relaxed"
                  />
                </div>

                {/* CARD 3: ATTACHMENTS & DRAG DROP ZONE */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Paperclip className="w-5 h-5 text-amber-500" />
                      <h3 className="text-xs font-black text-slate-800">إرفاق المستندات وملفات الثبوتية</h3>
                    </div>
                  </div>

                  <MultiUploadManager
                    categories={['عقد تأسيس', 'سجل تجاري', 'مستند قضائي', 'توكيل قانوني', 'أخرى']}
                    defaultCategory="أخرى"
                    uploaderName={currentUser.fullName}
                    onFilesUploaded={(uploadedFiles) => {
                      setUserNewAttachmentsList(prev => {
                        const mapped = uploadedFiles.map(f => ({
                          id: f.id,
                          name: f.name,
                          type: f.type === 'word' ? 'Word' : f.type === 'pdf' ? 'PDF' : 'صورة' as any,
                          uploadDate: f.uploadDate,
                          uploadedBy: f.uploadedBy || currentUser.fullName,
                          fileUrl: f.fileUrl,
                          size: f.size
                        }));
                        return [...prev, ...mapped];
                      });
                    }}
                  />

                  {/* Dynamic Files List: Split Existing & Staged */}
                  {(userExistingAttachments.length > 0 || userNewAttachmentsList.length > 0) && (
                    <div className="space-y-3 pt-2">
                      
                      {/* Section: Staged/New list */}
                      {userNewAttachmentsList.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-[10px] font-black text-amber-600 block">📎 مستندات مرفقة جديدة للتحديث الحالي:</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {userNewAttachmentsList.map((att) => (
                              <div key={att.id} className="p-3 bg-emerald-50/10 border border-emerald-500/10 rounded-xl flex items-center justify-between">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
                                  <div className="min-w-0">
                                    <span className="text-xs font-black text-slate-800 block truncate">{att.name}</span>
                                    <span className="text-[9px] text-slate-400 font-bold font-mono">({att.type}) • {att.size}</span>
                                  </div>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleViewAttachmentFile(att)}
                                    title="معاينة"
                                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-all cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveNewUserAttachment(att.id)}
                                    title="حذف المرفق"
                                    className="p-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition-all cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Section: Existing attachments */}
                      {userExistingAttachments.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-[10px] font-black text-slate-400 block">📁 مستندات المهمة السابقة الحالية:</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {userExistingAttachments.map((att) => (
                              <div key={att.id} className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <FileText className="w-4 h-4 text-amber-500 shrink-0" />
                                  <div className="min-w-0">
                                    <span className="text-xs font-bold text-slate-800 block truncate">{att.name}</span>
                                    <span className="text-[9px] text-slate-400 font-bold font-mono">({att.type}) • {att.size}</span>
                                  </div>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleViewAttachmentFile(att)}
                                    title="معاينة"
                                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-all cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const link = document.createElement('a');
                                      link.href = att.fileUrl;
                                      link.download = att.name;
                                      link.target = '_blank';
                                      document.body.appendChild(link);
                                      link.click();
                                      document.body.removeChild(link);
                                    }}
                                    title="تنزيل المستند"
                                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-all cursor-pointer"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </button>
                                  {(currentUser.role === 'admin' || !!currentUser.permissions.deleteDoc) && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveExistingUserAttachment(att.id)}
                                      title="حذف من المهمة"
                                      className="p-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition-all cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>

              {/* LEFT HAND COLUMN: TASK META CARD & TIMELINE HISTORY (4 cols) */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* METADATA SUMMARY CARD */}
                <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-md border border-slate-850 space-y-4">
                  <div className="pb-3 border-b border-slate-800">
                    <span className="text-[9px] font-black tracking-widest text-amber-500 block mb-1">بيانات المهمة الأساسية</span>
                    <h3 className="text-sm font-black text-slate-100 leading-snug">{userViewingTask.title}</h3>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-bold">نوع المهمة:</span>
                      <span className="bg-slate-800 text-amber-400 font-black px-2.5 py-1 rounded-lg text-[10px]">{userViewingTask.type}</span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-bold">الحالة الحالية:</span>
                      <span className="bg-amber-500/10 text-amber-400 font-black px-2.5 py-1 rounded-lg text-[10px]">{userViewingTask.status}</span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-bold">الأولوية:</span>
                      <span className={`font-black px-2.5 py-1 rounded-lg text-[10px] ${
                        userViewingTask.priority === 'عاجلة' ? 'bg-red-500/20 text-red-400' :
                        userViewingTask.priority === 'عالية' ? 'bg-orange-500/20 text-orange-400' :
                        'bg-slate-800 text-slate-300'
                      }`}>{userViewingTask.priority}</span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-bold">تاريخ الإنشاء:</span>
                      <span className="font-mono text-slate-300 text-[11px] font-black">{userViewingTask.createdAt || 'غير محدد'}</span>
                    </div>

                    {userViewingTask.dueDate && (
                      <div className="flex justify-between items-center text-xs border-t border-slate-800/60 pt-2">
                        <span className="text-slate-400 font-bold">تاريخ الاستحقاق:</span>
                        <span className="font-mono text-red-400 text-[11px] font-black">{userViewingTask.dueDate}</span>
                      </div>
                    )}
                  </div>

                  {userViewingTask.description && (
                    <div className="bg-slate-850 p-3 rounded-xl text-[11px] text-slate-300 leading-relaxed font-semibold border border-slate-800/80">
                      <span className="text-[9px] text-slate-500 block mb-0.5 font-bold">الوصف الإرشادي:</span>
                      {userViewingTask.description}
                    </div>
                  )}
                </div>

                {/* TIMELINE HISTORY CARD */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4 max-h-[480px] overflow-y-auto">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100 shrink-0">
                    <History className="w-5 h-5 text-amber-500" />
                    <h3 className="text-xs font-black text-slate-800">سجل التحديثات والمتابعة السابقة</h3>
                  </div>

                  {(!userViewingTask.followUps || userViewingTask.followUps.length === 0) ? (
                    <div className="text-center py-8 text-slate-400">
                      <span className="text-2xl block mb-2">🗒️</span>
                      <p className="text-[10px] font-bold">لا يوجد سجل متابعة لهذه المهمة حتى الآن.</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">ابدأ بكتابة تحديث وحفظه لإنشاء السجل.</p>
                    </div>
                  ) : (
                    <div className="relative pr-4 border-r-2 border-slate-100 space-y-6 py-2">
                      {userViewingTask.followUps.map((item, index) => (
                        <div key={item.id || index} className="relative">
                          {/* Timeline dot marker */}
                          <div className="absolute -right-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-white ring-4 ring-amber-100 shrink-0" />
                          
                          {/* Timeline Card content */}
                          <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 space-y-2 text-right">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="font-black text-slate-800">{item.username}</span>
                              <div className="flex items-center gap-1.5 text-slate-400 font-bold font-mono">
                                <span>{item.date}</span>
                                <span>{item.time}</span>
                              </div>
                            </div>

                            <span className="text-[9px] font-black text-amber-600 block bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 w-fit">
                              {item.action}
                            </span>

                            {item.notes && (
                              <p className="text-[11px] text-slate-600 leading-relaxed font-semibold whitespace-pre-wrap pt-1 border-t border-slate-100">
                                {item.notes}
                              </p>
                            )}

                            {/* Attachments for this specific update */}
                            {item.attachments && item.attachments.length > 0 && (
                              <div className="space-y-1 pt-1.5 border-t border-slate-100/60">
                                <span className="text-[8px] font-bold text-slate-400 block">المستندات المرفقة مع هذا الإجراء:</span>
                                <div className="flex flex-wrap gap-1">
                                  {item.attachments.map((file) => (
                                    <button
                                      key={file.id}
                                      type="button"
                                      onClick={() => handleViewAttachmentFile(file)}
                                      className="inline-flex items-center gap-1 bg-white border border-slate-200 hover:border-amber-400 text-[9px] font-bold text-slate-700 px-2 py-1 rounded transition-all cursor-pointer"
                                    >
                                      <FileText className="w-2.5 h-2.5 text-amber-500" />
                                      <span className="max-w-[120px] truncate">{file.name}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

            </div>
          </div>
        )}
      </BaseModal>

      {/* MANAGER DECISION MODAL */}
      <BaseModal
        isOpen={isManagerDecisionModalOpen}
        onClose={() => { setIsManagerDecisionModalOpen(false); setManagerDecisionTask(null); }}
        title={`تقييم واعتماد المهمة: ${managerDecisionTask?.taskNumber || ''}`}
        description="اتخاذ قرار المدير الإداري بشأن جودة واكتمال المهمة المنفذة من قبل المحامي"
        icon={CheckCircle}
        size="lg"
        footerActions={
          <div className="flex gap-2">
            <SecondaryButton onClick={() => { setIsManagerDecisionModalOpen(false); setManagerDecisionTask(null); }}>
              ❌ إلغاء
            </SecondaryButton>
            <PrimaryButton onClick={handleSaveManagerDecision}>
              💾 حفظ القرار والاعتماد
            </PrimaryButton>
          </div>
        }
      >
        {managerDecisionTask && (
          <form onSubmit={handleSaveManagerDecision} className="space-y-4 text-right">
            {/* Task summary */}
            <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-amber-600">رقم المهمة: {managerDecisionTask.taskNumber}</span>
                <span className="text-[10px] font-bold text-slate-500">الحالة الحالية: {managerDecisionTask.status}</span>
              </div>
              <h4 className="text-xs font-black text-slate-900">{managerDecisionTask.title}</h4>
              <div className="flex items-center gap-4 text-[10px] text-slate-400 font-bold pt-1.5 border-t border-slate-100">
                <span>المسؤول: {managerDecisionTask.assignedToName}</span>
                <span>نسبة الإنجاز المبلغ عنها: {managerDecisionTask.progress}%</span>
              </div>
              {managerDecisionTask.notes && (
                <div className="bg-white p-2.5 rounded-lg border border-slate-100 text-[11px] text-slate-600 font-bold leading-relaxed mt-1">
                  <span className="text-[9px] text-slate-400 block mb-0.5">تقرير تنفيذ المحامي:</span>
                  {managerDecisionTask.notes}
                </div>
              )}
            </div>

            {/* Decision Select */}
            <FormField label="قرار المدير الإداري والاعتماد ✏️">
              <select
                value={decisionType}
                onChange={(e) => setDecisionType(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:border-amber-500 outline-none cursor-pointer"
              >
                <option value="">-- يرجى اختيار القرار المناسب --</option>
                <option value="قبول">قبول واعتماد واكتمال المهمة بشكل كامل ✅</option>
                <option value="عدم قبول">عدم قبول وإعادة التكليف بالمهمة ❌</option>
                <option value="ملاحظات">الموافقة مع وجود ملاحظات وتعديلات طفيفة ⚠️</option>
              </select>
            </FormField>

            {/* Decision Notes */}
            <FormField label="توصيات وتوجيهات المدير الإداري 🗒️">
              <textarea
                placeholder="اكتب هنا توجيهاتك للمحامي بشأن جودة التنفيذ أو الأسباب في حال عدم القبول..."
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:border-amber-500 outline-none"
              />
            </FormField>

            {/* Attachments Section in decision modal */}
            {managerDecisionTask.attachments && managerDecisionTask.attachments.length > 0 && (
              <div className="p-3 bg-white border border-slate-100 rounded-xl space-y-2 mt-2">
                <span className="text-[10px] font-bold text-slate-400 block">المستندات المرفقة للتنفيذ:</span>
                <div className="space-y-1.5">
                  {managerDecisionTask.attachments.map((att) => (
                    <div key={att.id} className="flex items-center justify-between p-2 rounded-lg border border-slate-150 bg-slate-50/50">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-[10px] font-bold text-slate-700">{att.name} ({att.type})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleViewAttachmentFile(att)}
                        className="bg-slate-900 text-amber-400 font-bold text-[9px] py-1 px-2.5 border border-slate-800 rounded hover:bg-slate-800 transition-all cursor-pointer"
                      >
                        عرض المستند
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>
        )}
      </BaseModal>

      {/* TOAST NOTIFICATION FOR PREMIUM RESPONSIVE FEEDBACK */}
      {toast.show && (
        <div className="fixed bottom-6 left-6 z-50 transform transition-all duration-300 scale-100 opacity-100" dir="rtl">
          <div className={`flex items-center gap-2.5 px-4.5 py-3 rounded-2xl shadow-2xl border ${
            toast.type === 'success' ? 'bg-slate-900/95 text-emerald-400 border-slate-800 backdrop-blur-md' :
            toast.type === 'error' ? 'bg-red-950/95 text-red-400 border-red-800 backdrop-blur-md' :
            'bg-slate-900/95 text-amber-400 border-slate-800 backdrop-blur-md'
          }`}>
            <div className="flex items-center gap-2 shrink-0">
              {toast.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              ) : toast.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-red-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-400" />
              )}
            </div>
            <span className="text-xs font-black">{toast.message}</span>
            <button
              onClick={() => setToast(prev => ({ ...prev, show: false }))}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-all cursor-pointer mr-2"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
