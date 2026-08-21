/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, X, Check, AlertCircle, RefreshCw, Trash2, 
  FileText, Image as ImageIcon, Film, File, HelpCircle, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { uploadToR2WithProgress, validateFile, UploadTask } from '../utils/fileStorage';

interface MultiUploadManagerProps {
  onFilesUploaded: (files: Array<{
    id: string;
    name: string;
    type: 'pdf' | 'word' | 'image' | 'voice' | 'video' | 'doc';
    category: string;
    uploadDate: string;
    size: string;
    fileUrl: string;
    uploadedBy?: string;
    storagePath?: string;
    downloadURL?: string;
  }>) => void;
  allowedExtensions?: string[]; // e.g., ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg']
  maxFiles?: number;
  defaultCategory?: string;
  uploaderName?: string;
  categories?: string[];
  singleMode?: boolean; // For fields like ID card/POA where only 1 file is uploaded
}

export default function MultiUploadManager({
  onFilesUploaded,
  allowedExtensions = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.gif', '.webp'],
  maxFiles = 10,
  defaultCategory = 'مستندات رسمية',
  uploaderName = 'المكتب',
  categories = ['صحيفة دعوى', 'مذكرة دفاع', 'حافظة مستندات', 'حكم', 'محضر جلسة', 'توكيل', 'مستندات رسمية', 'أخرى'],
  singleMode = false
}: MultiUploadManagerProps) {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [globalCategory, setGlobalCategory] = useState(defaultCategory);
  const [customNames, setCustomNames] = useState<Record<string, string>>({});
  const [customCategories, setCustomCategories] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up ObjectURLs on unmount
  useEffect(() => {
    return () => {
      tasks.forEach(task => {
        if (task.status === 'completed' && task.downloadURL) {
          // Keep it
        }
      });
    };
  }, [tasks]);

  const detectFileType = (fileName: string): 'pdf' | 'word' | 'image' | 'voice' | 'video' | 'doc' => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'pdf';
    if (['doc', 'docx'].includes(ext || '')) return 'word';
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext || '')) return 'image';
    if (['mp3', 'wav', 'm4a', 'amr', 'ogg'].includes(ext || '')) return 'voice';
    if (['mp4', 'mov', 'avi', 'mkv'].includes(ext || '')) return 'video';
    return 'doc';
  };

  const handleFilesAdded = (fileList: FileList) => {
    const addedFiles = Array.from(fileList);
    let currentCount = tasks.length;
    
    const newTasks: UploadTask[] = [];

    for (const file of addedFiles) {
      if (singleMode && currentCount >= 1) {
        alert('يُسمح برفع ملف واحد فقط في هذا الحقل. يرجى إزالة الملف الحالي أولاً.');
        break;
      }
      if (currentCount >= maxFiles) {
        alert(`تم تجاوز الحد الأقصى للملفات المسموح برفعها دفعة واحدة وهو ${maxFiles} ملفات.`);
        break;
      }

      // Validate
      const validation = validateFile(file, allowedExtensions);
      if (!validation.valid) {
        alert(`⚠️ الملف "${file.name}": ${validation.error}`);
        continue;
      }

      const id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const cleanName = file.name.split('.').slice(0, -1).join('.') || file.name;
      
      // Initialize names and categories
      setCustomNames(prev => ({ ...prev, [id]: cleanName }));
      setCustomCategories(prev => ({ ...prev, [id]: globalCategory }));

      newTasks.push({
        id,
        file,
        progress: 0,
        status: 'waiting'
      });
      currentCount++;
    }

    if (newTasks.length > 0) {
      setTasks(prev => [...prev, ...newTasks]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFilesAdded(e.target.files);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const startSingleUpload = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || ['uploading', 'compressing', 'completed'].includes(task.status)) return;

    // Set status
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'compressing', error: undefined } : t));

    const { promise, abort } = uploadToR2WithProgress(
      task.file,
      (progress) => {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, progress } : t));
      },
      (status, error) => {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status, error } : t));
      }
    );

    // Save abort controller
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, abort } : t));

    promise
      .then((downloadURL) => {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed', downloadURL } : t));
        
        // Notify parent
        const customName = customNames[taskId] || task.file.name;
        const category = customCategories[taskId] || globalCategory;
        const sizeInMB = (task.file.size / (1024 * 1024)).toFixed(2);
        
        onFilesUploaded([{
          id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          name: customName,
          type: detectFileType(task.file.name),
          category: category,
          uploadDate: new Date().toISOString().split('T')[0],
          size: `${sizeInMB} MB`,
          fileUrl: downloadURL,
          downloadURL: downloadURL,
          uploadedBy: uploaderName
        }]);
      })
      .catch((err) => {
        if (err.message !== 'cancelled') {
          setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'failed', error: err.message || 'فشل الرفع' } : t));
        }
      });
  };

  const startAllUploads = () => {
    tasks.forEach(task => {
      if (task.status === 'waiting' || task.status === 'failed' || task.status === 'cancelled') {
        startSingleUpload(task.id);
      }
    });
  };

  const cancelUpload = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task && task.abort) {
      task.abort();
    }
  };

  const removeTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task && ['uploading', 'compressing'].includes(task.status)) {
      cancelUpload(taskId);
    }
    setTasks(prev => prev.filter(t => t.id !== taskId));
    setCustomNames(prev => {
      const copy = { ...prev };
      delete copy[taskId];
      return copy;
    });
    setCustomCategories(prev => {
      const copy = { ...prev };
      delete copy[taskId];
      return copy;
    });
  };

  const clearCompleted = () => {
    setTasks(prev => prev.filter(t => t.status !== 'completed'));
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return <ImageIcon className="w-6 h-6 text-emerald-500" />;
    if (ext === 'pdf') return <FileText className="w-6 h-6 text-rose-500" />;
    if (['doc', 'docx'].includes(ext || '')) return <FileText className="w-6 h-6 text-blue-500" />;
    if (['mp4', 'mov', 'avi'].includes(ext || '')) return <Film className="w-6 h-6 text-indigo-500" />;
    return <File className="w-6 h-6 text-slate-400" />;
  };

  const getStatusText = (status: UploadTask['status']) => {
    switch (status) {
      case 'waiting': return 'بانتظار الرفع';
      case 'compressing': return 'جاري الضغط الذكي...';
      case 'uploading': return 'جاري الرفع سحابياً...';
      case 'completed': return 'اكتمل الرفع ✅';
      case 'failed': return 'فشل الرفع ❌';
      case 'cancelled': return 'تم إلغاء الرفع';
      default: return 'غير معروف';
    }
  };

  return (
    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-4 text-right" dir="rtl">
      
      {/* Global Category selector (for batch upload) */}
      {!singleMode && tasks.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-150 shadow-xs">
          <div>
            <h5 className="text-[11px] font-black text-slate-800">التصنيف الافتراضي للملفات المرفوعة</h5>
            <p className="text-[9px] text-slate-400 mt-0.5 font-bold">يمكنك تغيير تصنيف كل ملف على حدة أيضاً من القائمة بالأسفل</p>
          </div>
          <select
            value={globalCategory}
            onChange={(e) => {
              const val = e.target.value;
              setGlobalCategory(val);
              // Update all waiting files
              setTasks(prev => {
                prev.forEach(t => {
                  if (t.status === 'waiting') {
                    setCustomCategories(c => ({ ...c, [t.id]: val }));
                  }
                });
                return prev;
              });
            }}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:bg-white outline-none cursor-pointer"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      )}

      {/* Drag and Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-200 ${
          dragActive 
            ? 'border-amber-500 bg-amber-50/50 scale-[0.99]' 
            : 'border-slate-300 hover:border-amber-400 bg-white/80 hover:bg-white'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple={!singleMode}
          onChange={handleFileSelect}
          accept={allowedExtensions.join(',')}
        />
        <div className="p-3 bg-amber-100/60 rounded-full text-amber-600">
          <Upload className="w-6 h-6 animate-pulse" />
        </div>
        <div className="text-center">
          <p className="text-xs font-black text-slate-800">اسحب الملفات وأفلتها هنا أو اضغط للتصفح من جهازك</p>
          <p className="text-[10px] text-slate-400 mt-1 font-bold">
            صيغ مدعومة: {allowedExtensions.join(', ')} • الحد الأقصى للملف: 50MB
          </p>
          <p className="text-[9px] text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-100/50 inline-block mt-2 font-black">
            ⚡ يتم ضغط الصور تلقائياً قبل الرفع لتوفير المساحة وسرعة النقل بأعلى جودة ممكنة
          </p>
        </div>
      </div>

      {/* Task List */}
      {tasks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-black text-slate-700 flex items-center gap-1.5">
              <span>ملفات مختارة للرفع ({tasks.length})</span>
              {tasks.some(t => t.status === 'completed') && (
                <button
                  type="button"
                  onClick={clearCompleted}
                  className="text-[9px] text-rose-500 hover:text-rose-600 font-bold underline cursor-pointer"
                >
                  مسح المكتملة 🧹
                </button>
              )}
            </h4>
            
            {tasks.some(t => ['waiting', 'failed', 'cancelled'].includes(t.status)) && (
              <button
                type="button"
                onClick={startAllUploads}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-[10px] font-black py-1.5 px-4 rounded-lg shadow-sm hover:scale-[1.02] active:scale-95 transition-all cursor-pointer flex items-center gap-1"
              >
                <Upload className="w-3.5 h-3.5" />
                بدء رفع الكل دفعة واحدة 🚀
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white max-h-96 overflow-y-auto">
            <AnimatePresence initial={false}>
              {tasks.map((task) => {
                const isUploading = ['uploading', 'compressing'].includes(task.status);
                const isCompleted = task.status === 'completed';
                const isFailed = task.status === 'failed';
                
                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`p-3.5 flex flex-col gap-3 transition-colors ${
                      isCompleted ? 'bg-emerald-50/20' : isFailed ? 'bg-rose-50/10' : 'hover:bg-slate-50/50'
                    }`}
                  >
                    {/* Header: File info & Actions */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded-lg">
                          {getFileIcon(task.file.name)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-800 line-clamp-1" title={task.file.name}>
                              {task.file.name}
                            </span>
                            <span className="text-[9px] text-slate-400 font-bold bg-slate-100 px-1.5 py-0.5 rounded">
                              {(task.file.size / (1024 * 1024)).toFixed(2)} MB
                            </span>
                          </div>
                          <span className={`text-[9px] font-bold ${
                            isCompleted ? 'text-emerald-600' : isFailed ? 'text-rose-600' : 'text-amber-600'
                          }`}>
                            {getStatusText(task.status)}
                          </span>
                        </div>
                      </div>

                      {/* Control buttons */}
                      <div className="flex items-center gap-1.5">
                        {isUploading && (
                          <button
                            type="button"
                            onClick={() => cancelUpload(task.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                            title="إلغاء الرفع"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {(task.status === 'waiting' || isFailed || task.status === 'cancelled') && (
                          <>
                            <button
                              type="button"
                              onClick={() => startSingleUpload(task.id)}
                              className="p-1.5 text-amber-600 hover:text-amber-700 rounded-lg hover:bg-amber-50 transition-colors cursor-pointer"
                              title="بدء الرفع / إعادة المحاولة"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeTask(task.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                              title="حذف"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {isCompleted && (
                          <span className="p-1 text-emerald-600 bg-emerald-50 rounded-full border border-emerald-100">
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar & Error Display */}
                    {isUploading && (
                      <div className="space-y-1">
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <motion.div 
                            className={`h-full ${task.status === 'compressing' ? 'bg-indigo-500 animate-pulse' : 'bg-amber-500'}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${task.progress}%` }}
                            transition={{ duration: 0.1 }}
                          />
                        </div>
                        <div className="flex justify-between text-[8.5px] font-bold text-slate-400">
                          <span>{task.progress}%</span>
                          <span>{task.status === 'compressing' ? 'جاري الضغط...' : 'جاري الرفع...'}</span>
                        </div>
                      </div>
                    )}

                    {isFailed && task.error && (
                      <div className="flex items-center gap-1.5 text-[10px] text-rose-600 font-bold bg-rose-50/50 p-2 rounded-lg border border-rose-100">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                        <span>فشل الرفع: {task.error}</span>
                      </div>
                    )}

                    {/* Edit Details: Name & Category for WAITING / UPLOADING */}
                    {!isCompleted && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-50">
                        <div>
                          <label className="text-[9px] font-black text-slate-500 block mb-1">اسم المستند بالمكتب</label>
                          <input
                            type="text"
                            value={customNames[task.id] || ''}
                            onChange={(e) => setCustomNames(prev => ({ ...prev, [task.id]: e.target.value }))}
                            disabled={isUploading}
                            className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold text-slate-700 focus:bg-white focus:border-amber-500 outline-none transition-all placeholder:text-slate-400"
                            placeholder="اسم المستند..."
                          />
                        </div>
                        {!singleMode && (
                          <div>
                            <label className="text-[9px] font-black text-slate-500 block mb-1">تصنيف المستند</label>
                            <select
                              value={customCategories[task.id] || globalCategory}
                              onChange={(e) => setCustomCategories(prev => ({ ...prev, [task.id]: e.target.value }))}
                              disabled={isUploading}
                              className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold text-slate-700 focus:bg-white focus:border-amber-500 outline-none transition-all cursor-pointer"
                            >
                              {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
