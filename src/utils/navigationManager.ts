/**
 * Global Navigation & Back Handler Manager for AI Studio Law Firm Application.
 * Supports Android Back Button, Browser Popstate, Keyboard Shortcuts, Modal Stacks,
 * Detail Screen History, and Double-Tap Exit Confirmation.
 */

import { useEffect } from 'react';

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
  private isListening = false;
  private isInternalPush = false;
  private isSilentPop = false;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        if (!window.history.state || !window.history.state.appGuard) {
          window.history.replaceState({ appRoot: true, index: 0 }, '');
          window.history.pushState({ appGuard: true, index: 1 }, '');
        }
      } catch (e) {
        console.error('History state initialization error:', e);
      }
      this.initGlobalListeners();
    }
  }

  public initGlobalListeners() {
    if (this.isListening || typeof window === 'undefined') return;
    this.isListening = true;

    // Handle Popstate (Android Back button, Browser Back button, gesture)
    window.addEventListener('popstate', () => {
      if (this.isInternalPush) {
        this.isInternalPush = false;
        return;
      }
      if (this.isSilentPop) {
        this.isSilentPop = false;
        return;
      }
      const handled = this.handleGlobalBack();
      if (handled && typeof window !== 'undefined') {
        this.isInternalPush = true;
        try {
          window.history.pushState({ appGuard: true }, '');
        } catch (e) {
          console.error('Re-push guard error:', e);
        }
        setTimeout(() => { this.isInternalPush = false; }, 50);
      }
    });

    // Handle Keydown (Backspace key on laptop/PC when not editing text, and Escape key)
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        const handled = this.handleGlobalBack();
        if (handled) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }

      if (event.key === 'Backspace') {
        const activeElem = document.activeElement;
        const isEditingText =
          activeElem &&
          (activeElem.tagName === 'INPUT' ||
            activeElem.tagName === 'TEXTAREA' ||
            activeElem.tagName === 'SELECT' ||
            (activeElem as HTMLElement).isContentEditable ||
            activeElem.getAttribute('contenteditable') === 'true');

        if (!isEditingText) {
          const handled = this.handleGlobalBack();
          if (handled) {
            event.preventDefault();
            event.stopPropagation();
          }
        }
      }
    });
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
      this.isInternalPush = true;
      try {
        window.history.pushState({ modalId: entry.id, stackLen: this.modalStack.length }, '');
      } catch (e) {
        console.error('PushState error:', e);
      }
      setTimeout(() => { this.isInternalPush = false; }, 50);
    }

    return () => this.unregisterModal(entry.id);
  }

  public unregisterModal(id: string) {
    this.modalStack = this.modalStack.filter(m => m.id !== id);
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
      this.isInternalPush = true;
      try {
        window.history.pushState({ navId: entry.id, stackLen: this.historyStack.length }, '');
      } catch (e) {
        console.error('PushState nav error:', e);
      }
      setTimeout(() => { this.isInternalPush = false; }, 50);
    }
  }

  public popNavigationState(id?: string) {
    if (id) {
      this.historyStack = this.historyStack.filter(h => h.id !== id);
    } else {
      this.historyStack.pop();
    }
  }

  public clearHistory() {
    this.historyStack = [];
  }

  public getHistoryLength(): number {
    return this.historyStack.length;
  }

  // --- CORE BACK HANDLER LOGIC ---
  public handleGlobalBack(): boolean {
    // 1. Check if any Modal registered in stack is open
    if (this.modalStack.length > 0) {
      const topModal = this.modalStack.pop();
      if (topModal) {
        if (topModal.hasUnsavedChanges && topModal.hasUnsavedChanges()) {
          const confirmClose = window.confirm('هناك تغييرات غير محفوظة، هل أنت تأكد من الإغلاق دون حفظ؟');
          if (!confirmClose) {
            this.modalStack.push(topModal);
            if (typeof window !== 'undefined') {
              this.isInternalPush = true;
              window.history.pushState({ modalId: topModal.id }, '');
              setTimeout(() => { this.isInternalPush = false; }, 50);
            }
            return true;
          }
        }

        try {
          topModal.onClose();
        } catch (err) {
          console.error('Error closing modal on back:', err);
        }
        return true;
      }
    }

    // 2. Dispatch custom event 'app:globalback' so open modals in child components can intercept and close
    if (typeof window !== 'undefined') {
      const backEvt = new CustomEvent('app:globalback', { cancelable: true });
      window.dispatchEvent(backEvt);
      if (backEvt.defaultPrevented) {
        return true; // Modal or drawer intercepted back action and closed
      }
    }

    // 3. Check if any Detail View, Sub-Tab, or Tab history entry exists in stack
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

    // 4. Root View Exit Handler ("اضغط مرة أخرى للخروج من التطبيق")
    if (this.exitPromptActive) {
      // User pressed back a second time within 2.5 seconds -> allow exit
      return false;
    } else {
      this.exitPromptActive = true;
      this.notifyToast('اضغط مرة أخرى للخروج من التطبيق');

      // Keep user on page by pushing guard state so next back button press will be caught
      if (typeof window !== 'undefined') {
        this.isInternalPush = true;
        try {
          window.history.pushState({ appGuard: true, exitPending: true }, '');
        } catch (e) {
          console.error('PushState guard error:', e);
        }
        setTimeout(() => { this.isInternalPush = false; }, 50);
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

/**
 * Custom React Hook for components to easily subscribe to Back action.
 * Automatically pushes browser history state when activeCondition is true,
 * and handles closing cleanly on back button or UI trigger.
 */
export function useBackHandler(activeCondition: boolean, onBackAction: () => void) {
  useEffect(() => {
    if (!activeCondition) return;

    const id = `modal_${Math.random().toString(36).substring(2, 9)}`;

    const unregister = navigationManager.registerModal({
      id,
      onClose: onBackAction
    });

    const handleGlobalBack = (e: Event) => {
      e.preventDefault();
      onBackAction();
    };

    window.addEventListener('app:globalback', handleGlobalBack);

    return () => {
      window.removeEventListener('app:globalback', handleGlobalBack);
      unregister();
    };
  }, [activeCondition, onBackAction]);
}


