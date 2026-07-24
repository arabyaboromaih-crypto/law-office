/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  User, Case, Client, Company, HearingSession, AuditLog, UserRole, UserPermissions, LegalTask 
} from './types';
import { 
  initialUsers as seedUsers,
  initialClients as seedClients,
  initialCompanies as seedCompanies,
  initialCases as seedCases,
  initialSessions as seedSessions,
  initialLogs as seedAuditLogs,
  initialTasks as seedTasks
} from './seedData';

// Subcomponents import
import LoginScreen from './components/LoginScreen';
import InitializationScreen from './components/InitializationScreen';
import Dashboard from './components/Dashboard';
import CasesPanel from './components/CasesPanel';
import AgendaPanel from './components/AgendaPanel';
import ClientsPanel from './components/ClientsPanel';
import FeesPanel from './components/FeesPanel';
import UsersPanel from './components/UsersPanel';
import ArchivePanel from './components/ArchivePanel';
import TasksPanel from './components/TasksPanel';
import SettingsPanel from './components/SettingsPanel';
import RealEstatePanel from './components/RealEstatePanel';
import InstallModal from './components/InstallModal';
import { extractHearingDate } from './utils/hearingSync';
import { toEn, toAr } from './utils/arabicNumbers';

// Firebase Sync Utilities
import { 
  subscribeCollection, 
  addFirestoreDoc, 
  updateFirestoreDoc, 
  deleteFirestoreDoc,
  getFirestoreDocs
} from './services/dbSync';

import { 
  Gavel, Calendar, Users, Building2, CreditCard, Shield, Archive, LayoutDashboard, LogOut, ShieldAlert, CheckCircle, Clock, ClipboardList, Settings, Menu, X, ChevronLeft, ChevronRight, Lock, ShieldCheck, Scale, Download
} from 'lucide-react';

