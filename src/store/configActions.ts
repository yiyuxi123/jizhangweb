import { auth, db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { SyncSettings } from '../types';
import { firestoreService } from '../services/firestoreService';

export function createSyncToCloud(
  set: (partial: any) => void,
  get: () => any
) {
  return async function syncToCloud(action: () => Promise<void>) {
    const { syncSettings } = get();
    if (syncSettings.storageMode === 'cloud') {
      try {
        await action();
      } catch (e: any) {
        console.error('Cloud sync failed', e);
        const msg = e?.message || String(e);
        const code = e?.code || '';
        const fullMsg = `[${code}] ${msg}`;
        if (msg.includes('exceeds') || msg.includes('size') || code === 'out-of-range') {
          set({ syncError: `数据过大：${fullMsg}\n\n可能是图片附件过大，已自动压缩处理。` });
        } else if (msg.includes('permission') || msg.includes('PERMISSION_DENIED')) {
          set({ syncError: `权限被拒：${fullMsg}\n\n请在 Firebase 控制台检查安全规则。` });
        } else if (msg.includes('unavailable') || msg.includes('network') || msg.includes('timeout') || code === 'unavailable') {
          set({ syncError: `网络错误：${fullMsg}\n\n请确认网络能访问 Google 服务。` });
        } else {
          set({ syncError: `云端同步失败: ${fullMsg}` });
        }
        set({ syncStatus: 'error' });
      }
    }
  };
}

export function createApiKeySetters(
  set: (partial: any) => void,
  get: () => any
) {
  return {
    setDeepseekApiKey: async (key: string) => {
      set({ deepseekApiKey: key });
      const { syncSettings } = get();
      const userId = auth.currentUser?.uid;
      if (userId && syncSettings.storageMode === 'cloud') {
        try {
          await setDoc(doc(db, `users/${userId}/config`, 'api_keys'), {
            deepseekApiKey: key,
            qwenApiKey: get().qwenApiKey,
            updatedAt: Date.now(),
          }, { merge: true });
          await get().syncAllData();
        } catch (e) {
          console.error('Failed to sync deepseekApiKey to cloud', e);
        }
      }
    },

    setQwenApiKey: async (key: string) => {
      set({ qwenApiKey: key });
      const { syncSettings } = get();
      const userId = auth.currentUser?.uid;
      if (userId && syncSettings.storageMode === 'cloud') {
        try {
          await setDoc(doc(db, `users/${userId}/config`, 'api_keys'), {
            deepseekApiKey: get().deepseekApiKey,
            qwenApiKey: key,
            updatedAt: Date.now(),
          }, { merge: true });
          await get().syncAllData();
        } catch (e) {
          console.error('Failed to sync qwenApiKey to cloud', e);
        }
      }
    },
  };
}

export function createSimpleSetters(set: (partial: any) => void) {
  return {
    setHasBootstrapped: (val: boolean) => set({ hasBootstrapped: val }),
    setIsGuestMode: (val: boolean) => set({ isGuestMode: val }),
    setWasLoggedIn: (val: boolean) => set({ wasLoggedIn: val }),
    setSyncStatus: (status: string) => set({ syncStatus: status }),
    setSyncError: (error: string | null) => set({ syncError: error }),
    dismissAlertType: (type: string) =>
      set((state: any) => ({
        dismissedAlertTypes: state.dismissedAlertTypes.includes(type)
          ? state.dismissedAlertTypes
          : [...state.dismissedAlertTypes, type],
      })),
    resetDismissedAlertType: (type: string) =>
      set((state: any) => ({
        dismissedAlertTypes: state.dismissedAlertTypes.filter((t: string) => t !== type),
      })),
    addTombstone: (id: string, entityType: string) =>
      set((state: any) => ({
        tombstones: {
          ...state.tombstones,
          [id]: { id, entityType, deletedAt: Date.now() },
        },
      })),
  };
}

export function createCollectionSetters(set: (partial: any) => void) {
  return {
    setAccounts: (accounts: any[]) =>
      set({ accounts: accounts.sort((a, b) => (a.order || 0) - (b.order || 0)) }),
    setCategories: (categories: any[]) =>
      set({ categories: categories.sort((a, b) => (a.order || 0) - (b.order || 0)) }),
    setTransactions: (transactions: any[]) =>
      set({
        transactions: [...transactions].sort((a, b) => {
          const timeA = a.date ? new Date(a.date).getTime() : 0;
          const timeB = b.date ? new Date(b.date).getTime() : 0;
          return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
        }),
      }),
    setBudgets: (budgets: any[]) => set({ budgets }),
    setTemplates: (templates: any[]) => set({ templates }),
    setGoals: (goals: any[]) => set({ goals }),
  };
}

export function createSyncSettingsActions(
  set: (partial: any) => void,
  get: () => any
) {
  return {
    setSyncSettings: (settings: Partial<SyncSettings>) => {
      const prev = get().syncSettings;
      const next = { ...prev, ...settings };
      set({ syncSettings: next });
      if (settings.storageMode === 'cloud' && prev.storageMode === 'local') {
        setTimeout(() => {
          get().syncAllData().catch(console.error);
        }, 500);
      }
    },

    toggleShowReimbursables: () =>
      set((state: any) => ({ showReimbursables: !state.showReimbursables })),
  };
}

export function createMarkPreviousAsReimbursed(
  set: (partial: any) => void,
  get: () => any
) {
  return async function markPreviousAsReimbursed() {
    const newTransactions = get().transactions.map((t: any) =>
      t.isReimbursable && !t.isReimbursed ? { ...t, isReimbursed: true } : t
    );
    set({ transactions: newTransactions });

    const { syncSettings } = get();
    if (syncSettings.storageMode === 'cloud') {
      try {
        await firestoreService.markPreviousAsReimbursed(get().transactions);
      } catch (e) {
        console.error('Cloud sync failed', e);
      }
    }
  };
}
