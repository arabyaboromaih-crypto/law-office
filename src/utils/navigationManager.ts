/**
 * Global Navigation & Back Handler Manager for AI Studio Law Firm Application.
 * Supports Android Back Button, Browser Popstate, Keyboard Shortcuts, Modal Stacks,
 * Detail Screen History, and Double-Tap Exit Confirmation.
 */

export interface ModalEntry {
  id: string;
  onClose: () => void;
  hasUnsavedChanges?: () => boolean;
}

export interface HistoryEntry {
  type: 'tab' | 'subview' | 'detail' | 'modal';
  id: string;
  onBack: () => void;
}

type ToastListener = (message: string | null) => void;

class NavigationManager {
  private modalStack: ModalEntry[] = [];
  private historyStack: HistoryEntry[] = [];
  private exitPromptTimer: NodeJS.Timeout | null = null;
  private exitPromptActive = false;
  private toastListeners: Set<ToastListener> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      // Initialize base window history state if needed
      if (!window.history.state) {
        window.history.replaceState({ appRoot: true, index: 0 }, '');
      }
    }
  }

  // Toast listener registration
  public subscribeToast(listener: ToastListener): () => void {
    this.toastListeners.add(listener);
    return () => this.toastListeners.delete(listener);
  }

  private notifyToast(msg: string | null) {
    this.toastListeners.forEach(listener => listener(msg));
  }

  // --- MODAL STACK MANAGEMENT ---
  public registerModal(entry: ModalEntry): () => void {
    // Avoid duplicates
    this.modalStack = this.modalStack.filter(m => m.id !== entry.id);
    this.modalStack.push(entry);

    // Push state to browser history so back button triggers popstate
    if (typeof window !== 'undefined') {
      window.history.pushState({ modalId: entry.id, stackLen: this.modalStack.length }, '');
    }

    return () => this.unregisterModal(entry.id);
  }

  public unregisterModal(id: string) {
    const prevLen = this.modalStack.length;
    this.modalStack = this.modalStack.filter(m => m.id !== id);
    if (prevLen !== this.modalStack.length && typeof window !== 'undefined') {
      // Clean up browser history state stack silently if modal closed by UI click
      if (window.history.state && window.history.state.modalId === id) {
        // Option to pop silently
      }
    }
  }

  public hasOpenModals(): boolean {
    return this.modalStack.length > 0;
  }

  // --- HISTORY STACK MANAGEMENT ---
  public pushNavigationState(entry: HistoryEntry) {
    // Avoid duplicate adjacent entries for same id
    if (this.historyStack.length > 0 && this.historyStack[this.historyStack.length - 1].id === entry.id) {
      return;
    }
    this.historyStack.push(entry);
    if (typeof window !== 'undefined') {
      window.history.pushState({ navId: entry.id, stackLen: this.historyStack.length }, '');
    }
  }

  public popNavigationState(id?: string) {
    if (id) {
      this.historyStack = this.historyStack.filter(h => h.id !== id);
    } else {
      this.historyStack.pop();
    }
  }

  // --- CORE BACK HANDLER LOGIC ---
  public handleGlobalBack(): boolean {
    // 1. Check if any Modal is open
    if (this.modalStack.length > 0) {
      const topModal = this.modalStack[this.modalStack.length - 1];
      
      // Check unsaved changes requirement
      if (topModal.hasUnsavedChanges && topModal.hasUnsavedChanges()) {
        const confirmClose = window.confirm('هناك تغييرات غير محفوظة، هل أنت تأكد من الإغلاق دون حفظ؟');
        if (!confirmClose) {
          // Re-push history state so user stays in modal on back
          if (typeof window !== 'undefined') {
            window.history.pushState({ modalId: topModal.id }, '');
          }
          return true; // handled, but stay
        }
      }

      this.modalStack.pop();
      try {
        topModal.onClose();
      } catch (err) {
        console.error('Error closing modal on back:', err);
      }
      return true;
    }

    // 2. Check if any Detail View or Sub-Tab or Tab history entry exists
    if (this.historyStack.length > 0) {
      const topHistory = this.historyStack.pop();
      if (topHistory) {
        try {
          topHistory.onBack();
        } catch (err) {
          console.error('Error navigating back:', err);
        }
        return true;
      }
    }

    // 3. Root View Exit Handler ("اضغط مرة أخرى للخروج")
    if (this.exitPromptActive) {
      // User pressed back a second time within 2.5 seconds -> allow standard exit / back
      return false; // let popstate/exit happen
    } else {
      this.exitPromptActive = true;
      this.notifyToast('اضغط مرة أخرى للخروج من التطبيق');

      // Keep user on page by pushing dummy root state
      if (typeof window !== 'undefined') {
        window.history.pushState({ appRoot: true, exitPending: true }, '');
      }

      if (this.exitPromptTimer) clearTimeout(this.exitPromptTimer);
      this.exitPromptTimer = setTimeout(() => {
        this.exitPromptActive = false;
        this.notifyToast(null);
      }, 2500);

      return true; // handled exit prompt
    }
  }
}

export const navigationManager = new NavigationManager();