function translateDOMDigits(rootNode: Node, system: string) {
  const walker = document.createTreeWalker(
    rootNode,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentElement;
        if (parent) {
          const tagName = parent.tagName.toLowerCase();
          if (
            tagName === 'input' ||
            tagName === 'textarea' ||
            tagName === 'script' ||
            tagName === 'style' ||
            tagName === 'code' ||
            tagName === 'pre' ||
            parent.isContentEditable ||
            parent.closest('[contenteditable="true"]') ||
            parent.closest('.no-digit-translation')
          ) {
            return NodeFilter.FILTER_REJECT;
          }
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const textNodes: Text[] = [];
  let currentNode = walker.nextNode();
  while (currentNode) {
    textNodes.push(currentNode as Text);
    currentNode = walker.nextNode();
  }

  for (const node of textNodes) {
    const text = node.nodeValue;
    if (!text) continue;

    let newText = text;
    if (system === 'arabic') {
      newText = text.replace(/[0-9]/g, (char) => '٠١٢٣٤٥٦٧٨٩'[char.charCodeAt(0) - 48]);
    } else {
      newText = text.replace(/[٠-٩]/g, (char) => String(char.charCodeAt(0) - 1632));
    }

    if (newText !== text) {
      node.nodeValue = newText;
    }
  }
}

export default function App() {
  
  // Responsive sidebar states
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // State variables for entities (will load from Firestore in real-time)
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [sessions, setSessions] = useState<HearingSession[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [tasks, setTasks] = useState<LegalTask[]>([]);
  const [opponents, setOpponents] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isUsersLoaded, setIsUsersLoaded] = useState(false);

  const defaultSettings = useMemo(() => ({
    id: 'office_settings',
    officeName: 'مؤسسة رميح للمحاماة والاستشارات القانونية',
    officeSubtitle: 'نظام إدارة القضايا والشركات المتكامل - متوافق كلياً مع نظام المحاكم المصرية الحديث',
    officeAddress: '٤٥ شارع المحكمة الدستورية العليا، المعادي، القاهرة',
    officeWhatsapp: '+20120000000',
    officeEmail: 'contact@romeih-law.com',
    numberingSystem: 'arabic',
    tplSession: 'السلام عليكم ورحمة الله وبركاته، نحيط سيادتكم علماً بأن لديكم جلسة قضائية قادمة يوم {date} في تمام الساعة {time} أمام محكمة {court} (دائرة {circuit}). نرجو الاستعداد المالي والفني اللازم. شاكرين لثقتكم بمؤسسة رميح للمحاماة.',
    tplTask: 'عزيزي الأستاذ {lawyer}، تم إسناد المهمة التالية لسيادتكم: [{taskNumber}] - "{title}". تاريخ التنفيذ المطلوب: {executionDate}. يرجى المتابعة وتسجيل الإجراء على البوابة فور الإتمام.',
    generalDirectorName: 'الأستاذ عربي رميح',
    generalDirectorTitle: 'المدير العام ومدير المؤسسة',
    generalDirectorPhone: '01012345678',
    generalDirectorEmail: 'araby@romeih-law.com',
    isSystemUnlocked: true,
    isDirectorAssigned: true
  }), []);

  const [officeSettings, setOfficeSettings] = useState<any>(null);

  const [officeName, setOfficeName] = useState(() => {
    return localStorage.getItem('romeih_office_name') || 'مؤسسة رميح للمحاماة والاستشارات القانونية';
  });
  
  const [officeSubtitle, setOfficeSubtitle] = useState(() => {
    return localStorage.getItem('romeih_office_subtitle') || 'نظام إدارة القضايا والشركات المتكامل - متوافق كلياً مع نظام المحاكم المصرية الحديث';
  });

  // Session user state to track currently logged-in user session
  const [sessionUser, setSessionUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('romeih_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Helper setter to update session state
  const setCurrentUser = (user: User | null) => {
    setSessionUser(user);
  };

  // Derived currentUser which is ALWAYS synchronized in real-time with Firestore database
  const currentUser = useMemo(() => {
    if (!sessionUser) return null;
    if (!isUsersLoaded) return null;
    const live = users.find(u => u.id === sessionUser.id);
    if (!live || live.status === 'suspended') return null;
    return live;
  }, [sessionUser, users, isUsersLoaded]);

  const currentUserRef = useRef<User | null>(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // System Activation States (Always unlocked by default per user request)
  const [isSystemUnlocked, setIsSystemUnlocked] = useState(true);
  const [logoError, setLogoError] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  
  const [isDirectorAssigned, setIsDirectorAssigned] = useState(true);

  // Scroll listener to activate sticky header glassmorphism and shadow effect
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 12) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Navigation tab
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'cases' | 'agenda' | 'clients' | 'fees' | 'users' | 'archive' | 'tasks' | 'settings' | 'realestate'
  >('dashboard');

  // State for permission alert modal
  const [showNoPermissionModal, setShowNoPermissionModal] = useState(false);

  // PWA states and Offline detection
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isInstalledApp, setIsInstalledApp] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showDirectInstallOverlay, setShowDirectInstallOverlay] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('triggerInstall') === 'true';
    }
    return false;
  });

  useEffect(() => {
    // Check if running as PWA (standalone mode)
    const checkStandalone = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
      setIsInstalledApp(isStandalone);
    };
    checkStandalone();

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      setIsInstalledApp(e.matches);
    };
    
    try {
      mediaQuery.addEventListener('change', handleMediaChange);
    } catch (err) {
      // Fallback for older browsers
      try {
        mediaQuery.addListener(handleMediaChange);
      } catch (e) {}
    }

    const handleAppInstalled = () => {
      setIsInstalledApp(true);
      setShowInstallBanner(false);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);

      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('triggerInstall') === 'true') {
        // Clear search parameters instantly to avoid looping on refreshes
        try {
          const newUrl = window.location.pathname + window.location.hash;
          window.history.replaceState({}, document.title, newUrl);
        } catch (err) {}

        // Trigger prompt directly after a tiny delay for high performance
        setTimeout(() => {
          e.prompt();
          e.userChoice.then(({ outcome }: any) => {
            console.log(`User response to auto install prompt: ${outcome}`);
            setDeferredPrompt(null);
            setShowInstallBanner(false);
          }).catch(() => {});
        }, 800);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Hash routing for shortcuts
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (['dashboard', 'cases', 'agenda', 'clients', 'fees', 'users', 'archive', 'tasks', 'settings', 'realestate'].includes(hash)) {
        const curr = currentUserRef.current;
        if (curr) {
          if (hash === 'users' && !(curr.role === 'admin' || curr.permissions?.manageUsers)) {
            setShowNoPermissionModal(true);
            return;
          }
          if (hash === 'settings' && !(curr.role === 'admin' || curr.permissions?.manageSettings)) {
            setShowNoPermissionModal(true);
            return;
          }
        }
        setActiveTab(hash as any);
      }
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      try {
        mediaQuery.removeEventListener('change', handleMediaChange);
      } catch (err) {
        try {
          mediaQuery.removeListener(handleMediaChange);
        } catch (e) {}
      }
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const triggerInstall = async () => {
    if (!deferredPrompt) {
      // If we don't have direct prompt (e.g., on Safari), open the instructions modal
      setShowInstallModal(true);
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  const handleTabClick = (tabId: typeof activeTab) => {
    if (tabId === 'users') {
      const hasAccess = currentUser && (currentUser.role === 'admin' || currentUser.permissions?.manageUsers);
      if (!hasAccess) {
        setShowNoPermissionModal(true);
        return;
      }
    }
    if (tabId === 'settings') {
      const hasAccess = currentUser && (currentUser.role === 'admin' || currentUser.permissions?.manageSettings);
      if (!hasAccess) {
        setShowNoPermissionModal(true);
        return;
      }
    }
    setActiveTab(tabId);
  };

  const [casesSearchQuery, setCasesSearchQuery] = useState('');
  const [returnToClient, setReturnToClient] = useState<{ id: string; name: string } | null>(null);
  const [selectedClientIdForReturn, setSelectedClientIdForReturn] = useState<string | null>(null);

  // Numbering system state
  const [numberingSystem, setNumberingSystem] = useState<string>(() => {
    return localStorage.getItem('romeih_numbering_system') || 'arabic';
  });

  const getDynamicDateString = (date: Date, options: Intl.DateTimeFormatOptions) => {
    const numberingSystemParam = numberingSystem === 'english' ? 'latn' : 'arab';
    return date.toLocaleDateString('ar-EG', { ...options, timeZone: 'Africa/Cairo', numberingSystem: numberingSystemParam });
  };

  // Real-time Clock & Calendar State
  const [currentDateTime, setCurrentDateTime] = useState<Date>(new Date());

  // Ref to lock outgoing write triggers during incoming Firestore snapshot updates
  const isSyncingRef = useRef(false);

  // Keep refs of previous state values to compare and diff
  const prevUsersRef = useRef<User[]>([]);
  const prevClientsRef = useRef<Client[]>([]);
  const prevCompaniesRef = useRef<Company[]>([]);
  const prevCasesRef = useRef<Case[]>([]);
  const prevSessionsRef = useRef<HearingSession[]>([]);
  const prevAuditLogsRef = useRef<AuditLog[]>([]);
  const prevTasksRef = useRef<LegalTask[]>([]);

  // Seed data for opponents and notifications
  const seedOpponents = [
    {
      id: 'opponent-1',
      name: 'محمود عبد العزيز الهواري',
      role: 'خصم',
      address: 'شارع الجلاء، طنطا، الغربية',
      lawyer: 'الأستاذ فريد الديب',
      phone: '01222223333',
      lawyerPhone: '01001001001'
    },
    {
      id: 'opponent-2',
      name: 'عبد الحميد بكري شاهين',
      role: 'خصم',
      address: 'وسط البلد، المنصورة، الدقهلية',
      lawyer: 'لا يوجد',
      phone: '01122224444',
      lawyerPhone: ''
    },
    {
      id: 'opponent-3',
      name: 'شركة النور للخدمات اللوجستية',
      role: 'خصم',
      address: 'المنطقة الحرة، مدينة نصر، القاهرة',
      lawyer: 'الأستاذ بهاء الدين أبو شقة',
      phone: '022654321',
      lawyerPhone: '0100500600'
    }
  ];

  const seedNotifications = [
    {
      id: 'noti-1',
      text: 'تنبيه: اقتراب موعد استحقاق الرد القانوني في القضية رقم 14205 لسنة 2025.',
      type: 'warning',
      date: '2026-06-26'
    },
    {
      id: 'noti-2',
      text: 'نجاح ترحيل وتحديث بيانات الموكل حامد زكريا عبد اللطيف.',
      type: 'success',
      date: '2026-06-25'
    }
  ];

  // 1. Subscribe to Firestore Collections on Mount
  useEffect(() => {
    const unsubscribes: (() => void)[] = [];

    const syncCollection = <T extends { id: string }>(
      collectionName: string,
      setter: React.Dispatch<React.SetStateAction<T[]>>,
      seedData: T[],
      onLoaded?: () => void
    ) => {
      const unsub = subscribeCollection<T>(
        collectionName,
        (items) => {
          isSyncingRef.current = true;
          let finalItems = items;
          if (collectionName === 'users') {
            const hasArabi = (items as unknown as User[]).some(u => u.phone === '01143472682' || u.username === 'عربي رميح');
            if (!hasArabi) {
              const arabiUser = seedUsers.find(su => su.id === 'user-admin-arabi');
              if (arabiUser) {
                console.log("Seeding custom admin user 'عربي رميح' to Firestore...");
                addFirestoreDoc('users', arabiUser, arabiUser.id).catch(err => console.error(err));
              }
            }
            finalItems = (items as unknown as User[]).map(u => {
              const seed = seedUsers.find(su => su.id === u.id || su.phone === u.phone);
              return {
                ...u,
                username: u.username || seed?.username || u.phone,
                password: u.password || seed?.password || u.phone
              } as unknown as T;
            });
          }
          setter(finalItems);
          if (onLoaded) onLoaded();
          setTimeout(() => {
            isSyncingRef.current = false;
          }, 0);
        },
        seedData
      );
      unsubscribes.push(unsub);
    };

    syncCollection('users', setUsers, seedUsers, () => setIsUsersLoaded(true));
    syncCollection('clients', setClients, seedClients);
    syncCollection('companies', setCompanies, seedCompanies);
    syncCollection('cases', setCases, seedCases);
    syncCollection('sessions', setSessions, seedSessions);
    syncCollection('auditLogs', setAuditLogs, seedAuditLogs);
    syncCollection('tasks', setTasks, seedTasks);
    syncCollection('opponents', setOpponents, seedOpponents);
    syncCollection('notifications', setNotifications, seedNotifications);
    syncCollection<any>('settings', (items) => {
      const list = Array.isArray(items) ? items : [];
      const savedSettings = list.find(i => i.id === 'office_settings') || defaultSettings;
      setOfficeSettings(savedSettings);
      
      setOfficeName(savedSettings.officeName);
      setOfficeSubtitle(savedSettings.officeSubtitle);
      setNumberingSystem(savedSettings.numberingSystem || 'arabic');
      setIsSystemUnlocked(savedSettings.isSystemUnlocked !== false);
      setIsDirectorAssigned(savedSettings.isDirectorAssigned !== false);
      
      // Mirror to localStorage for backwards-compatible utilities (e.g. toAr)
      localStorage.setItem('romeih_office_name', savedSettings.officeName);
      localStorage.setItem('romeih_office_subtitle', savedSettings.officeSubtitle);
      localStorage.setItem('romeih_office_address', savedSettings.officeAddress || '');
      localStorage.setItem('romeih_office_whatsapp', savedSettings.officeWhatsapp || '');
      localStorage.setItem('romeih_office_email', savedSettings.officeEmail || '');
      localStorage.setItem('romeih_numbering_system', savedSettings.numberingSystem || 'arabic');
      localStorage.setItem('romeih_tpl_session', savedSettings.tplSession || '');
      localStorage.setItem('romeih_tpl_task', savedSettings.tplTask || '');
      localStorage.setItem('romeih_general_director_name', savedSettings.generalDirectorName || 'الأستاذ عربي رميح');
      localStorage.setItem('romeih_general_director_title', savedSettings.generalDirectorTitle || 'المدير العام ومدير المؤسسة');
      localStorage.setItem('romeih_general_director_phone', savedSettings.generalDirectorPhone || '');
      localStorage.setItem('romeih_general_director_email', savedSettings.generalDirectorEmail || '');
      localStorage.setItem('romeih_general_director_assigned', savedSettings.isDirectorAssigned ? 'true' : 'false');
      localStorage.setItem('romeih_settings_unlocked', savedSettings.isSystemUnlocked ? 'true' : 'false');
      
      window.dispatchEvent(new Event('storage'));
    }, [defaultSettings]);

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, []);

  // 2. State management is now entirely server-authoritative.
  // When actions occur, they write directly to Firestore, which instantly triggers the onSnapshot listener above.

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleStorageUpdate = () => {
      setOfficeName(localStorage.getItem('romeih_office_name') || 'مؤسسة رميح للمحاماة والاستشارات القانونية');
      setOfficeSubtitle(localStorage.getItem('romeih_office_subtitle') || 'نظام إدارة القضايا والشركات المتكامل - متوافق كلياً مع نظام المحاكم المصرية الحديث');
      setNumberingSystem(localStorage.getItem('romeih_numbering_system') || 'arabic');
    };
    window.addEventListener('storage', handleStorageUpdate);
    return () => window.removeEventListener('storage', handleStorageUpdate);
  }, []);

  // Keyboard navigation for sidebar menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Find the active element
      const activeEl = document.activeElement;
      if (!activeEl) return;

      // Only intercept arrow keys if a sidebar menu button actually has focus
      if (!activeEl.classList.contains('sidebar-menu-btn')) {
        return; // Allow default scrolling in the main workspace
      }

      // Do not navigate if user is typing in an input, textarea, or contenteditable
      const tagName = activeEl.tagName.toLowerCase();
      if (
        tagName === 'input' ||
        tagName === 'textarea' ||
        activeEl.hasAttribute('contenteditable') ||
        (activeEl as HTMLElement).isContentEditable
      ) {
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); // Prevent standard page scrolling for sidebar transition

        // Find all active/visible menu buttons in the desktop sidebar
        const buttons = Array.from(
          document.querySelectorAll('.sidebar-menu-btn')
        ) as HTMLButtonElement[];

        if (buttons.length === 0) return;

        // Find current focused or active button index
        let currentIndex = buttons.findIndex(btn => btn === activeEl);
        
        // If none is focused, find the active tab button
        if (currentIndex === -1) {
          currentIndex = buttons.findIndex(btn => btn.getAttribute('data-active') === 'true');
        }

        let nextIndex = currentIndex;
        if (e.key === 'ArrowDown') {
          nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % buttons.length;
        } else if (e.key === 'ArrowUp') {
          nextIndex = currentIndex === -1 ? buttons.length - 1 : (currentIndex - 1 + buttons.length) % buttons.length;
        }

        const targetBtn = buttons[nextIndex];
        if (targetBtn) {
          targetBtn.focus();
          
          // Smoothly scroll the focused element into view inside the sidebar
          targetBtn.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeTab]);

  // Dynamic Eastern/Western digit translation based on selected numberingSystem
  useEffect(() => {
    let observer: MutationObserver | null = null;
    
    const runTranslation = () => {
      if (observer) observer.disconnect();
      translateDOMDigits(document.body, numberingSystem);
      if (observer) {
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          characterData: true
        });
      }
    };

    observer = new MutationObserver((mutations) => {
      let shouldTranslate = false;
      for (const m of mutations) {
        if (m.type === 'characterData') {
          shouldTranslate = true;
          break;
        }
        if (m.type === 'childList' && m.addedNodes.length > 0) {
          shouldTranslate = true;
          break;
        }
      }
      if (shouldTranslate) {
        runTranslation();
      }
    });

    // Run initially
    runTranslation();

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    return () => {
      if (observer) {
        observer.disconnect();
      }
    };
  }, [numberingSystem]);

  // Synchronize input fields dynamically as the user types, converting digits to match settings
  useEffect(() => {
    const handleInputTranslation = (e: Event) => {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement;
      if (!target || (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA')) return;
      
      const type = target.type ? target.type.toLowerCase() : '';
      if (
        type === 'password' || 
        type === 'email' || 
        type === 'url' || 
        type === 'date' || 
        type === 'time' || 
        type === 'datetime-local' || 
        type === 'number' || 
        type === 'month' || 
        type === 'week' || 
        type === 'range'
      ) return;
      
      const name = (target.name || '').toLowerCase();
      const id = (target.id || '').toLowerCase();
      if (
        name.includes('username') || 
        id.includes('username') || 
        name.includes('password') || 
        id.includes('password')
      ) return;
      
      const val = target.value;
      let newVal = val;
      if (numberingSystem === 'arabic') {
        newVal = val.replace(/[0-9]/g, (char) => '٠١٢٣٤٥٦٧٨٩'[char.charCodeAt(0) - 48]);
      } else {
        newVal = val.replace(/[٠-٩]/g, (char) => String(char.charCodeAt(0) - 1632));
      }
      
      if (newVal !== val) {
        const start = target.selectionStart;
        const end = target.selectionEnd;
        
        const prototype = target.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
        
        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(target, newVal);
          const event = new Event('input', { bubbles: true });
          target.dispatchEvent(event);
        } else {
          target.value = newVal;
        }
        
        if (start !== null && end !== null) {
          target.setSelectionRange(start, end);
        }
      }
    };

    document.addEventListener('input', handleInputTranslation);
    return () => document.removeEventListener('input', handleInputTranslation);
  }, [numberingSystem]);

  const handleDataReloadNeeded = () => {
    // With Firestore real-time sync, reloading local state is handled automatically. 
    // We just refresh the local storage branding/activation settings and navigate.
    setOfficeName(localStorage.getItem('romeih_office_name') || 'مؤسسة رميح للمحاماة والاستشارات القانونية');
    setOfficeSubtitle(localStorage.getItem('romeih_office_subtitle') || 'نظام إدارة القضايا والشركات المتكامل - متوافق كلياً مع نظام المحاكم المصرية الحديث');
    setIsSystemUnlocked(localStorage.getItem('romeih_settings_unlocked') === 'true');
    setIsDirectorAssigned(localStorage.getItem('romeih_general_director_assigned') === 'true');
    setNumberingSystem(localStorage.getItem('romeih_numbering_system') || 'arabic');
    setActiveTab('dashboard');
  };

  useEffect(() => {
    if (sessionUser) {
      localStorage.setItem('romeih_current_user', JSON.stringify(sessionUser));
    } else {
      localStorage.removeItem('romeih_current_user');
    }
  }, [sessionUser]);




  // Auto-sync discovered sessions from case documents/files into sessions list automatically
  useEffect(() => {
    setSessions(prevSessions => {
      let changed = false;
      const updatedSessions = [...prevSessions];

      cases.forEach(c => {
        if (!c.files) return;
        c.files.forEach(file => {
          const fileDate = extractHearingDate(file.name);
          if (!fileDate) return;
          
          const exists = updatedSessions.some(s => s.caseId === c.id && s.date === fileDate);
          
          if (!exists) {
            const newSession: HearingSession = {
              id: `session-sync-auto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              caseId: c.id,
              caseNumber: c.caseNumberFirstInstance,
              caseYear: c.caseYearFirstInstance,
              clientName: c.clientName,
              opponentName: c.opponent ? c.opponent.name : 'غير محدد',
              court: c.court || 'غير محدد',
              circuit: c.circuit || 'غير محدد',
              type: c.type,
              date: fileDate,
              time: '09:00',
              subject: `جلسة مستخرجة ومزامنة تلقائياً من مستند: ${file.name}`,
              status: 'pending',
              assignedLawyerId: c.assignedLawyerId || undefined,
              assignedLawyerName: users.find(u => u.id === c.assignedLawyerId)?.fullName || undefined,
              notes: `تم رصد الجلسة وإضافتها تلقائياً للأجندة بناءً على الملف: ${file.name}`
            };
            updatedSessions.push(newSession);
            changed = true;
          }
        });
      });

      return changed ? updatedSessions : prevSessions;
    });
  }, [cases, users]);

  const handleSetTasks = async (value: React.SetStateAction<LegalTask[]>) => {
    const nextTasks = typeof value === 'function' ? value(tasks) : value;
    setTasks(nextTasks);

    if (isSyncingRef.current) return;

    try {
      const deleted = tasks.filter(t => !nextTasks.some(nt => nt.id === t.id));
      for (const t of deleted) {
        await deleteFirestoreDoc('tasks', t.id);
      }

      const added = nextTasks.filter(nt => !tasks.some(t => t.id === nt.id));
      for (const t of added) {
        await addFirestoreDoc('tasks', t, t.id);
      }

      const updated = nextTasks.filter(nt => {
        const orig = tasks.find(t => t.id === nt.id);
        return orig && JSON.stringify(orig) !== JSON.stringify(nt);
      });
      for (const t of updated) {
        await updateFirestoreDoc('tasks', t.id, t);
      }
    } catch (err) {
      console.error("Failed to sync task change to Firestore:", err);
    }
  };

  // Log action inside Audit Trails helper
  const addAuditLog = async (user: User, actionType: 'login' | 'logout' | 'add' | 'edit' | 'delete' | 'archive' | 'restore' | 'failed_login' | 'unauthorized_access', details: string) => {
    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      username: user.phone,
      fullName: user.fullName,
      actionType,
      details,
      timestamp: new Date().toISOString(),
      deviceInfo: navigator.userAgent.includes('Mobi') ? 'هاتف محمول (رول الميدان)' : 'كمبيوتر المكتب المكتبي (المتصفح الأمني)'
    };
    try {
      await addFirestoreDoc('auditLogs', newLog, newLog.id);
    } catch (err) {
      console.error("Failed to add audit log:", err);
    }
  };

  // Auth Handlers
  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    addAuditLog(user, 'login', 'تسجيل دخول ناجح إلى بوابة الأنظمة القضائية للمؤسسة');
  };

  const handleInitializationComplete = async (newDirector: User) => {
    try {
      await addFirestoreDoc('users', newDirector, newDirector.id);
      
      localStorage.setItem('romeih_settings_unlocked', 'true');
      localStorage.setItem('romeih_general_director_assigned', 'true');
      setIsSystemUnlocked(true);
      setIsDirectorAssigned(true);
      
      setCurrentUser(newDirector);
      await addAuditLog(newDirector, 'add', `تهيئة وتفعيل النظام القضائي الموحد لأول مرة بنجاح، وتعيين المدير العام: ${newDirector.fullName}`);
    } catch (err) {
      console.error("Failed to complete system initialization:", err);
      alert("حدث خطأ أثناء حفظ بيانات التهيئة. يرجى مراجعة الخادم.");
    }
  };

  const handleRegisterUser = async (newUser: User) => {
    try {
      const exists = users.find(u => u.phone === newUser.phone);
      if (exists) {
        await updateFirestoreDoc('users', exists.id, newUser);
      } else {
        await addFirestoreDoc('users', newUser, newUser.id);
      }
      await addAuditLog(newUser, 'add', `تفعيل واستكمال تدوين حساب المحامي/الموظف مأذون التسجيل مسبقاً: ${newUser.fullName}`);
    } catch (err) {
      console.error("Failed to register user:", err);
    }
  };

  const handleUpdateSettings = async (updated: any) => {
    try {
      await updateFirestoreDoc('settings', 'office_settings', updated);
    } catch (err) {
      console.error("Failed to update settings in Firestore:", err);
    }
  };

  const handleLogout = () => {
    const userToLog = currentUser || sessionUser;
    if (userToLog) {
      addAuditLog(userToLog, 'logout', 'تسجيل خروج آمن وإغلاق جلسة العمل للمحامين');
    }
    setSessionUser(null);
  };

  // Keep session state in sync with the real-time Firestore database 'users' collection
  useEffect(() => {
    if (isUsersLoaded) {
      if (sessionUser) {
        const liveUser = users.find(u => u.id === sessionUser.id);
        if (!liveUser || liveUser.status === 'suspended') {
          console.warn("Currently logged-in user is suspended or deleted from Firestore. Logging out...");
          handleLogout();
        } else if (JSON.stringify(liveUser) !== JSON.stringify(sessionUser)) {
          console.log("Up-to-date user data and permissions synchronized from Firestore for:", liveUser.fullName);
          setSessionUser(liveUser);
        }
      }
    }
  }, [isUsersLoaded, users, sessionUser]);

  // Case updates handlers
  const handleAddCase = async (newCase: Case) => {
    if (!currentUser) return;
    
    try {
      await addFirestoreDoc('cases', newCase, newCase.id);

      if (newCase.opponent) {
        const oppId = `opponent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const opponentData = {
          id: oppId,
          name: newCase.opponent.name,
          role: newCase.opponent.role || 'خصم',
          address: newCase.opponent.address || '',
          lawyer: newCase.opponent.lawyer || '',
          phone: newCase.opponent.phone || '',
          lawyerPhone: newCase.opponent.lawyerPhone || '',
          notes: newCase.opponent.notes || ''
        };
        await addFirestoreDoc('opponents', opponentData, oppId);
      }

      if (newCase.nextHearingDate) {
        const newSession: HearingSession = {
          id: `session-${Date.now()}`,
          caseId: newCase.id,
          caseNumber: newCase.caseNumberFirstInstance,
          caseYear: newCase.caseYearFirstInstance,
          clientName: newCase.clientName,
          opponentName: newCase.opponent.name,
          court: newCase.court,
          circuit: newCase.circuit,
          type: newCase.type,
          date: newCase.nextHearingDate,
          time: newCase.nextHearingTime || '09:00',
          subject: newCase.status || 'جلسة متداولة ومتابعة',
          status: 'pending',
          assignedLawyerId: newCase.assignedLawyerId,
          assignedLawyerName: users.find(u => u.id === newCase.assignedLawyerId)?.fullName
        };
        await addFirestoreDoc('sessions', newSession, newSession.id);
      }

      await addAuditLog(currentUser, 'add', `تقييد دعوى جديدة برقم أول درجة: ${newCase.caseNumberFirstInstance} لسنة ${newCase.caseYearFirstInstance} أمام محكمة ${newCase.court}`);
    } catch (err) {
      console.error("Failed to add case:", err);
      throw err;
    }
  };

  const handleUpdateCase = async (updated: Case) => {
    if (!currentUser) return;

    try {
      await updateFirestoreDoc('cases', updated.id, updated);

      if (updated.opponent) {
        const opponentData = {
          name: updated.opponent.name,
          role: updated.opponent.role || 'خصم',
          address: updated.opponent.address || '',
          lawyer: updated.opponent.lawyer || '',
          phone: updated.opponent.phone || '',
          lawyerPhone: updated.opponent.lawyerPhone || '',
          notes: updated.opponent.notes || ''
        };
        const existingOpp = opponents.find(o => o.name === updated.opponent.name);
        if (existingOpp) {
          await updateFirestoreDoc('opponents', existingOpp.id, opponentData);
        } else {
          const oppId = `opponent-${Date.now()}`;
          await addFirestoreDoc('opponents', { id: oppId, ...opponentData }, oppId);
        }
      }

      if (updated.nextHearingDate) {
        const hasPending = sessions.some(s => s.caseId === updated.id && s.status === 'pending');
        if (hasPending) {
          const pendingSessions = sessions.filter(s => s.caseId === updated.id && s.status === 'pending');
          for (const s of pendingSessions) {
            const updatedSess = {
              ...s,
              caseNumber: updated.caseNumberFirstInstance,
              caseYear: updated.caseYearFirstInstance,
              clientName: updated.clientName,
              opponentName: updated.opponent.name,
              court: updated.court,
              circuit: updated.circuit,
              type: updated.type,
              date: updated.nextHearingDate!,
              time: updated.nextHearingTime || '09:00',
              subject: updated.status || 'جلسة متداولة ومتابعة',
              assignedLawyerId: updated.assignedLawyerId,
              assignedLawyerName: users.find(u => u.id === updated.assignedLawyerId)?.fullName
            };
            await updateFirestoreDoc('sessions', s.id, updatedSess);
          }
        } else {
          const newSession: HearingSession = {
            id: `session-${Date.now()}`,
            caseId: updated.id,
            caseNumber: updated.caseNumberFirstInstance,
            caseYear: updated.caseYearFirstInstance,
            clientName: updated.clientName,
            opponentName: updated.opponent.name,
            court: updated.court,
            circuit: updated.circuit,
            type: updated.type,
            date: updated.nextHearingDate!,
            time: updated.nextHearingTime || '09:00',
            subject: updated.status || 'جلسة متداولة ومتابعة',
            status: 'pending',
            assignedLawyerId: updated.assignedLawyerId,
            assignedLawyerName: users.find(u => u.id === updated.assignedLawyerId)?.fullName
          };
          await addFirestoreDoc('sessions', newSession, newSession.id);
        }
      } else {
        const pendingSessions = sessions.filter(s => s.caseId === updated.id && s.status === 'pending');
        for (const s of pendingSessions) {
          await deleteFirestoreDoc('sessions', s.id);
        }
      }

      await addAuditLog(currentUser, 'edit', `تحديث بيانات ومستندات القضية رقم: ${updated.caseNumberFirstInstance} لصالح الموكل: ${updated.clientName}`);
    } catch (err) {
      console.error("Failed to update case:", err);
      throw err;
    }
  };

  const handleArchiveCase = async (caseId: string, reason: string, notes: string) => {
    if (!currentUser) return;
    const targetCase = cases.find(c => c.id === caseId);
    if (!targetCase) return;

    try {
      const updatedCase = {
        ...targetCase,
        isArchived: true,
        archiveReason: reason,
        archiveDate: new Date().toISOString().split('T')[0],
        archiveNotes: notes
      };
      await updateFirestoreDoc('cases', caseId, updatedCase);
      await addAuditLog(currentUser, 'archive', `ترحيل القضية رقم: ${targetCase.caseNumberFirstInstance} إلى أرشيف القضايا المغلقة لسبب: ${reason}`);
    } catch (err) {
      console.error("Failed to archive case:", err);
      throw err;
    }
  };

  const handleDeleteCase = (caseId: string, reason: string, passwordConfirm: string): boolean => {
    if (!currentUser) return false;
    const targetCase = cases.find(c => c.id === caseId);
    if (!targetCase) return false;
    deleteFirestoreDoc('cases', caseId).catch(err => console.error("Failed to delete case:", err));
    addAuditLog(currentUser, 'delete', `حذف نهائي فوري للدعوى رقم: ${targetCase.caseNumberFirstInstance} لسنة ${targetCase.caseYearFirstInstance} لسبب: ${reason}`);
    return true;
  };

  // Session/Agenda updates
  const handleAddSession = async (session: HearingSession) => {
    if (!currentUser) return;
    try {
      await addFirestoreDoc('sessions', session, session.id);
      await addAuditLog(currentUser, 'add', `تسجيل جلسة دفاع جديدة بتاريخ ${session.date} لصالح القضية رقم ${session.caseNumber}`);
    } catch (err) {
      console.error("Failed to add session:", err);
      throw err;
    }
  };

  const handleUpdateSession = async (updated: HearingSession) => {
    if (!currentUser) return;

    try {
      await updateFirestoreDoc('sessions', updated.id, updated);

      if (updated.status === 'completed' || updated.status === 'postponed' || updated.decision) {
        const parentCase = cases.find(c => c.id === updated.caseId);
        if (parentCase) {
          // Automatic Files Sync: If there is a roll photo, synchronize it into the case files list
          const updatedFiles = parentCase.files ? [...parentCase.files] : [];
          const hasRollFile = updatedFiles.some(f => f.id === `file-roll-${updated.id}`);
          if (!hasRollFile && updated.rollPhotoUrl) {
            updatedFiles.push({
              id: `file-roll-${updated.id}`,
              name: `صورة رول وقرار جلسة ${updated.date}.jpg`,
              type: 'image',
              category: 'أحكام',
              uploadDate: new Date().toISOString().split('T')[0],
              size: '1.5 MB',
              fileUrl: '#',
              uploadedBy: currentUser.fullName
            });
          }

          // Automatic Status Sync: Build custom case status based on decision and whether it has a next hearing scheduled
          let dynamicStatus = parentCase.status;
          if (updated.decision) {
            if (updated.nextHearingDate) {
              dynamicStatus = `تأجلت للقرار: ${updated.decision}`;
            } else {
              dynamicStatus = `صدر القرار: ${updated.decision}`;
            }
          }

          const updatedCase: Case = {
            ...parentCase,
            nextHearingDate: updated.nextHearingDate || undefined,
            nextHearingTime: updated.nextHearingDate ? '09:00' : undefined,
            status: dynamicStatus,
            files: updatedFiles
          };
          await updateFirestoreDoc('cases', parentCase.id, updatedCase);

          // Automatic App-wide Notification Sync: Create system notification for all lawyers
          if (updated.decision) {
            const newNotification = {
              id: `noti-${Date.now()}`,
              text: `مزامنة تلقائية: رصد قرار الجلسة للقضية رقم (${parentCase.caseNumberFirstInstance}): ${updated.decision}`,
              type: 'success',
              date: new Date().toISOString().split('T')[0]
            };
            await addFirestoreDoc('notifications', newNotification, newNotification.id);
          }

          if (updated.nextHearingDate) {
            const hasPendingNext = sessions.some(s => s.caseId === updated.caseId && s.status === 'pending' && s.date === updated.nextHearingDate);
            if (!hasPendingNext) {
              const newPendingSession: HearingSession = {
                id: `session-${Date.now()}-next`,
                caseId: updated.caseId,
                caseNumber: updatedCase.caseNumberFirstInstance,
                caseYear: updatedCase.caseYearFirstInstance,
                clientName: updatedCase.clientName,
                opponentName: updatedCase.opponent?.name || 'غير محدد',
                court: updatedCase.court,
                circuit: updatedCase.circuit,
                type: updatedCase.type,
                date: updated.nextHearingDate!,
                time: '09:00',
                subject: updated.requirements || 'جلسة دفاع ومتابعة',
                status: 'pending',
                assignedLawyerId: updatedCase.assignedLawyerId,
                assignedLawyerName: users.find(u => u.id === updatedCase.assignedLawyerId)?.fullName
              };
              const pendingSessionsToDel = sessions.filter(s => s.caseId === updated.caseId && s.status === 'pending' && s.id !== updated.id);
              for (const s of pendingSessionsToDel) {
                await deleteFirestoreDoc('sessions', s.id);
              }
              await addFirestoreDoc('sessions', newPendingSession, newPendingSession.id);
            }
          }
        }
      }

      await addAuditLog(currentUser, 'edit', `رصد قرار مخرجات الجلسة المنعقدة بتاريخ ${updated.date} للقضية رقم ${updated.caseNumber}`);
    } catch (err) {
      console.error("Failed to update session:", err);
      throw err;
    }
  };

  // Clients updates
  const handleAddClient = async (client: Client) => {
    if (!currentUser) return;
    try {
      await addFirestoreDoc('clients', client, client.id);
      await addAuditLog(currentUser, 'add', `تسجيل موكل فرد جديد بالملفات: ${client.name} - رقم قومي: ${client.nationalId || 'غير مسجل'}`);
    } catch (err) {
      console.error("Failed to add client:", err);
      throw err;
    }
  };

  const handleUpdateClient = async (client: Client) => {
    if (!currentUser) return;
    try {
      await updateFirestoreDoc('clients', client.id, client);
      await addAuditLog(currentUser, 'edit', `تعديل بروفايل وبيانات الموكل الفردي: ${client.name}`);
    } catch (err) {
      console.error("Failed to update client:", err);
      throw err;
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    if (!currentUser) return;
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    try {
      await deleteFirestoreDoc('clients', clientId);
      await addAuditLog(currentUser, 'delete', `حذف نهائي للموكل الفردي: ${client.name}`);
    } catch (err) {
      console.error("Failed to delete client:", err);
      throw err;
    }
  };

  // Companies updates
  const handleAddCompany = async (company: Company) => {
    if (!currentUser) return;
    try {
      await addFirestoreDoc('companies', company, company.id);
      await addAuditLog(currentUser, 'add', `تأسيس وتقييد شركة تجارية جديدة بالدفاتر: ${company.name} | سجل رقم ${company.commercialRegister}`);
    } catch (err) {
      console.error("Failed to add company:", err);
      throw err;
    }
  };

  const handleUpdateCompany = async (company: Company) => {
    if (!currentUser) return;
    try {
      await updateFirestoreDoc('companies', company.id, company);
      await addAuditLog(currentUser, 'edit', `تعديل سجل الشركاء وعقود تأسيس شركة: ${company.name}`);
    } catch (err) {
      console.error("Failed to update company:", err);
      throw err;
    }
  };

  const handleDeleteCompany = async (companyId: string) => {
    if (!currentUser) return;
    const company = companies.find(c => c.id === companyId);
    if (!company) return;
    try {
      await deleteFirestoreDoc('companies', companyId);
      await addAuditLog(currentUser, 'delete', `حذف نهائي للشركة وسجلاتها: ${company.name}`);
    } catch (err) {
      console.error("Failed to delete company:", err);
      throw err;
    }
  };

  const handleArchiveCompany = async (companyId: string, reason: string, notes: string) => {
    if (!currentUser) return;
    const company = companies.find(c => c.id === companyId);
    if (!company) return;
    try {
      const updatedCo = {
        ...company,
        isArchived: true,
        archiveReason: reason,
        archiveDate: new Date().toISOString().split('T')[0],
        archiveNotes: notes
      };
      await updateFirestoreDoc('companies', companyId, updatedCo);
      await addAuditLog(currentUser, 'archive', `ترحيل شركة ${company.name} إلى أرشيف التصفية وحل النزاعات لسبب: ${reason}`);
    } catch (err) {
      console.error("Failed to archive company:", err);
      throw err;
    }
  };

  // Restore Handlers from Archive
  const handleRestoreCase = async (caseId: string) => {
    if (!currentUser) return;
    const targetCase = cases.find(c => c.id === caseId);
    if (!targetCase) return;
    try {
      const restored = {
        ...targetCase,
        isArchived: false,
        archiveReason: null,
        archiveDate: null,
        archiveNotes: null
      };
      await updateFirestoreDoc('cases', caseId, restored);
      await addAuditLog(currentUser, 'restore', `إلغاء أرشفة واستعادة القضية رقم: ${targetCase.caseNumberFirstInstance} إلى جدول الرول والقضايا النشطة`);
    } catch (err) {
      console.error("Failed to restore case:", err);
      throw err;
    }
  };

  const handleRestoreCompany = async (coId: string) => {
    if (!currentUser) return;
    const company = companies.find(c => c.id === coId);
    if (!company) return;
    try {
      const restored = {
        ...company,
        isArchived: false,
        archiveReason: null,
        archiveDate: null,
        archiveNotes: null
      };
      await updateFirestoreDoc('companies', coId, restored);
      await addAuditLog(currentUser, 'restore', `إلغاء ترحيل واستعادة شركة: ${company.name} لدفاتر الشركاء النشطة`);
    } catch (err) {
      console.error("Failed to restore company:", err);
      throw err;
    }
  };

  // User Administration Handlers
  const handleAddUser = async (newUser: User) => {
    if (!currentUser) return;
    try {
      await addFirestoreDoc('users', newUser, newUser.id);
      await addAuditLog(currentUser, 'add', `تعيين وإضافة زميل جديد للمكتب: ${newUser.fullName} - بصفة: ${newUser.title}`);
    } catch (err) {
      console.error("Failed to add user:", err);
      throw err;
    }
  };

  const handleUpdateUser = async (updatedUser: User) => {
    if (!currentUser) return;
    try {
      await updateFirestoreDoc('users', updatedUser.id, updatedUser);
      if (currentUser.id === updatedUser.id) {
        setCurrentUser(updatedUser);
      }
      await addAuditLog(currentUser, 'edit', `تعديل صلاحيات ومسؤوليات حساب الزميل: ${updatedUser.fullName}`);
    } catch (err) {
      console.error("Failed to update user:", err);
      throw err;
    }
  };

  const handleResetPassword = async (userId: string) => {
    if (!currentUser) return;
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;
    try {
      const updated = {
        ...targetUser,
        password: targetUser.phone,
        forcePasswordChange: true
      };
      await updateFirestoreDoc('users', userId, updated);
      await addAuditLog(currentUser, 'edit', `إعادة تعيين كلمة مرور الزميل: ${targetUser.fullName} افتراضياً لرقم هاتفه للتأمين`);
    } catch (err) {
      console.error("Failed to reset password:", err);
      throw err;
    }
  };

  const handleDeleteUser = (userId: string, passwordConfirm: string): boolean => {
    if (!currentUser) return false;
    const userPassword = currentUser.password || currentUser.phone;
    if (passwordConfirm !== userPassword) {
      return false;
    }
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return false;
    if (targetUser.id === currentUser.id) {
      alert('عفواً، لا يمكنك حذف حسابك الشخصي الذي تستخدمه حالياً لتسجيل الدخول.');
      return false;
    }
    deleteFirestoreDoc('users', userId).catch(err => console.error("Failed to delete user:", err));
    addAuditLog(currentUser, 'delete', `حذف نهائي فوري لحساب المحامي/الموظف: ${targetUser.fullName}`);
    return true;
  };

  // If we have a direct install query param, render a premium direct installation overlay
  if (showDirectInstallOverlay) {
    return (
      <div className="fixed inset-0 bg-[#0d121f] flex flex-col items-center justify-center p-6 z-[9999] text-center font-sans relative overflow-hidden" dir="rtl">
        {/* Decorative background spots */}
        <div className="absolute top-[10%] left-[20%] w-[450px] h-[450px] bg-amber-500/[0.06] rounded-full blur-[110px]" />
        <div className="absolute bottom-[10%] right-[10%] w-[450px] h-[450px] bg-blue-500/[0.05] rounded-full blur-[110px]" />

        <div className="max-w-md w-full bg-[#121b2e] border-2 border-amber-500/30 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl space-y-8 relative z-10 overflow-hidden">
          {/* Inner dashed line for visual flair */}
          <div className="absolute inset-2.5 rounded-[2rem] border border-dashed border-amber-500/15 pointer-events-none" />

          <div className="w-20 h-20 bg-amber-500/10 border-2 border-amber-500/30 rounded-3xl flex items-center justify-center text-amber-500 mx-auto shadow-lg shadow-amber-950/20 animate-bounce">
            <Download className="w-10 h-10 text-amber-500" />
          </div>
          
          <div className="space-y-3 relative z-10">
            <h3 className="text-xl font-black text-white tracking-tight">بوابة تثبيت التطبيق المباشر</h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-semibold">
              لقد تم فتح التطبيق في نافذة خارجية معتمدة بنجاح للبدء بالتثبيت وتفادي قيود الحظر المطبقة داخل النوافذ المعزولة (iFrames).
            </p>
          </div>

          <div className="space-y-4 relative z-10">
            {deferredPrompt ? (
              <div className="space-y-3">
                <p className="text-[11px] text-amber-300 font-bold bg-amber-500/5 py-1.5 px-3 rounded-lg border border-amber-500/15 inline-block">
                  ✓ محرك التثبيت الفوري جاهز الآن للتشغيل بنقرة واحدة
                </p>
                <button
                  onClick={async () => {
                    try {
                      await deferredPrompt.prompt();
                      const { outcome } = await deferredPrompt.userChoice;
                      console.log(`User response to prompt: ${outcome}`);
                    } catch (err) {
                      console.error(err);
                    }
                    setDeferredPrompt(null);
                    setShowDirectInstallOverlay(false);
                    try {
                      const newUrl = window.location.pathname + window.location.hash;
                      window.history.replaceState({}, document.title, newUrl);
                    } catch (e) {}
                  }}
                  className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-black text-sm py-4 px-6 rounded-2xl transition-all duration-150 shadow-xl shadow-amber-500/20 hover:shadow-amber-500/35 hover:scale-[1.02] active:scale-95 cursor-pointer flex items-center justify-center gap-3 animate-pulse"
                >
                  <Download className="w-5 h-5 text-slate-950" />
                  <span>تثبيت التطبيق الآن مباشرة على جهازك</span>
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-col items-center justify-center space-y-2 py-2">
                  <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-[11px] text-amber-300 font-bold leading-relaxed animate-pulse">
                    جاري الاتصال بـ Service Worker وتحميل محرك التثبيت الفوري...
                  </p>
                </div>
                
                {/* Safari instructions as a robust backup */}
                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl text-right space-y-3">
                  <p className="text-xs font-bold text-amber-400 flex items-center gap-1.5 justify-start">
                    <Scale className="w-4 h-4" />
                    تثبيت يدوي لأجهزة آبل (iOS / Safari / macOS):
                  </p>
                  <ul className="text-[11px] text-slate-300 space-y-2 list-disc pr-4 font-medium leading-relaxed">
                    <li>اضغط على زر <strong>المشاركة (Share ⎋)</strong> في أسفل أو أعلى المتصفح.</li>
                    <li>من قائمة الخيارات، اختر <strong>إضافة إلى الصفحة الرئيسية (Add to Home Screen ➕)</strong>.</li>
                    <li>اضغط على <strong>إضافة (Add)</strong> لتثبيت التطبيق كبرنامج مستقل بالكامل.</li>
                  </ul>
                </div>
              </div>
            )}

            <button
              onClick={() => {
                setShowDirectInstallOverlay(false);
                try {
                  const newUrl = window.location.pathname + window.location.hash;
                  window.history.replaceState({}, document.title, newUrl);
                } catch (e) {}
              }}
              className="w-full text-xs text-slate-400 hover:text-white transition-colors cursor-pointer text-center py-2 underline"
            >
              تخطي التثبيت مؤقتاً والدخول كمتصفح عادي
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render loading state if users are not yet loaded from Firestore or if we have an active session that isn't fully synchronized/verified yet
  if (!isUsersLoaded || !officeSettings || (sessionUser && !currentUser)) {
    return (
      <div className="min-h-screen bg-[#0a1931] flex flex-col items-center justify-center font-sans text-slate-100 relative overflow-hidden" dir="rtl">
        {/* Spotlights */}
        <div className="absolute top-[15%] left-[25%] w-[450px] h-[450px] bg-amber-500/5 rounded-full blur-[110px]" />
        <div className="absolute top-[40%] right-[20%] w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[130px]" />
        <div className="flex flex-col items-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-lg">
            <Scale className="w-8 h-8 text-amber-500 animate-pulse" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-sm font-extrabold text-slate-200">بوابة مؤسسة رميح للمحاماة</h2>
            <p className="text-xs text-slate-400">جاري الاتصال السحابي وتأمين بوابة الأنظمة القضائية...</p>
          </div>
        </div>
      </div>
    );
  }



  // If not logged in, render authentication wall
  if (!currentUser) {
    return (
      <>
        <LoginScreen 
          users={users} 
          onLoginSuccess={handleLoginSuccess} 
          isInstalledApp={isInstalledApp}
          onInstallClick={() => {
            const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
            if (isInIframe) {
              const targetUrl = window.location.origin + window.location.pathname + '?triggerInstall=true' + window.location.hash;
              const newWin = window.open(targetUrl, '_blank');
              if (newWin) {
                newWin.focus();
              } else {
                setShowInstallModal(true);
              }
            } else if (deferredPrompt) {
              triggerInstall();
            } else {
              setShowInstallModal(true);
            }
          }}
        />
        <InstallModal
          isOpen={showInstallModal}
          onClose={() => setShowInstallModal(false)}
          onDirectInstall={triggerInstall}
          hasDirectPrompt={!!deferredPrompt}
        />
      </>
    );
  }

  const isSystemFullyActivated = isSystemUnlocked && isDirectorAssigned;

  const sidebarMenuItems = [
    {
      id: 'dashboard' as const,
      title: 'الرئيسية',
      desc: 'الأداء العام والتقارير',
      icon: LayoutDashboard,
      iconColor: '#F5B041',
      permissionKey: null,
    },
    {
      id: 'cases' as const,
      title: 'القضايا والدعاوى',
      desc: 'ملفات القضايا والشركات',
      icon: Scale,
      iconColor: '#14B8A6',
      permissionKey: 'viewCases' as const,
    },
    {
      id: 'tasks' as const,
      title: 'إدارة المهام',
      desc: 'العمليات والتكليفات اليومية',
      icon: ClipboardList,
      iconColor: '#3B82F6',
      permissionKey: null,
    },
    {
      id: 'agenda' as const,
      title: 'أجندة الجلسات',
      desc: 'جدول حضور الجلسات اليومية',
      icon: Calendar,
      iconColor: '#8B5CF6',
      permissionKey: null,
    },
    {
      id: 'clients' as const,
      title: 'سجل الموكلين',
      desc: 'بيانات الموكلين الأفراد',
      icon: Users,
      iconColor: '#22C55E',
      permissionKey: 'viewClients' as const,
    },
    {
      id: 'fees' as const,
      title: 'المعاملات المالية',
      desc: 'الأتعاب وسندات القبض',
      icon: CreditCard,
      iconColor: '#FB923C',
      permissionKey: 'viewFees' as const,
    },
    {
      id: 'realestate' as const,
      title: 'إدارة العقارات والتحصيل',
      desc: 'إيجارات الملاك والتحصيل الرقمي',
      icon: Building2,
      iconColor: '#F5B041',
      permissionKey: null,
    },
    {
      id: 'users' as const,
      title: 'إدارة المستخدمين',
      desc: 'المحامون وصلاحيات العمل',
      icon: Shield,
      iconColor: '#2563EB',
      permissionKey: null,
    },
    {
      id: 'archive' as const,
      title: 'الأرشيف العام',
      desc: 'القضايا والملفات المغلقة',
      icon: Archive,
      iconColor: '#7C3AED',
      permissionKey: null,
    },
    {
      id: 'settings' as const,
      title: 'إعدادات النظام',
      desc: 'تهيئة وإعدادات المكتب',
      icon: Settings,
      iconColor: '#A5B4CF',
      permissionKey: null,
    },
  ];

  // Custom premium icon styling mapping based on tab and active/inactive state
  const getIconClass = (tab: string, isActive: boolean) => {
    if (!isSystemFullyActivated && tab !== 'settings') {
      return 'w-5 h-5 shrink-0 text-slate-600 transition-all duration-300';
    }
    const colorMap: Record<string, string> = {
      dashboard: isActive ? 'text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]' : 'text-slate-400 group-hover:text-sky-400 group-hover:scale-110',
      cases: isActive ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'text-slate-400 group-hover:text-amber-400 group-hover:scale-110',
      tasks: isActive ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'text-slate-400 group-hover:text-emerald-400 group-hover:scale-110',
      agenda: isActive ? 'text-violet-400 drop-shadow-[0_0_8px_rgba(167,139,250,0.5)]' : 'text-slate-400 group-hover:text-violet-400 group-hover:scale-110',
      clients: isActive ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'text-slate-400 group-hover:text-cyan-400 group-hover:scale-110',
      fees: isActive ? 'text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.5)]' : 'text-slate-400 group-hover:text-rose-400 group-hover:scale-110',
      realestate: isActive ? 'text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'text-slate-400 group-hover:text-amber-500 group-hover:scale-110',
      users: isActive ? 'text-teal-400 drop-shadow-[0_0_8px_rgba(45,212,191,0.5)]' : 'text-slate-400 group-hover:text-teal-400 group-hover:scale-110',
      archive: isActive ? 'text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]' : 'text-slate-400 group-hover:text-indigo-400 group-hover:scale-110',
      settings: isActive ? 'text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'text-slate-400 group-hover:text-amber-500 group-hover:scale-110',
    };
    return `${colorMap[tab] || 'text-slate-400'} w-5 h-5 shrink-0 transition-all duration-300`;
  };

  // Define sidebar navigation link classes
  const getNavLinkClass = (tab: typeof activeTab, forceFull = false) => {
    const collapsed = isSidebarCollapsed && !forceFull;
    const base = `w-full flex items-center ${collapsed ? 'justify-center py-3.5 px-0' : 'gap-3.5 px-4 py-3'} rounded-xl text-xs font-bold transition-all duration-200 border text-right relative overflow-hidden group`;
    
    // If system is not activated and this tab is not settings, dim it and show it's locked
    if (!isSystemFullyActivated && tab !== 'settings') {
      if (activeTab === tab) {
        return `${base} bg-slate-900/40 text-slate-500 border-dashed border-slate-800/80 cursor-not-allowed opacity-60`;
      }
      return `${base} text-slate-600 border-transparent hover:text-amber-500/85 hover:bg-slate-900/20 opacity-50`;
    }

    if (activeTab === tab) {
      return `${base} bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white border-slate-700/80 shadow-lg shadow-black/30 ${!collapsed ? 'before:absolute before:right-0 before:top-0 before:bottom-0 before:w-1.5 before:bg-gradient-to-b before:from-amber-400 before:to-amber-500' : ''}`;
    }
    return `${base} text-slate-400 border-transparent hover:text-slate-100 hover:bg-slate-800/50`;
  };

  return (
    <div className="h-screen min-h-screen overflow-hidden bg-[#0d121f] flex flex-col font-sans text-slate-100 selection:bg-amber-500 selection:text-slate-950 overflow-x-clip relative" dir="rtl">
      
      {/* Background decoration layer with name of firm and aesthetic legal motifs */}
      <div className="fixed inset-0 pointer-events-none select-none z-0 overflow-hidden bg-gradient-to-b from-[#0b0e17] via-[#0f1524] to-[#0c0f1a]">
        
        {/* Soft elegant glowing atmospheric spotlights (coordinated with amber/gold/blue accents) */}
        {/* Amber/Gold Spotlights behind cards for high-end Apple/Stripe glow */}
        <div className="absolute top-[15%] left-[25%] w-[450px] h-[450px] bg-amber-500/[0.04] rounded-full blur-[110px] pointer-events-none" />
        <div className="absolute top-[40%] right-[20%] w-[500px] h-[500px] bg-blue-500/[0.04] rounded-full blur-[130px] pointer-events-none" />
        <div className="absolute bottom-[10%] left-[10%] w-[600px] h-[600px] bg-[#F5B041]/[0.03] rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute bottom-[25%] right-[5%] w-[550px] h-[550px] bg-sky-500/[0.03] rounded-full blur-[140px] pointer-events-none" />

        {/* Apple/Linear style gold grid lines (6-8% Opacity & 30px Blur) */}
        <div className="absolute inset-0 opacity-[0.08] backdrop-blur-[30px] overflow-hidden">
          <svg className="w-full h-full" viewBox="0 0 1440 900" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="gold-line-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F5B041" stopOpacity="0.8" />
                <stop offset="30%" stopColor="#FAD7A0" stopOpacity="0.4" />
                <stop offset="70%" stopColor="#D4AC0D" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#F5B041" stopOpacity="0.1" />
              </linearGradient>
              <linearGradient id="blue-glow-line" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            {/* Elegant curved abstract Stripe/Apple-like lines */}
            <path d="M-100,200 C300,50 600,450 1100,100 C1300,-20 1500,50 1600,100" stroke="url(#gold-line-grad)" strokeWidth="1.5" />
            <path d="M-200,400 C400,200 700,600 1200,300 C1400,150 1500,250 1700,200" stroke="url(#gold-line-grad)" strokeWidth="1" />
            <path d="M0,600 C500,400 800,800 1300,500" stroke="url(#gold-line-grad)" strokeWidth="1" />
            <path d="M-50,150 C450,350 850,50 1250,250" stroke="url(#blue-glow-line)" strokeWidth="2" />
            {/* Fine background Grid */}
            <pattern id="grid-pattern" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#F5B041" strokeWidth="0.5" strokeOpacity="0.15" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#grid-pattern)" />
          </svg>
        </div>

        {/* Classical Marble Column Pillars on the far left & far right edges */}
        <div className="absolute inset-y-0 left-0 w-[120px] opacity-[0.08] hidden xl:block pointer-events-none">
          <svg className="h-full w-full" viewBox="0 0 120 800" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="column-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#1E293B" />
                <stop offset="30%" stopColor="#E2E8F0" />
                <stop offset="50%" stopColor="#FFFFFF" />
                <stop offset="70%" stopColor="#CBD5E1" />
                <stop offset="100%" stopColor="#0F172A" />
              </linearGradient>
              <linearGradient id="gold-cap-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F5B041" />
                <stop offset="100%" stopColor="#D4AC0D" />
              </linearGradient>
            </defs>
            <rect x="15" y="0" width="90" height="800" fill="url(#column-grad)" />
            <line x1="25" y1="50" x2="25" y2="750" stroke="#000" strokeOpacity="0.25" strokeWidth="1.5" />
            <line x1="40" y1="50" x2="40" y2="750" stroke="#000" strokeOpacity="0.25" strokeWidth="1.5" />
            <line x1="55" y1="50" x2="55" y2="750" stroke="#000" strokeOpacity="0.25" strokeWidth="1.5" />
            <line x1="70" y1="50" x2="70" y2="750" stroke="#FFF" strokeOpacity="0.4" strokeWidth="2" />
            <line x1="85" y1="50" x2="85" y2="750" stroke="#000" strokeOpacity="0.25" strokeWidth="1.5" />
            <line x1="100" y1="50" x2="100" y2="750" stroke="#000" strokeOpacity="0.25" strokeWidth="1.5" />
            <rect x="5" y="15" width="110" height="35" rx="3" fill="url(#gold-cap-grad)" />
            <rect x="0" y="5" width="120" height="12" fill="#E2E8F0" />
            <rect x="5" y="750" width="110" height="30" rx="3" fill="url(#gold-cap-grad)" />
            <rect x="0" y="780" width="120" height="20" fill="#E2E8F0" />
          </svg>
        </div>

        <div className="absolute inset-y-0 right-0 w-[120px] opacity-[0.08] hidden xl:block pointer-events-none">
          <svg className="h-full w-full" viewBox="0 0 120 800" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="15" y="0" width="90" height="800" fill="url(#column-grad)" />
            <line x1="25" y1="50" x2="25" y2="750" stroke="#000" strokeOpacity="0.25" strokeWidth="1.5" />
            <line x1="40" y1="50" x2="40" y2="750" stroke="#000" strokeOpacity="0.25" strokeWidth="1.5" />
            <line x1="55" y1="50" x2="55" y2="750" stroke="#000" strokeOpacity="0.25" strokeWidth="1.5" />
            <line x1="70" y1="50" x2="70" y2="750" stroke="#FFF" strokeOpacity="0.4" strokeWidth="2" />
            <line x1="85" y1="50" x2="85" y2="750" stroke="#000" strokeOpacity="0.25" strokeWidth="1.5" />
            <line x1="100" y1="50" x2="100" y2="750" stroke="#000" strokeOpacity="0.25" strokeWidth="1.5" />
            <rect x="5" y="15" width="110" height="35" rx="3" fill="url(#gold-cap-grad)" />
            <rect x="0" y="5" width="120" height="12" fill="#E2E8F0" />
            <rect x="5" y="750" width="110" height="30" rx="3" fill="url(#gold-cap-grad)" />
            <rect x="0" y="780" width="120" height="20" fill="#E2E8F0" />
          </svg>
        </div>

        {/* Elegant Law Library / Bookshelf Rows Watermark in the deep background (Opacity 8%) */}
        <div className="absolute inset-0 opacity-[0.06] mix-blend-screen pointer-events-none overflow-hidden flex flex-col justify-around py-12 px-24">
          <svg className="w-full h-full text-white" viewBox="0 0 1200 600" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g stroke="#F5B041" strokeWidth="1.5" strokeOpacity="0.4">
              <line x1="50" y1="180" x2="1150" y2="180" />
              <line x1="50" y1="360" x2="1150" y2="360" />
              <line x1="50" y1="540" x2="1150" y2="540" />
              <path d="M100,60 h20 v120 h-20 z M122,50 h18 v130 h-18 z M142,80 h30 v100 h-30 z M174,70 h25 v110 h-25 z" fill="#F5B041" fillOpacity="0.1" />
              <path d="M220,100 L240,60 L255,68 L235,108 z" fill="#F5B041" fillOpacity="0.1" />
              <path d="M400,60 h25 v120 h-25 z M428,55 h20 v125 h-20 z M450,75 h22 v105 h-22 z" fill="#FAD7A0" fillOpacity="0.1" />
              <path d="M900,80 h22 v100 h-22 z M924,65 h25 v115 h-25 z M951,70 h18 v110 h-18 z" fill="#D4AC0D" fillOpacity="0.1" />
              <path d="M150,240 h25 v120 h-25 z M177,230 h20 v130 h-20 z M199,250 h22 v110 h-22 z" fill="#F5B041" fillOpacity="0.1" />
              <path d="M500,240 h22 v120 h-22 z M524,235 h25 v125 h-25 z M551,250 h18 v110 h-18 z M571,260 h30 v100 h-30 z" fill="#D4AC0D" fillOpacity="0.1" />
              <path d="M780,270 L800,230 L815,238 L795,278 z" fill="#F5B041" fillOpacity="0.1" />
              <path d="M250,420 h22 v120 h-22 z M274,405 h25 v135 h-25 z M301,410 h18 v130 h-18 z" fill="#FAD7A0" fillOpacity="0.1" />
              <path d="M600,420 h35 v120 h-35 z M638,415 h18 v125 h-18 z" fill="#F5B041" fillOpacity="0.1" />
              <path d="M850,440 h22 v100 h-22 z M874,425 h25 v115 h-25 z M901,430 h18 v110 h-18 z" fill="#D4AC0D" fillOpacity="0.1" />
            </g>
          </svg>
        </div>

        {/* Large premium Official Logo watermark in center bg (Deeply layered, 16% opacity) */}
        <div className="absolute opacity-[0.16] flex flex-col items-center justify-center transform scale-110 md:scale-125 transition-all duration-700">
          <img 
            src="/icon-512.png" 
            alt="شعار مؤسسة رميح للمحاماة" 
            className="w-[380px] h-[380px] md:w-[480px] md:h-[480px] object-contain drop-shadow-[0_10px_45px_rgba(245,176,65,0.4)]"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Centered large luxury gold/slate seal containing the office details in background */}
        <div className="absolute w-[530px] h-[530px] rounded-full border border-[#F5B041]/10 flex items-center justify-center opacity-[0.12] p-6">
          <div className="w-full h-full rounded-full border-2 border-dashed border-[#FAD7A0]/15 flex items-center justify-center">
            <div className="w-4/5 h-4/5 rounded-full border border-[#D4AC0D]/20 flex flex-col items-center justify-center p-6 text-center">
              <img 
                src="/icon-192.png" 
                alt="شعار مائي صغير" 
                className="w-20 h-20 mb-3 object-contain drop-shadow-md"
                referrerPolicy="no-referrer"
              />
              <span className="text-xl font-black tracking-widest text-amber-400 block font-sans">مؤسسة رميح للمحاماة</span>
              <span className="text-[11px] font-extrabold text-slate-300 block mt-1.5 uppercase tracking-wider">والاستشارات القانونية</span>
              <span className="text-[10px] font-bold text-amber-500 block mt-1">تأسست عام ١٩٩٣</span>
            </div>
          </div>
        </div>

        {/* Elegant repeating background watermark text for a high-end luxury judicial feel */}
        <div className="absolute inset-0 flex flex-wrap gap-x-24 gap-y-20 items-center justify-center opacity-[0.035] rotate-[-12deg] scale-110">
          {Array.from({ length: 24 }).map((_, i) => (
            <span key={i} className="text-xs md:text-sm font-extrabold tracking-widest text-amber-400 whitespace-nowrap font-sans select-none">
              مؤسسة رميح للمحاماة والاستشارات القانونية
            </span>
          ))}
        </div>
      </div>
      
      {/* Offline Page Overlay */}
      {!isOnline && (
        <div className="fixed inset-0 bg-slate-950/95 flex items-center justify-center p-4 z-50 animate-fadeIn" dir="rtl">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl text-center space-y-6">
            <div className="relative w-20 h-20 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center text-amber-500 mx-auto">
              <Scale className="w-10 h-10 text-amber-500 animate-pulse" />
              <div className="absolute -bottom-1 -right-1 bg-rose-500 text-white p-1.5 rounded-full border border-slate-900 shadow-md">
                <ShieldAlert className="w-4 h-4" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-lg font-black text-white">لا يوجد اتصال بالإنترنت</h1>
              <p className="text-xs text-slate-300 leading-relaxed">
                يرجى التحقق من اتصال شبكتك للتمكن من تحميل القضايا والشركات ومزامنة بياناتك مع الخادم السحابي وإجراء عمليات الرفع والتحميل.
              </p>
            </div>
            
            <div className="h-px bg-slate-800" />
            
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs py-3.5 px-6 rounded-xl transition-all shadow-md shadow-amber-500/15 cursor-pointer flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4 text-slate-950" />
              إعادة محاولة الاتصال الآن
            </button>
          </div>
        </div>
      )}

      {/* Top Professional Header Ribbon */}
      <header className={`bg-gradient-to-r ${isScrolled ? 'from-slate-950/85 via-slate-900/85 to-slate-950/85 backdrop-blur-md border-b border-amber-500/35 shadow-lg shadow-black/40' : 'from-slate-950 via-slate-900 to-slate-950 border-b border-amber-500/20 shadow-md'} text-white px-3 md:px-5 h-14 md:h-16 flex items-center justify-between gap-3 sticky top-0 z-[100] transition-all duration-300`}>
        <div className="flex items-center gap-2 md:gap-3 overflow-hidden">
          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setIsSidebarOpenMobile(true)}
            className="lg:hidden w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 hover:text-amber-400 hover:bg-slate-800/60 rounded-xl transition-all cursor-pointer shrink-0"
            title="القائمة الرئيسية"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="relative shrink-0 w-8 h-8 md:w-11 md:h-11 rounded-xl overflow-hidden border border-amber-500/30 bg-slate-950 shadow-lg p-0.5 flex items-center justify-center">
            {!logoError ? (
              <img 
                src="/icon-192.png" 
                alt="شعار مؤسسة رميح" 
                className="w-full h-full object-contain rounded-lg" 
                referrerPolicy="no-referrer" 
                onError={() => setLogoError(true)}
              />
            ) : (
              <Scale className="w-5 h-5 md:w-6 md:h-6 text-amber-500" />
            )}
          </div>
          
          <div className="overflow-hidden">
            <h1 className="text-xs md:text-base font-extrabold tracking-tight text-white flex items-center gap-1.5 truncate">
              <span className="truncate">{officeName}</span>
              <span className="hidden sm:inline-block bg-amber-500/10 text-amber-400 text-[8px] md:text-[9px] px-2 py-0.5 rounded-full border border-amber-500/20 shrink-0">النظام المتكامل</span>
            </h1>
            <p className="text-[9px] md:text-[10px] text-slate-400 mt-0.5 font-medium truncate hidden md:block">
              {officeSubtitle}
            </p>
          </div>
        </div>

        {/* Dynamic Real-time Clock & Calendar Widget */}
        <div className="hidden md:flex items-center gap-3.5 bg-slate-900/65 border border-slate-800/80 p-2 px-3.5 rounded-xl font-mono text-xs text-slate-300">
          <div className="flex items-center gap-2 text-amber-400 font-extrabold border-l border-slate-800/80 pl-3">
            <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
            <span>{currentDateTime.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Africa/Cairo', numberingSystem: numberingSystem === 'english' ? 'latn' : 'arab' })}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-200 font-bold">
            <Calendar className="w-4 h-4 text-amber-500" />
            <span>{getDynamicDateString(currentDateTime, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
        </div>

        {/* Left Section: Lawyer Profile and Dedicated Upper-Left Logout Button */}
        <div className="flex items-center gap-2.5 md:gap-3.5 shrink-0">
          {/* Lawyer Profile Monitor widget */}
          <div className="flex items-center gap-2 md:gap-3 bg-slate-900/90 p-1.5 md:p-2.5 px-2.5 md:px-4 rounded-xl border border-slate-800/80 shadow-inner">
            <div className="text-right hidden sm:block">
              <span className="text-[8px] md:text-[9px] text-amber-500 font-extrabold block tracking-wider">{currentUser.title}</span>
              <span className="text-[10px] md:text-xs text-slate-100 font-bold block mt-0.5 hover:text-amber-400 transition-colors truncate max-w-28 md:max-w-44">{currentUser.fullName}</span>
            </div>
            {/* Minimal Avatar circle for visual pairing */}
            <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-[10px] font-black text-amber-500 font-mono">
              {currentUser.fullName.charAt(0)}
            </div>
          </div>

          {/* Premium Dedicated Logout Button on the absolute top-left */}
          <button
            onClick={handleLogout}
            className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 text-red-400 hover:text-red-300 font-black text-[10px] md:text-xs w-10 h-10 md:w-auto md:h-auto p-0 md:py-2 md:px-4 rounded-xl flex items-center justify-center gap-1.5 md:gap-2 transition-all active:scale-95 duration-150 cursor-pointer shadow-lg shadow-red-950/40 shrink-0"
            title="تسجيل خروج آمن من النظام"
          >
            <LogOut className="w-3.5 h-3.5 md:w-4 md:h-4 text-red-500 group-hover:rotate-12 transition-transform" />
            <span className="hidden md:inline">خروج</span>
          </button>
        </div>
      </header>

      {/* Main Scaffold Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row relative z-10 h-[calc(100vh-56px)] md:h-[calc(100vh-64px)] overflow-hidden">
        
        {/* Mobile Sidebar Backdrop */}
        {isSidebarOpenMobile && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[45] lg:hidden animate-fadeIn" 
            onClick={() => setIsSidebarOpenMobile(false)}
          />
        )}
        <aside className={`fixed inset-y-0 right-0 z-[50] w-72 p-5 flex flex-col space-y-6 transition-transform duration-300 transform lg:hidden ${isSidebarOpenMobile ? 'translate-x-0' : 'translate-x-full'} overflow-hidden select-none`}>
          {/* Glass Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f1d] via-[#111726] to-[#0a0f1d] -z-20" />
          <div className="absolute inset-0 backdrop-blur-[30px] -z-10" />

          {/* Elegant repeating watermark behind mobile sidebar navigation icons */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.035] select-none z-0 overflow-hidden flex flex-col justify-around py-16" dir="rtl">
            <span className="text-white text-[11px] font-black tracking-widest rotate-[-15deg] whitespace-nowrap block text-center">مؤسسة رميح للمحاماة والاستشارات القانونية</span>
            <span className="text-amber-400 text-xs font-black tracking-widest rotate-[-15deg] whitespace-nowrap block text-center">تأسست عام ١٩٩٣</span>
            <span className="text-white text-[11px] font-black tracking-widest rotate-[-15deg] whitespace-nowrap block text-center">مكتب الأستاذ عربي رميح</span>
            <span className="text-amber-400 text-xs font-black tracking-widest rotate-[-15deg] whitespace-nowrap block text-center">ريادة قانونية عريقة وموثوقة</span>
            <span className="text-white text-[11px] font-black tracking-widest rotate-[-15deg] whitespace-nowrap block text-center">مؤسسة رميح للمحاماة والاستشارات القانونية</span>
          </div>

          <div className="flex items-center justify-between border-b border-[#2C3F67]/50 pb-4 relative z-10">
            <div className="flex items-center gap-2">
              <div className="relative shrink-0 w-6 h-6 rounded-lg overflow-hidden border border-amber-500/30 bg-slate-950 p-0.5 flex items-center justify-center">
                {!logoError ? (
                  <img 
                    src="/icon-192.png" 
                    alt="شعار" 
                    className="w-full h-full object-contain rounded-md"
                    referrerPolicy="no-referrer"
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <Scale className="w-3.5 h-3.5 text-amber-500" />
                )}
              </div>
              <span className="text-xs text-amber-400 font-black tracking-widest uppercase">القائمة الرئيسية للمكتب</span>
            </div>
            <button 
              onClick={() => setIsSidebarOpenMobile(false)}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-900/40 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto pr-1 relative z-10">
            <span className="text-[10px] text-slate-400 font-bold block px-2 tracking-widest uppercase mb-2 mt-2">أقسام ومصنفات المكتب</span>
            
            {sidebarMenuItems.map((item) => {
              // Check permissions
              if (item.permissionKey && !currentUser.permissions[item.permissionKey]) {
                return null;
              }

              const isActive = activeTab === item.id;
              const isLocked = !isSystemFullyActivated && item.id !== 'settings';

              // Build button styling
              let btnClass = "w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 border text-right relative overflow-hidden group ";
              let iconWrapperClass = "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-all duration-300 ";

              if (isLocked) {
                btnClass += "bg-slate-950/20 text-slate-600 border-transparent cursor-not-allowed opacity-50";
                iconWrapperClass += "bg-slate-900/30 border-slate-800/20 text-slate-600";
              } else if (isActive) {
                btnClass += "bg-gradient-to-r from-[#FCD34D] to-[#F5B041] border-[#F5B041]/50 shadow-[0_4px_15px_rgba(245,176,65,0.25)] scale-[1.01] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:bg-[#081528] before:rounded-r-md";
                iconWrapperClass += "bg-[#081528]/85 border-[#081528]/25 shadow-sm text-[#F5B041]";
              } else {
                btnClass += "text-slate-300 border-transparent hover:text-white hover:bg-slate-800/40 hover:scale-[1.01]";
                iconWrapperClass += "bg-slate-900/40 border-[#2C3F67]/30 text-slate-400 group-hover:scale-105";
              }

              const IconComponent = item.icon;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (isLocked) return;
                    handleTabClick(item.id);
                    setIsSidebarOpenMobile(false);
                  }}
                  className={btnClass}
                >
                  <div className={iconWrapperClass}>
                    <IconComponent style={{ color: isActive ? '#F5B041' : (isLocked ? undefined : item.iconColor) }} className="w-4 h-4 shrink-0" />
                  </div>
                  <div className="text-right">
                    <span className={`block font-bold ${isActive ? 'text-[#081528]' : 'text-slate-100'}`}>{item.title}</span>
                    <span className={`block text-[9px] font-medium mt-0.5 ${isActive ? 'text-[#081528]/80' : 'text-[#9BA7C5]'}`}>{item.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Compact User Identity details on Mobile Sidebar */}
          <div className="bg-[#081528]/80 border border-[#2C3F67]/50 p-4 rounded-2xl text-center relative z-10 backdrop-blur-md">
            <span className="text-[10px] text-amber-500 font-extrabold block">{currentUser.title}</span>
            <span className="text-xs font-bold text-slate-100 block mt-1">{currentUser.fullName}</span>
          </div>
        </aside>

        {/* Navigation Sidebar Panel (Desktop Collapsible) */}
        <aside className={`hidden lg:flex flex-col border-l border-[#2C3F67]/40 p-2.5 shrink-0 transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-52'} space-y-3 overflow-hidden select-none relative h-full`}>
          {/* Glass Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f1d] via-[#111726] to-[#0a0f1d] -z-20" />
          <div className="absolute inset-0 backdrop-blur-[30px] -z-10" />
          
          {/* Elegant repeating watermark behind desktop sidebar navigation icons */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.035] select-none z-0 overflow-hidden flex flex-col justify-around py-20" dir="rtl">
            <span className="text-white text-[11px] font-black tracking-widest rotate-[-15deg] whitespace-nowrap block text-center">مؤسسة رميح للمحاماة والاستشارات القانونية</span>
            <span className="text-amber-400 text-xs font-black tracking-widest rotate-[-15deg] whitespace-nowrap block text-center">تأسست عام ١٩٩٣</span>
            <span className="text-white text-[11px] font-black tracking-widest rotate-[-15deg] whitespace-nowrap block text-center">مكتب الأستاذ عربي رميح</span>
            <span className="text-amber-400 text-xs font-black tracking-widest rotate-[-15deg] whitespace-nowrap block text-center">ريادة قانونية عريقة وموثوقة</span>
            <span className="text-white text-[11px] font-black tracking-widest rotate-[-15deg] whitespace-nowrap block text-center">مؤسسة رميح للمحاماة والاستشارات القانونية</span>
          </div>
          
          {/* Subtle Law Library Backdrop (7% opacity overlay) */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.07] mix-blend-overlay -z-15 overflow-hidden">
            <svg className="w-full h-full text-white" viewBox="0 0 300 800" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 700 h260 v20 h-260 z" fill="currentColor" />
              <path d="M30 680 h240 v20 h-240 z" fill="currentColor" />
              <rect x="50" y="300" width="20" height="380" fill="currentColor" />
              <rect x="100" y="300" width="20" height="380" fill="currentColor" />
              <rect x="150" y="300" width="20" height="380" fill="currentColor" />
              <rect x="200" y="300" width="20" height="380" fill="currentColor" />
              <rect x="230" y="300" width="20" height="380" fill="currentColor" />
              <path d="M25 270 h250 v30 h-250 z" fill="currentColor" />
              <path d="M40 230 l110 -70 l110 70 z" fill="currentColor" />
              <g transform="translate(90, 20) scale(0.55)">
                <path d="M100 100 h100 v10 h-100 z" fill="currentColor" />
                <line x1="150" y1="110" x2="150" y2="300" stroke="currentColor" strokeWidth="8" />
                <line x1="50" y1="150" x2="250" y2="150" stroke="currentColor" strokeWidth="6" />
                <line x1="50" y1="150" x2="20" y2="230" stroke="currentColor" strokeWidth="3" />
                <line x1="50" y1="150" x2="80" y2="230" stroke="currentColor" strokeWidth="3" />
                <path d="M10 230 h80 a40 40 0 0 1 -80 0 z" fill="currentColor" />
                <line x1="250" y1="150" x2="220" y2="230" stroke="currentColor" strokeWidth="3" />
                <line x1="250" y1="150" x2="280" y2="230" stroke="currentColor" strokeWidth="3" />
                <path d="M210 230 h80 a40 40 0 0 1 -80 0 z" fill="currentColor" />
              </g>
            </svg>
          </div>

          {/* Navigation Links Area */}
          <div className="space-y-1 flex-1 overflow-y-auto pr-0.5 select-none relative z-10 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
            {sidebarMenuItems.map((item) => {
              // Check permissions
              if (item.permissionKey && !currentUser.permissions[item.permissionKey]) {
                return null;
              }

              const isActive = activeTab === item.id;
              const isLocked = !isSystemFullyActivated && item.id !== 'settings';

              // If collapsed
              if (isSidebarCollapsed) {
                let colBtnClass = "w-full h-10 rounded-lg flex items-center justify-center border transition-all duration-250 relative group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#F5B041]/60 focus:border-[#F5B041] sidebar-menu-btn ";
                let colIconWrapperClass = "w-7.5 h-7.5 rounded-md flex items-center justify-center border transition-all duration-300 ";

                if (isLocked) {
                  colBtnClass += "bg-slate-950/20 text-slate-600 border-transparent cursor-not-allowed opacity-50";
                  colIconWrapperClass += "bg-slate-900/30 border-slate-800/20 text-slate-600";
                } else if (isActive) {
                  colBtnClass += "bg-gradient-to-l from-[#FCD34D] to-[#F5B041] border-[#F5B041] shadow-[0_0_15px_rgba(245,176,65,0.25)] scale-[1.03] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:bg-gradient-to-b before:from-[#081528] before:to-[#081528] before:rounded-r-md";
                  colIconWrapperClass += "bg-[#081528]/85 border-[#081528]/25 shadow-md text-[#F5B041]";
                } else {
                  colBtnClass += "text-slate-400 border-transparent hover:text-slate-100 hover:bg-[#081528]/40 hover:border-[#2C3F67]/50 hover:scale-[1.03] focus:text-slate-100 focus:bg-[#081528]/40 focus:border-[#F5B041]/50 focus:scale-[1.03]";
                  colIconWrapperClass += "bg-slate-900/40 border-[#2C3F67]/30 group-hover:scale-105 group-focus:scale-105";
                }

                const IconComponent = item.icon;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (isLocked) return;
                      handleTabClick(item.id);
                    }}
                    className={colBtnClass}
                    title={`${item.title} - ${item.desc}`}
                    data-active={isActive ? "true" : "false"}
                  >
                    <div className={colIconWrapperClass}>
                      <IconComponent style={{ color: isActive ? '#F5B041' : (isLocked ? undefined : item.iconColor) }} className="w-3.5 h-3.5 shrink-0" />
                    </div>
                  </button>
                );
              }

              // If expanded
              let btnClass = "w-full h-[42px] rounded-xl px-2.5 flex items-center justify-start gap-2 cursor-pointer transition-all duration-250 relative border select-none group focus:outline-none focus:ring-2 focus:ring-[#F5B041]/60 focus:border-[#F5B041] sidebar-menu-btn ";
              let iconWrapperClass = "w-7.5 h-7.5 rounded-lg flex items-center justify-center shrink-0 border transition-all duration-300 shadow-sm ";

              if (isLocked) {
                btnClass += "bg-slate-950/20 text-slate-600 border-transparent cursor-not-allowed opacity-50";
                iconWrapperClass += "bg-slate-900/30 border-slate-800/20 text-slate-600";
              } else if (isActive) {
                btnClass += "bg-gradient-to-l from-[#FCD34D] to-[#F5B041] border-[#F5B041] shadow-[0_3px_10px_rgba(245,176,65,0.22)] ring-1 ring-[#F5B041]/10 scale-[1.01] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:bg-gradient-to-b before:from-[#081528] before:to-[#081528] before:rounded-r-md";
                iconWrapperClass += "bg-[#081528]/85 border-[#081528]/25 shadow-inner text-[#F5B041]";
              } else {
                btnClass += "bg-[#081528]/40 backdrop-blur-[24px] border-[#2C3F67]/60 text-slate-300 shadow-[0_10px_25px_rgba(0,0,0,0.18)] hover:text-white hover:bg-[#081528]/60 hover:border-[#F5B041]/50 hover:scale-[1.01] hover:shadow-[0_12px_25px_rgba(0,0,0,0.22)] focus:text-white focus:bg-[#081528]/60 focus:border-[#F5B041]/70 focus:scale-[1.01]";
                iconWrapperClass += "bg-slate-900/50 border-[#2C3F67]/50 group-hover:scale-105 group-focus:scale-105";
              }

              const IconComponent = item.icon;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (isLocked) return;
                    handleTabClick(item.id);
                  }}
                  className={btnClass}
                  data-active={isActive ? "true" : "false"}
                >
                  <div className={iconWrapperClass}>
                    <IconComponent style={{ color: isActive ? '#F5B041' : (isLocked ? undefined : item.iconColor) }} className="w-3.5 h-3.5 shrink-0" />
                  </div>
                  <div className="text-right overflow-hidden min-w-0 flex-1">
                    <span className={`block text-[11px] font-black leading-tight truncate ${isActive ? 'text-[#081528]' : 'text-white'}`}>{item.title}</span>
                    <span className={`block text-[8px] font-medium mt-0.5 leading-none truncate ${isActive ? 'text-[#081528]/80' : 'text-[#9BA7C5]'}`}>{item.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Collapse/Expand toggle button for desktop */}
          <div className="pt-2.5 border-t border-slate-900 relative z-10">
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="w-full flex items-center justify-center gap-1.5 p-1.5 rounded-lg bg-slate-900/60 border border-[#2C3F67]/30 hover:bg-slate-800/80 text-slate-400 hover:text-white transition-all cursor-pointer text-[10.5px] font-bold"
              title={isSidebarCollapsed ? "توسيع القائمة" : "طي القائمة"}
            >
              {isSidebarCollapsed ? (
                <ChevronLeft className="w-4 h-4 text-[#F5B041] animate-pulse" />
              ) : (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-[#F5B041] shrink-0" />
                  <span className="truncate">تصغير القائمة</span>
                </>
              )}
            </button>
          </div>
        </aside>

        {/* Dynamic Panel Workspace */}
        <main className={`flex-1 p-2.5 sm:p-3 md:p-3.5 w-full overflow-x-hidden h-full overflow-y-auto ${activeTab === 'realestate' ? 're-dark-panel' : ''}`}>
          {activeTab === 'dashboard' && (
            <div key={`dashboard-${numberingSystem}`}>
              <Dashboard 
                cases={cases} 
                sessions={sessions} 
                clients={clients} 
                companies={companies} 
                currentUser={currentUser} 
                onNavigateToTab={handleTabClick}
                onAddSession={handleAddSession}
                onUpdateSession={handleUpdateSession}
                users={users}
              />
            </div>
          )}

          {activeTab === 'cases' && currentUser.permissions.viewCases && (
            <div key={`cases-${numberingSystem}`}>
              <CasesPanel 
                cases={cases} 
                clients={clients} 
                companies={companies}
                users={users} 
                currentUser={currentUser} 
                onAddCase={handleAddCase} 
                onUpdateCase={handleUpdateCase} 
                onArchiveCase={handleArchiveCase}
                onDeleteCase={handleDeleteCase} 
                onAddCompany={handleAddCompany}
                onUpdateCompany={handleUpdateCompany}
                onArchiveCompany={handleArchiveCompany}
                onDeleteCompany={handleDeleteCompany}
                onAddClient={handleAddClient}
                onUpdateClient={handleUpdateClient}
                onAddAuditLog={(u, action, details) => addAuditLog(u, action as any, details)}
                onAddTask={(task) => handleSetTasks(prev => [task, ...prev])}
                sessions={sessions}
                onAddSession={handleAddSession}
                onUpdateSession={handleUpdateSession}
                tasks={tasks}
                onNavigateToTab={handleTabClick}
                externalSearchQuery={casesSearchQuery}
                onClearExternalSearch={() => setCasesSearchQuery('')}
                returnToClient={returnToClient}
                onSetReturnToClient={setReturnToClient}
                onSetSelectedClientIdForReturn={setSelectedClientIdForReturn}
              />
            </div>
          )}

          {activeTab === 'agenda' && (
            <div key={`agenda-${numberingSystem}`}>
              <AgendaPanel 
                sessions={sessions} 
                cases={cases} 
                users={users}
                currentUser={currentUser} 
                onAddSession={handleAddSession} 
                onUpdateSession={handleUpdateSession} 
                onNavigateToTab={handleTabClick}
                onSearchCase={setCasesSearchQuery}
              />
            </div>
          )}

          {activeTab === 'clients' && currentUser.permissions.viewClients && (
            <div key={`clients-${numberingSystem}`}>
              <ClientsPanel 
                clients={clients} 
                companies={companies} 
                cases={cases} 
                currentUser={currentUser} 
                sessions={sessions}
                users={users}
                onAddClient={handleAddClient} 
                onUpdateClient={handleUpdateClient} 
                onDeleteClient={handleDeleteClient}
                onAddCompany={handleAddCompany} 
                onUpdateCompany={handleUpdateCompany} 
                onArchiveCompany={handleArchiveCompany} 
                onDeleteCompany={handleDeleteCompany}
                onNavigateToTab={handleTabClick}
                onSetCasesSearchQuery={setCasesSearchQuery}
                returnToClient={returnToClient}
                onSetReturnToClient={setReturnToClient}
                selectedClientId={selectedClientIdForReturn}
                onClearSelectedClientId={() => setSelectedClientIdForReturn(null)}
                onSetSelectedClientIdForReturn={setSelectedClientIdForReturn}
              />
            </div>
          )}

          {activeTab === 'fees' && currentUser.permissions.viewFees && (
            <div key={`fees-${numberingSystem}`}>
              <FeesPanel 
                cases={cases} 
                currentUser={currentUser} 
                onUpdateCase={handleUpdateCase} 
              />
            </div>
          )}

          {activeTab === 'users' && (
            (currentUser.role === 'admin' || currentUser.permissions.manageUsers) ? (
              <div key={`users-${numberingSystem}`}>
                <UsersPanel 
                  users={users} 
                  auditLogs={auditLogs} 
                  currentUser={currentUser} 
                  onAddUser={handleAddUser} 
                  onUpdateUser={handleUpdateUser} 
                  onResetPassword={handleResetPassword} 
                  onDeleteUser={handleDeleteUser}
                />
              </div>
            ) : null
          )}

          {activeTab === 'archive' && (
            <div key={`archive-${numberingSystem}`}>
              <ArchivePanel 
                cases={cases} 
                companies={companies} 
                currentUser={currentUser} 
                onRestoreCase={handleRestoreCase} 
                onRestoreCompany={handleRestoreCompany} 
                onAddCase={handleAddCase}
                onUpdateCase={handleUpdateCase}
                onDeleteCase={handleDeleteCase}
                onDeleteCompany={handleDeleteCompany}
                onAddCompany={handleAddCompany}
                onUpdateCompany={handleUpdateCompany}
                sessions={sessions}
                onAddSession={handleAddSession}
                users={users}
                clients={clients}
              />
            </div>
          )}

          {activeTab === 'tasks' && (
            <div key={`tasks-${numberingSystem}`}>
              <TasksPanel 
                tasks={tasks}
                setTasks={handleSetTasks}
                users={users}
                clients={clients}
                companies={companies}
                cases={cases}
                currentUser={currentUser}
                onAddAuditLog={(u, action, details) => addAuditLog(u, action as any, details)}
              />
            </div>
          )}

          {activeTab === 'realestate' && (
            <div key={`realestate-${numberingSystem}`} className="re-dark-panel w-full">
              <RealEstatePanel 
                currentUser={currentUser}
              />
            </div>
          )}

          {activeTab === 'settings' && (
            (currentUser.role === 'admin' || currentUser.permissions.manageSettings) ? (
              <div key={`settings-${numberingSystem}`}>
                <SettingsPanel 
                  currentUser={currentUser}
                  onAddAuditLog={(u, action, details) => addAuditLog(u, action as any, details)}
                  onDataReloadNeeded={handleDataReloadNeeded}
                  users={users}
                  onUpdateUser={handleUpdateUser}
                  officeSettings={officeSettings}
                  onUpdateSettings={handleUpdateSettings}
                />
              </div>
            ) : null
          )}
        </main>

      </div>

      {/* Professional Permission Warning Modal */}
      {showNoPermissionModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fadeIn" dir="rtl">
          <div className="bg-[#0b1d36] border-2 border-amber-500/30 rounded-3xl p-8 max-w-md w-full shadow-2xl text-center space-y-6 relative overflow-hidden">
            {/* Ambient decorative glowing spots */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/10 rounded-full blur-xl pointer-events-none" />

            <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center text-amber-500 mx-auto shadow-lg">
              <ShieldAlert className="w-8 h-8 text-amber-500 animate-bounce" />
            </div>
            
            <div className="space-y-3">
              <h3 className="text-base font-black text-white">تنبيه صلاحيات النظام الموحد</h3>
              <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                ليس لديك صلاحية للوصول إلى هذا القسم. يرجى التواصل مع المدير العام إذا كنت بحاجة إلى هذه الصلاحية.
              </p>
            </div>
            
            <div className="h-px bg-slate-800/80" />
            
            <button
              onClick={() => setShowNoPermissionModal(false)}
              className="w-full bg-gradient-to-r from-[#FCD34D] to-[#F5B041] hover:from-[#FCD34D]/90 hover:to-[#F5B041]/90 text-slate-950 font-extrabold text-xs py-3.5 px-6 rounded-xl transition-all shadow-md shadow-amber-500/15 cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.01]"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      <InstallModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        onDirectInstall={triggerInstall}
        hasDirectPrompt={!!deferredPrompt}
      />
    </div>
  );
}
