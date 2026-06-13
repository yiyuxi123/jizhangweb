import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { get, set as idbSet, del } from 'idb-keyval';
import { Account, Budget, Category, Transaction, TransactionTemplate, SavingGoal, SyncSettings } from '../types';

// Custom storage for IndexedDB
const storage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await idbSet(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

import {
  createSyncToCloud,
  createApiKeySetters,
  createSimpleSetters,
  createCollectionSetters,
  createSyncSettingsActions,
  createMarkPreviousAsReimbursed,
} from './configActions';
import { createRecalculateBalances } from './balanceEngine';
import {
  createTransactionActions,
  createAccountActions,
  createCategoryActions,
  createBudgetActions,
  createTemplateActions,
  createGoalActions,
} from './entityActions';
import {
  createSyncToCloudNow,
  createPullFromCloud,
  createClearAllData,
  createRestoreData,
  createSyncAllData,
} from './syncEngine';

export interface AppState {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  templates: TransactionTemplate[];
  goals: SavingGoal[];

  syncSettings: SyncSettings;
  setSyncSettings: (settings: Partial<SyncSettings>) => void;

  showReimbursables: boolean;
  toggleShowReimbursables: () => void;

  hasBootstrapped: boolean;
  setHasBootstrapped: (val: boolean) => void;

  isGuestMode: boolean;
  setIsGuestMode: (val: boolean) => void;

  wasLoggedIn: boolean;
  setWasLoggedIn: (val: boolean) => void;

  syncStatus: 'idle' | 'connecting' | 'syncing' | 'synced' | 'error';
  setSyncStatus: (status: 'idle' | 'connecting' | 'syncing' | 'synced' | 'error') => void;

  syncError: string | null;
  setSyncError: (error: string | null) => void;

  dismissedAlertTypes: string[];
  dismissAlertType: (type: string) => void;
  resetDismissedAlertType: (type: string) => void;

  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;

  tombstones: Record<string, { id: string; entityType: string; deletedAt: number }>;
  addTombstone: (id: string, entityType: string) => void;

  deepseekApiKey: string;
  qwenApiKey: string;
  setDeepseekApiKey: (key: string) => void;
  setQwenApiKey: (key: string) => void;
  recalculateBalances: (skipUpload?: boolean) => void;

  // Actions
  addTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  updateTransaction: (id: string, transaction: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;

  addAccount: (account: Omit<Account, 'id'>) => void;
  updateAccount: (id: string, account: Partial<Account>) => void;
  deleteAccount: (id: string) => void;
  reorderAccount: (id: string, direction: 'up' | 'down') => void;
  reorderAccountsList: (accounts: Account[]) => void;

  addCategory: (category: Omit<Category, 'id'> & { id?: string }) => void;
  updateCategory: (id: string, category: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  reorderCategory: (id: string, direction: 'up' | 'down') => void;
  reorderCategoriesList: (categories: Category[]) => void;

  addBudget: (budget: Omit<Budget, 'id'>) => void;
  updateBudget: (id: string, budget: Partial<Budget>) => void;
  deleteBudget: (id: string) => void;

  addTemplate: (template: Omit<TransactionTemplate, 'id'>) => void;
  updateTemplate: (id: string, template: Partial<TransactionTemplate>) => void;
  deleteTemplate: (id: string) => void;

  addGoal: (goal: Omit<SavingGoal, 'id'>) => void;
  updateGoal: (id: string, goal: Partial<SavingGoal>) => void;
  deleteGoal: (id: string) => void;

  // Firebase Sync Setters (called by FirebaseProvider)
  setAccounts: (accounts: Account[]) => void;
  setCategories: (categories: Category[]) => void;
  setTransactions: (transactions: Transaction[]) => void;
  setBudgets: (budgets: Budget[]) => void;
  setTemplates: (templates: TransactionTemplate[]) => void;
  setGoals: (goals: SavingGoal[]) => void;

  markPreviousAsReimbursed: () => Promise<void>;
  syncToCloudNow: () => Promise<void>;
  pullFromCloud: () => Promise<void>;

  clearAllData: () => Promise<void>;
  restoreData: (data: any) => Promise<void>;
  syncAllData: () => Promise<void>;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => {
      return {
        // ─── Initial state ──────────────────────────────────────
        accounts: [],
        categories: [],
        transactions: [],
        budgets: [],
        templates: [],
        goals: [],
        showReimbursables: true,
        syncSettings: {
          storageMode: 'cloud',
          syncFrequency: 'realtime',
          lastSyncTime: 0,
        },
        hasBootstrapped: false,
        isGuestMode: false,
        wasLoggedIn: false,
        syncStatus: 'idle',
        syncError: null,
        dismissedAlertTypes: [],
        theme: 'light' as const,
        setTheme: (theme) => set({ theme }),
        tombstones: {},
        deepseekApiKey: '',
        qwenApiKey: '',

        // ─── Simple setters ─────────────────────────────────────
        ...createSimpleSetters(set),

        // ─── Collection setters ─────────────────────────────────
        ...createCollectionSetters(set),

        // ─── Sync settings ──────────────────────────────────────
        ...createSyncSettingsActions(set, get),

        // ─── API key setters ────────────────────────────────────
        ...createApiKeySetters(set, get),

        // ─── Balance engine ─────────────────────────────────────
        recalculateBalances: createRecalculateBalances(set, get),

        // ─── Mark reimbursed ────────────────────────────────────
        markPreviousAsReimbursed: createMarkPreviousAsReimbursed(set, get),

        // ─── Entity CRUD ────────────────────────────────────────
        ...createTransactionActions(set, get),
        ...createAccountActions(set, get),
        ...createCategoryActions(set, get),
        ...createBudgetActions(set, get),
        ...createTemplateActions(set, get),
        ...createGoalActions(set, get),

        // ─── Sync engine ────────────────────────────────────────
        syncToCloudNow: createSyncToCloudNow(set, get),
        pullFromCloud: createPullFromCloud(set, get),
        clearAllData: createClearAllData(set, get),
        restoreData: createRestoreData(set, get),
        syncAllData: createSyncAllData(set, get),
      };
    },
    {
      name: 'money-tracker-storage',
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({
        accounts: state.accounts,
        categories: state.categories,
        transactions: state.transactions,
        budgets: state.budgets,
        templates: state.templates,
        goals: state.goals,
        syncSettings: state.syncSettings,
        showReimbursables: state.showReimbursables,
        hasBootstrapped: state.hasBootstrapped,
        isGuestMode: state.isGuestMode,
        wasLoggedIn: state.wasLoggedIn,
        tombstones: state.tombstones,
        deepseekApiKey: state.deepseekApiKey,
        qwenApiKey: state.qwenApiKey,
        dismissedAlertTypes: state.dismissedAlertTypes,
        theme: state.theme,
      }),
    }
  )
);
