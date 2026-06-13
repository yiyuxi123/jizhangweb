import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { get, set as idbSet, del } from 'idb-keyval';
import { Account, Budget, Category, Transaction, TransactionTemplate, SavingGoal, SyncSettings } from '../types';
import { firestoreService } from '../services/firestoreService';
import { v4 as uuidv4 } from 'uuid';
import { writeBatch, doc, getDocs, collection } from 'firebase/firestore';
import { auth, db } from '../firebase';

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

interface AppState {
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

  tombstones: Record<string, { id: string; entityType: string; deletedAt: number }>;
  addTombstone: (id: string, entityType: string) => void;

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
      const syncToCloud = async (action: () => Promise<void>) => {
        const { syncSettings } = get();
        if (syncSettings.storageMode === 'cloud' && syncSettings.syncFrequency === 'realtime') {
          try {
            await action();
          } catch (e) {
            console.error("Cloud sync failed", e);
          }
        }
      };

      return {
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
          lastSyncTime: 0
        },

        hasBootstrapped: false,
        setHasBootstrapped: (val) => set({ hasBootstrapped: val }),

        isGuestMode: false,
        setIsGuestMode: (val) => set({ isGuestMode: val }),

        wasLoggedIn: false,
        setWasLoggedIn: (val) => set({ wasLoggedIn: val }),

        syncStatus: 'idle',
        setSyncStatus: (status) => set({ syncStatus: status }),

        tombstones: {},
        addTombstone: (id, entityType) => set((state) => ({
          tombstones: {
            ...state.tombstones,
            [id]: { id, entityType, deletedAt: Date.now() }
          }
        })),

        setSyncSettings: (settings) => set((state) => ({ syncSettings: { ...state.syncSettings, ...settings } })),
        toggleShowReimbursables: () => set((state) => ({ showReimbursables: !state.showReimbursables })),

        setAccounts: (accounts) => set({ accounts: accounts.sort((a, b) => (a.order || 0) - (b.order || 0)) }),
        setCategories: (categories) => set({ categories: categories.sort((a, b) => (a.order || 0) - (b.order || 0)) }),
        setTransactions: (transactions) => set({ 
          transactions: [...transactions].sort((a, b) => {
            const timeA = a.date ? new Date(a.date).getTime() : 0;
            const timeB = b.date ? new Date(b.date).getTime() : 0;
            return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
          }) 
        }),
        setBudgets: (budgets) => set({ budgets }),
        setTemplates: (templates) => set({ templates }),
        setGoals: (goals) => set({ goals }),

        markPreviousAsReimbursed: async () => {
          // Local update
          const newTransactions = get().transactions.map(t => 
            t.isReimbursable && !t.isReimbursed ? { ...t, isReimbursed: true } : t
          );
          set({ transactions: newTransactions });
          // Cloud update
          await syncToCloud(async () => {
            await firestoreService.markPreviousAsReimbursed(get().transactions);
          });
        },

        addTransaction: async (transaction) => {
          const newTx = { ...transaction, id: uuidv4(), updatedAt: Date.now() } as Transaction;
          
          // Local account balance update
          const accounts = [...get().accounts];
          if (newTx.type === 'expense' && newTx.fromAccountId) {
            const acc = accounts.find(a => a.id === newTx.fromAccountId);
            if (acc) acc.balance -= newTx.amount;
          } else if (newTx.type === 'income' && newTx.toAccountId) {
            const acc = accounts.find(a => a.id === newTx.toAccountId);
            if (acc) acc.balance += newTx.amount;
          } else if (newTx.type === 'transfer' && newTx.fromAccountId && newTx.toAccountId) {
            const fromAcc = accounts.find(a => a.id === newTx.fromAccountId);
            const toAcc = accounts.find(a => a.id === newTx.toAccountId);
            if (fromAcc) fromAcc.balance -= newTx.amount;
            if (toAcc) toAcc.balance += newTx.amount;
          }

          set((state) => ({ 
            transactions: [newTx, ...state.transactions].sort((a, b) => {
              const timeA = a.date ? new Date(a.date).getTime() : 0;
              const timeB = b.date ? new Date(b.date).getTime() : 0;
              return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
            }),
            accounts
          }));

          await syncToCloud(async () => {
            await firestoreService.addTransaction(newTx, get().accounts, get().transactions);
          });
        },

        updateTransaction: async (id, updatedFields) => {
          const oldTx = get().transactions.find((t) => t.id === id);
          if (!oldTx) return;
          
          const newTx = { ...oldTx, ...updatedFields, updatedAt: Date.now() };
          
          // Revert old transaction from accounts
          const accounts = [...get().accounts];
          if (oldTx.type === 'expense' && oldTx.fromAccountId) {
            const acc = accounts.find(a => a.id === oldTx.fromAccountId);
            if (acc) acc.balance += oldTx.amount;
          } else if (oldTx.type === 'income' && oldTx.toAccountId) {
            const acc = accounts.find(a => a.id === oldTx.toAccountId);
            if (acc) acc.balance -= oldTx.amount;
          } else if (oldTx.type === 'transfer' && oldTx.fromAccountId && oldTx.toAccountId) {
            const fromAcc = accounts.find(a => a.id === oldTx.fromAccountId);
            const toAcc = accounts.find(a => a.id === oldTx.toAccountId);
            if (fromAcc) fromAcc.balance += oldTx.amount;
            if (toAcc) toAcc.balance -= oldTx.amount;
          }

          // Apply new transaction to accounts
          if (newTx.type === 'expense' && newTx.fromAccountId) {
            const acc = accounts.find(a => a.id === newTx.fromAccountId);
            if (acc) acc.balance -= newTx.amount;
          } else if (newTx.type === 'income' && newTx.toAccountId) {
            const acc = accounts.find(a => a.id === newTx.toAccountId);
            if (acc) acc.balance += newTx.amount;
          } else if (newTx.type === 'transfer' && newTx.fromAccountId && newTx.toAccountId) {
            const fromAcc = accounts.find(a => a.id === newTx.fromAccountId);
            const toAcc = accounts.find(a => a.id === newTx.toAccountId);
            if (fromAcc) fromAcc.balance -= newTx.amount;
            if (toAcc) toAcc.balance += newTx.amount;
          }

          set((state) => ({
            transactions: state.transactions.map(t => t.id === id ? newTx : t).sort((a, b) => {
              const timeA = a.date ? new Date(a.date).getTime() : 0;
              const timeB = b.date ? new Date(b.date).getTime() : 0;
              return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
            }),
            accounts
          }));

          await syncToCloud(async () => {
            await firestoreService.updateTransaction(id, updatedFields, oldTx, get().accounts, get().transactions);
          });
        },

        deleteTransaction: async (id) => {
          const tx = get().transactions.find((t) => t.id === id);
          if (!tx) return;
          get().addTombstone(id, 'transactions');

          // Revert transaction from accounts
          const accounts = [...get().accounts];
          if (tx.type === 'expense' && tx.fromAccountId) {
            const acc = accounts.find(a => a.id === tx.fromAccountId);
            if (acc) acc.balance += tx.amount;
          } else if (tx.type === 'income' && tx.toAccountId) {
            const acc = accounts.find(a => a.id === tx.toAccountId);
            if (acc) acc.balance -= tx.amount;
          } else if (tx.type === 'transfer' && tx.fromAccountId && tx.toAccountId) {
            const fromAcc = accounts.find(a => a.id === tx.fromAccountId);
            const toAcc = accounts.find(a => a.id === tx.toAccountId);
            if (fromAcc) fromAcc.balance += tx.amount;
            if (toAcc) toAcc.balance -= tx.amount;
          }

          set((state) => ({
            transactions: state.transactions.filter(t => t.id !== id),
            accounts
          }));

          await syncToCloud(async () => {
            await firestoreService.deleteTransaction(id, tx, get().accounts, get().transactions);
          });
        },

        addAccount: async (account) => {
          const newAccount = { ...account, id: uuidv4(), order: get().accounts.length, updatedAt: Date.now() } as Account;
          set((state) => ({ accounts: [...state.accounts, newAccount] }));
          await syncToCloud(async () => { await firestoreService.addDocument('accounts', newAccount); });
        },
        updateAccount: async (id, account) => {
          set((state) => ({ accounts: state.accounts.map(a => a.id === id ? { ...a, ...account, updatedAt: Date.now() } : a) }));
          await syncToCloud(async () => { await firestoreService.updateDocument('accounts', id, { ...account, updatedAt: Date.now() }); });
        },
        deleteAccount: async (id) => {
          get().addTombstone(id, 'accounts');
          set((state) => ({ accounts: state.accounts.filter(a => a.id !== id) }));
          await syncToCloud(async () => { await firestoreService.deleteDocument('accounts', id); });
        },
        reorderAccount: async (id, direction) => {
          const accounts = [...get().accounts].sort((a, b) => (a.order || 0) - (b.order || 0));
          const index = accounts.findIndex(a => a.id === id);
          if (index < 0) return;
          
          let swapIndex = -1;
          if (direction === 'up' && index > 0) {
            swapIndex = index - 1;
          } else if (direction === 'down' && index < accounts.length - 1) {
            swapIndex = index + 1;
          }
          
          if (swapIndex !== -1) {
            const temp = accounts[index].order ?? index;
            accounts[index].order = accounts[swapIndex].order ?? swapIndex;
            accounts[swapIndex].order = temp;
            
            const id1 = accounts[index].id;
            const order1 = accounts[index].order;
            const id2 = accounts[swapIndex].id;
            const order2 = accounts[swapIndex].order;

            const sorted = accounts.sort((a, b) => (a.order || 0) - (b.order || 0));
            set({ accounts: sorted });
            
            await syncToCloud(async () => {
              await firestoreService.updateDocument('accounts', id1, { order: order1 });
              await firestoreService.updateDocument('accounts', id2, { order: order2 });
            });
          }
        },
        reorderAccountsList: async (reorderedAccounts) => {
          // Calculate only those accounts whose order has changed to minimize DB writes
          const updatedAccounts: Account[] = [];
          const currentAccounts = get().accounts;
          
          reorderedAccounts.forEach((acc, index) => {
            const currentAcc = currentAccounts.find(a => a.id === acc.id);
            if (!currentAcc || currentAcc.order !== index) {
              updatedAccounts.push({ ...acc, order: index });
            }
          });

          if (updatedAccounts.length === 0) return;

          // Merge with existing accounts (in case some were hidden/filtered)
          const allAccounts = currentAccounts.map(acc => {
            const updated = updatedAccounts.find(ua => ua.id === acc.id);
            return updated ? updated : acc;
          }).sort((a, b) => (a.order || 0) - (b.order || 0));
          
          set({ accounts: allAccounts });
          
          await syncToCloud(async () => {
            const batch = writeBatch(db);
            const userId = auth.currentUser?.uid;
            if (!userId) return;
            
            updatedAccounts.forEach(acc => {
              batch.update(doc(db, `users/${userId}/accounts`, acc.id), { order: acc.order });
            });
            await batch.commit();
          });
        },

        addCategory: async (category) => {
          const id = category.id || uuidv4();
          const newCategory = { ...category, id, order: get().categories.length, updatedAt: Date.now() } as Category;
          set((state) => ({ categories: [...state.categories, newCategory] }));
          await syncToCloud(async () => { await firestoreService.addDocument('categories', newCategory); });
        },
        updateCategory: async (id, category) => {
          set((state) => ({ categories: state.categories.map(c => c.id === id ? { ...c, ...category, updatedAt: Date.now() } : c) }));
          await syncToCloud(async () => { await firestoreService.updateDocument('categories', id, { ...category, updatedAt: Date.now() }); });
        },
        deleteCategory: async (id) => {
          get().addTombstone(id, 'categories');
          set((state) => ({ categories: state.categories.filter(c => c.id !== id) }));
          await syncToCloud(async () => { await firestoreService.deleteDocument('categories', id); });
        },
        reorderCategory: async (id, direction) => {
          const cat = get().categories.find(c => c.id === id);
          if (!cat) return;
          const typeCategories = get().categories.filter(c => c.type === cat.type).sort((a, b) => (a.order || 0) - (b.order || 0));
          const index = typeCategories.findIndex(c => c.id === id);
          if (index < 0) return;
          
          let swapIndex = -1;
          if (direction === 'up' && index > 0) {
            swapIndex = index - 1;
          } else if (direction === 'down' && index < typeCategories.length - 1) {
            swapIndex = index + 1;
          }
          
          if (swapIndex !== -1) {
            const temp = typeCategories[index].order ?? index;
            typeCategories[index].order = typeCategories[swapIndex].order ?? swapIndex;
            typeCategories[swapIndex].order = temp;
            
            const id1 = typeCategories[index].id;
            const order1 = typeCategories[index].order;
            const id2 = typeCategories[swapIndex].id;
            const order2 = typeCategories[swapIndex].order;
            
            const allCategories = get().categories.map(c => {
              const updated = typeCategories.find(tc => tc.id === c.id);
              return updated ? updated : c;
            }).sort((a, b) => (a.order || 0) - (b.order || 0));
            
            set({ categories: allCategories });
            
            await syncToCloud(async () => {
              await firestoreService.updateDocument('categories', id1, { order: order1 });
              await firestoreService.updateDocument('categories', id2, { order: order2 });
            });
          }
        },
        reorderCategoriesList: async (reorderedCategories) => {
          // Calculate only those categories whose order has changed to minimize DB writes
          const updatedCategories: Category[] = [];
          const currentCategories = get().categories;
          
          reorderedCategories.forEach((cat, index) => {
            const currentCat = currentCategories.find(c => c.id === cat.id);
            if (!currentCat || currentCat.order !== index) {
              updatedCategories.push({ ...cat, order: index });
            }
          });

          if (updatedCategories.length === 0) return;

          const allCategories = currentCategories.map(cat => {
            const updated = updatedCategories.find(uc => uc.id === cat.id);
            return updated ? updated : cat;
          }).sort((a, b) => (a.order || 0) - (b.order || 0));
          
          set({ categories: allCategories });
          
          await syncToCloud(async () => {
            const batch = writeBatch(db);
            const userId = auth.currentUser?.uid;
            if (!userId) return;
            
            updatedCategories.forEach(cat => {
              batch.update(doc(db, `users/${userId}/categories`, cat.id), { order: cat.order });
            });
            await batch.commit();
          });
        },

        addBudget: async (budget) => {
          const newBudget = { ...budget, id: uuidv4(), updatedAt: Date.now() } as Budget;
          set((state) => ({ budgets: [...state.budgets, newBudget] }));
          await syncToCloud(async () => { await firestoreService.addDocument('budgets', newBudget); });
        },
        updateBudget: async (id, budget) => {
          set((state) => ({ budgets: state.budgets.map(b => b.id === id ? { ...b, ...budget, updatedAt: Date.now() } : b) }));
          await syncToCloud(async () => { await firestoreService.updateDocument('budgets', id, { ...budget, updatedAt: Date.now() }); });
        },
        deleteBudget: async (id) => {
          get().addTombstone(id, 'budgets');
          set((state) => ({ budgets: state.budgets.filter(b => b.id !== id) }));
          await syncToCloud(async () => { await firestoreService.deleteDocument('budgets', id); });
        },

        addTemplate: async (template) => {
          const newTemplate = { ...template, id: uuidv4(), updatedAt: Date.now() } as TransactionTemplate;
          set((state) => ({ templates: [...state.templates, newTemplate] }));
          await syncToCloud(async () => { await firestoreService.addDocument('templates', newTemplate); });
        },
        updateTemplate: async (id, updatedFields) => {
          set((state) => ({ templates: state.templates.map(t => t.id === id ? { ...t, ...updatedFields, updatedAt: Date.now() } : t) }));
          await syncToCloud(async () => { await firestoreService.updateDocument('templates', id, { ...updatedFields, updatedAt: Date.now() }); });
        },
        deleteTemplate: async (id) => {
          get().addTombstone(id, 'templates');
          set((state) => ({ templates: state.templates.filter(t => t.id !== id) }));
          await syncToCloud(async () => { await firestoreService.deleteDocument('templates', id); });
        },

        addGoal: async (goal) => {
          const newGoal = { ...goal, id: uuidv4(), updatedAt: Date.now() } as SavingGoal;
          set((state) => ({ goals: [...state.goals, newGoal] }));
          await syncToCloud(async () => { await firestoreService.addDocument('goals', newGoal); });
        },
        updateGoal: async (id, goal) => {
          set((state) => ({ goals: state.goals.map(g => g.id === id ? { ...g, ...goal, updatedAt: Date.now() } : g) }));
          await syncToCloud(async () => { await firestoreService.updateDocument('goals', id, { ...goal, updatedAt: Date.now() }); });
        },
        deleteGoal: async (id) => {
          get().addTombstone(id, 'goals');
          set((state) => ({ goals: state.goals.filter(g => g.id !== id) }));
          await syncToCloud(async () => { await firestoreService.deleteDocument('goals', id); });
        },

        syncToCloudNow: async () => {
          const state = get();
          try {
            // Push all local data to cloud
            const userId = auth.currentUser?.uid;
            if (!userId) throw new Error("Not logged in");
            
            const batch = writeBatch(db);
            
            state.accounts.forEach(acc => {
              batch.set(doc(db, `users/${userId}/accounts`, acc.id), { ...acc, userId });
            });
            state.categories.forEach(cat => {
              batch.set(doc(db, `users/${userId}/categories`, cat.id), { ...cat, userId });
            });
            state.transactions.forEach(tx => {
              batch.set(doc(db, `users/${userId}/transactions`, tx.id), { ...tx, userId });
            });
            state.budgets.forEach(b => {
              batch.set(doc(db, `users/${userId}/budgets`, b.id), { ...b, userId });
            });
            state.templates.forEach(t => {
              batch.set(doc(db, `users/${userId}/templates`, t.id), { ...t, userId });
            });
            state.goals.forEach(g => {
              batch.set(doc(db, `users/${userId}/goals`, g.id), { ...g, userId });
            });
            
            await batch.commit();

            set({ syncSettings: { ...state.syncSettings, lastSyncTime: Date.now() } });
          } catch (e) {
            console.error(e);
            throw e;
          }
        },
        pullFromCloud: async () => {
          const userId = auth.currentUser?.uid;
          if (!userId) throw new Error("Not logged in");
          
          const { syncStatus } = get();
          if (syncStatus === 'syncing') return;

          set({ syncStatus: 'syncing' });
          
          try {
            const [accSnap, catSnap, txSnap, budSnap, tplSnap, goalSnap] = await Promise.all([
              getDocs(collection(db, `users/${userId}/accounts`)),
              getDocs(collection(db, `users/${userId}/categories`)),
              getDocs(collection(db, `users/${userId}/transactions`)),
              getDocs(collection(db, `users/${userId}/budgets`)),
              getDocs(collection(db, `users/${userId}/templates`)),
              getDocs(collection(db, `users/${userId}/goals`))
            ]);
            
            set({
              accounts: accSnap.docs.map(d => ({ ...d.data(), id: d.id } as any)),
              categories: catSnap.docs.map(d => ({ ...d.data(), id: d.id } as any)),
              transactions: txSnap.docs.map(d => ({ ...d.data(), id: d.id } as any)).sort((a, b) => {
                const timeA = a.date ? new Date(a.date).getTime() : 0;
                const timeB = b.date ? new Date(b.date).getTime() : 0;
                return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
              }),
              budgets: budSnap.docs.map(d => ({ ...d.data(), id: d.id } as any)),
              templates: tplSnap.docs.map(d => ({ ...d.data(), id: d.id } as any)),
              goals: goalSnap.docs.map(d => ({ ...d.data(), id: d.id } as any)),
              syncSettings: { ...get().syncSettings, lastSyncTime: Date.now() },
              syncStatus: 'synced'
            });

            setTimeout(() => {
              if (get().syncStatus === 'synced') {
                set({ syncStatus: 'idle' });
              }
            }, 3000);
          } catch (e) {
            console.error("Pull from cloud failed", e);
            set({ syncStatus: 'error' });
            throw e;
          }
        },

        clearAllData: async () => {
          set({
            accounts: [],
            categories: [],
            transactions: [],
            budgets: [],
            templates: [],
            goals: [],
            tombstones: {}
          });

          const userId = auth.currentUser?.uid;
          if (userId && get().syncSettings.storageMode === 'cloud') {
            await firestoreService.clearAllData();
          }
        },

        restoreData: async (data: any) => {
          set({
            accounts: (data.accounts || []).map((a: any) => ({ ...a, balance: Math.round((a.balance || 0) * 100) / 100 })),
            categories: data.categories || [],
            transactions: (data.transactions || []).map((t: any) => {
              const cleanTx = { ...t, amount: Math.round((t.amount || 0) * 100) / 100 };
              if (cleanTx.history) delete cleanTx.history;
              if (cleanTx.note && cleanTx.note.length > 500) cleanTx.note = cleanTx.note.substring(0, 500);
              return cleanTx;
            }).sort((a: any, b: any) => {
              const timeA = a.date ? new Date(a.date).getTime() : 0;
              const timeB = b.date ? new Date(b.date).getTime() : 0;
              return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
            }),
            budgets: data.budgets || [],
            templates: data.templates || [],
            goals: data.goals || [],
            tombstones: data.tombstones || {}
          });

          const userId = auth.currentUser?.uid;
          if (userId && get().syncSettings.storageMode === 'cloud') {
            await firestoreService.restoreData(data);
          }
        },

        syncAllData: async () => {
          const userId = auth.currentUser?.uid;
          if (!userId) {
            set({ syncStatus: 'idle' });
            return;
          }

          const { syncStatus, syncSettings, tombstones } = get();
          if (syncStatus === 'syncing') return;

          set({ syncStatus: 'syncing' });

          try {
            const lastSyncTime = syncSettings.lastSyncTime || 0;

            // 1. Download and Merge Phase (read-only from Firestore, merges locally)
            const syncSingleCollectionMerge = async (
              collectionName: string,
              localItems: any[]
            ) => {
              const dbCollectionRef = collection(db, `users/${userId}/${collectionName}`);
              const querySnapshot = await getDocs(dbCollectionRef);
              
              const remoteItemsMap = new Map<string, any>();
              querySnapshot.forEach(doc => {
                remoteItemsMap.set(doc.id, doc.data());
              });

              const updatedLocalItems = [...localItems];

              // Process local items
              for (let i = 0; i < updatedLocalItems.length; i++) {
                const local = updatedLocalItems[i];
                const remote = remoteItemsMap.get(local.id);

                if (remote) {
                  const localTime = local.updatedAt || 0;
                  const remoteTime = remote.updatedAt || 0;

                  if (remoteTime > localTime) {
                    updatedLocalItems[i] = remote;
                  }
                } else {
                  const tombstone = tombstones[local.id];
                  if (tombstone) {
                    // Will delete from remote in write phase
                  } else if (lastSyncTime > 0 && (local.updatedAt || 0) < lastSyncTime) {
                    updatedLocalItems.splice(i, 1);
                    i--;
                  }
                }
              }

              // Process remote items not present locally
              const localItemsMap = new Map<string, any>(localItems.map(item => [item.id, item]));
              for (const [remoteId, remote] of remoteItemsMap.entries()) {
                if (!localItemsMap.has(remoteId)) {
                  const tombstone = tombstones[remoteId];
                  if (tombstone) {
                    const remoteTime = remote.updatedAt || 0;
                    if (remoteTime > tombstone.deletedAt) {
                      updatedLocalItems.push(remote);
                    }
                  } else {
                    updatedLocalItems.push(remote);
                  }
                }
              }

              return { updatedLocalItems, remoteItemsMap };
            };

            const [
              accountsResult,
              categoriesResult,
              transactionsResult,
              budgetsResult,
              templatesResult,
              goalsResult
            ] = await Promise.all([
              syncSingleCollectionMerge('accounts', get().accounts),
              syncSingleCollectionMerge('categories', get().categories),
              syncSingleCollectionMerge('transactions', get().transactions),
              syncSingleCollectionMerge('budgets', get().budgets),
              syncSingleCollectionMerge('templates', get().templates),
              syncSingleCollectionMerge('goals', get().goals)
            ]);

            // Temp state to perform remapping and deduplication
            let mergedAccounts = accountsResult.updatedLocalItems;
            let mergedCategories = categoriesResult.updatedLocalItems;
            let mergedTransactions = transactionsResult.updatedLocalItems;
            let mergedBudgets = budgetsResult.updatedLocalItems;
            let mergedTemplates = templatesResult.updatedLocalItems;
            let mergedGoals = goalsResult.updatedLocalItems;

            // 2. Deduplication & Remapping Phase
            // Deduplicate Categories & remap transactions, budgets, templates
            const dedupCategories = (
              localCategories: Category[],
              localTransactions: Transaction[],
              localBudgets: Budget[],
              localTemplates: TransactionTemplate[]
            ) => {
              const uniqueMap = new Map<string, Category>();
              const duplicatesToRemap = new Map<string, string>(); // oldId -> newId
              const keptCategories: Category[] = [];

              localCategories.forEach(cat => {
                const key = `${cat.name.trim()}_${cat.type}`;
                const existing = uniqueMap.get(key);
                if (existing) {
                  const keepExisting = !existing.id.startsWith('cat-') || cat.id.startsWith('cat-');
                  if (keepExisting) {
                    duplicatesToRemap.set(cat.id, existing.id);
                  } else {
                    duplicatesToRemap.set(existing.id, cat.id);
                    uniqueMap.set(key, cat);
                    const idx = keptCategories.findIndex(c => c.id === existing.id);
                    if (idx !== -1) keptCategories[idx] = cat;
                  }
                } else {
                  uniqueMap.set(key, cat);
                  keptCategories.push(cat);
                }
              });

              let updatedTxs = localTransactions;
              let updatedBudgets = localBudgets;
              let updatedTemplates = localTemplates;

              if (duplicatesToRemap.size > 0) {
                // Transitive resolution: resolve any chains (e.g. A -> B and B -> C) to the final target
                duplicatesToRemap.forEach((targetId, sourceId) => {
                  let current = targetId;
                  const visited = new Set<string>([sourceId]);
                  while (duplicatesToRemap.has(current) && !visited.has(current)) {
                    visited.add(current);
                    current = duplicatesToRemap.get(current)!;
                  }
                  duplicatesToRemap.set(sourceId, current);
                });

                console.log("Deduplicating categories:", duplicatesToRemap);
                updatedTxs = localTransactions.map(tx => {
                  if (tx.categoryId && duplicatesToRemap.has(tx.categoryId)) {
                    return { ...tx, categoryId: duplicatesToRemap.get(tx.categoryId)!, updatedAt: Date.now() };
                  }
                  return tx;
                });
                updatedBudgets = localBudgets.map(b => {
                  if (b.categoryId && duplicatesToRemap.has(b.categoryId)) {
                    return { ...b, categoryId: duplicatesToRemap.get(b.categoryId)!, updatedAt: Date.now() };
                  }
                  return b;
                });
                updatedTemplates = localTemplates.map(t => {
                  if (t.categoryId && duplicatesToRemap.has(t.categoryId)) {
                    return { ...t, categoryId: duplicatesToRemap.get(t.categoryId)!, updatedAt: Date.now() };
                  }
                  return t;
                });

                duplicatesToRemap.forEach((keptId, duplicateId) => {
                  get().addTombstone(duplicateId, 'categories');
                });
              }

              return {
                categories: keptCategories,
                transactions: updatedTxs,
                budgets: updatedBudgets,
                templates: updatedTemplates
              };
            };

            // Deduplicate Accounts & remap transactions, templates, goals
            const dedupAccounts = (
              localAccounts: Account[],
              localTransactions: Transaction[],
              localTemplates: TransactionTemplate[],
              localGoals: SavingGoal[]
            ) => {
              const uniqueMap = new Map<string, Account>();
              const duplicatesToRemap = new Map<string, string>(); // oldId -> newId
              const keptAccounts: Account[] = [];

              localAccounts.forEach(acc => {
                const key = acc.name.trim();
                const existing = uniqueMap.get(key);
                if (existing) {
                  const keepExisting = !existing.id.startsWith('acc-') || acc.id.startsWith('acc-');
                  if (keepExisting) {
                    duplicatesToRemap.set(acc.id, existing.id);
                  } else {
                    duplicatesToRemap.set(existing.id, acc.id);
                    uniqueMap.set(key, acc);
                    const idx = keptAccounts.findIndex(a => a.id === existing.id);
                    if (idx !== -1) keptAccounts[idx] = acc;
                  }
                } else {
                  uniqueMap.set(key, acc);
                  keptAccounts.push(acc);
                }
              });

              let updatedTxs = localTransactions;
              let updatedTemplates = localTemplates;
              let updatedGoals = localGoals;

              if (duplicatesToRemap.size > 0) {
                // Transitive resolution: resolve any chains (e.g. A -> B and B -> C) to the final target
                duplicatesToRemap.forEach((targetId, sourceId) => {
                  let current = targetId;
                  const visited = new Set<string>([sourceId]);
                  while (duplicatesToRemap.has(current) && !visited.has(current)) {
                    visited.add(current);
                    current = duplicatesToRemap.get(current)!;
                  }
                  duplicatesToRemap.set(sourceId, current);
                });

                console.log("Deduplicating accounts:", duplicatesToRemap);
                updatedTxs = localTransactions.map(tx => {
                  let changed = false;
                  let fromId = tx.fromAccountId;
                  let toId = tx.toAccountId;
                  if (fromId && duplicatesToRemap.has(fromId)) {
                    fromId = duplicatesToRemap.get(fromId)!;
                    changed = true;
                  }
                  if (toId && duplicatesToRemap.has(toId)) {
                    toId = duplicatesToRemap.get(toId)!;
                    changed = true;
                  }
                  if (changed) {
                    return { ...tx, fromAccountId: fromId, toAccountId: toId, updatedAt: Date.now() };
                  }
                  return tx;
                });
                updatedTemplates = localTemplates.map(t => {
                  let changed = false;
                  let fromId = t.fromAccountId;
                  let toId = t.toAccountId;
                  if (fromId && duplicatesToRemap.has(fromId)) {
                    fromId = duplicatesToRemap.get(fromId)!;
                    changed = true;
                  }
                  if (toId && duplicatesToRemap.has(toId)) {
                    toId = duplicatesToRemap.get(toId)!;
                    changed = true;
                  }
                  if (changed) {
                    return { ...t, fromAccountId: fromId, toAccountId: toId, updatedAt: Date.now() };
                  }
                  return t;
                });
                updatedGoals = localGoals.map(g => {
                  if (g.accountId && duplicatesToRemap.has(g.accountId)) {
                    return { ...g, accountId: duplicatesToRemap.get(g.accountId)!, updatedAt: Date.now() };
                  }
                  return g;
                });

                duplicatesToRemap.forEach((keptId, duplicateId) => {
                  get().addTombstone(duplicateId, 'accounts');
                });
              }

              return {
                accounts: keptAccounts,
                transactions: updatedTxs,
                templates: updatedTemplates,
                goals: updatedGoals
              };
            };

            const dedupBudgets = (localBudgets: Budget[]) => {
              const uniqueMap = new Map<string, Budget>();
              const keptBudgets: Budget[] = [];

              localBudgets.forEach(b => {
                const key = b.categoryId || 'total';
                const existing = uniqueMap.get(key);
                if (existing) {
                  const keepExisting = (existing.updatedAt || 0) >= (b.updatedAt || 0);
                  if (keepExisting) {
                    get().addTombstone(b.id, 'budgets');
                  } else {
                    get().addTombstone(existing.id, 'budgets');
                    uniqueMap.set(key, b);
                    const idx = keptBudgets.findIndex(x => (x.categoryId || 'total') === key);
                    if (idx !== -1) keptBudgets[idx] = b;
                  }
                } else {
                  uniqueMap.set(key, b);
                  keptBudgets.push(b);
                }
              });

              return keptBudgets;
            };

            const dedupTemplates = (localTemplates: TransactionTemplate[]) => {
              const uniqueMap = new Map<string, TransactionTemplate>();
              const keptTemplates: TransactionTemplate[] = [];

              localTemplates.forEach(t => {
                const key = `${t.name.trim()}_${t.type}`;
                const existing = uniqueMap.get(key);
                if (existing) {
                  const keepExisting = (existing.updatedAt || 0) >= (t.updatedAt || 0);
                  if (keepExisting) {
                    get().addTombstone(t.id, 'templates');
                  } else {
                    get().addTombstone(existing.id, 'templates');
                    uniqueMap.set(key, t);
                    const idx = keptTemplates.findIndex(x => x.name.trim() === t.name.trim() && x.type === t.type);
                    if (idx !== -1) keptTemplates[idx] = t;
                  }
                } else {
                  uniqueMap.set(key, t);
                  keptTemplates.push(t);
                }
              });

              return keptTemplates;
            };

            const dedupGoals = (localGoals: SavingGoal[]) => {
              const uniqueMap = new Map<string, SavingGoal>();
              const keptGoals: SavingGoal[] = [];

              localGoals.forEach(g => {
                const key = g.name.trim();
                const existing = uniqueMap.get(key);
                if (existing) {
                  const keepExisting = (existing.updatedAt || 0) >= (g.updatedAt || 0);
                  if (keepExisting) {
                    get().addTombstone(g.id, 'goals');
                  } else {
                    get().addTombstone(existing.id, 'goals');
                    uniqueMap.set(key, g);
                    const idx = keptGoals.findIndex(x => x.name.trim() === g.name.trim());
                    if (idx !== -1) keptGoals[idx] = g;
                  }
                } else {
                  uniqueMap.set(key, g);
                  keptGoals.push(g);
                }
              });

              return keptGoals;
            };

            const catDedup = dedupCategories(mergedCategories, mergedTransactions, mergedBudgets, mergedTemplates);
            mergedCategories = catDedup.categories;
            mergedTransactions = catDedup.transactions;
            mergedBudgets = catDedup.budgets;
            mergedTemplates = catDedup.templates;

            const accDedup = dedupAccounts(mergedAccounts, mergedTransactions, mergedTemplates, mergedGoals);
            mergedAccounts = accDedup.accounts;
            mergedTransactions = accDedup.transactions;
            mergedTemplates = accDedup.templates;
            mergedGoals = accDedup.goals;

            mergedBudgets = dedupBudgets(mergedBudgets);
            mergedTemplates = dedupTemplates(mergedTemplates);
            mergedGoals = dedupGoals(mergedGoals);

            // Update Zustand store locally first
            set({
              accounts: mergedAccounts.sort((a, b) => (a.order || 0) - (b.order || 0)),
              categories: mergedCategories.sort((a, b) => (a.order || 0) - (b.order || 0)),
              transactions: mergedTransactions.sort((a, b) => {
                const timeA = a.date ? new Date(a.date).getTime() : 0;
                const timeB = b.date ? new Date(b.date).getTime() : 0;
                return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
              }),
              budgets: mergedBudgets,
              templates: mergedTemplates,
              goals: mergedGoals
            });

            // 3. Firestore Write Phase (compares final state with original remote state and writes changes)
            const uploadAndDeleteSingleCollection = async (
              collectionName: string,
              finalLocalItems: any[],
              remoteItemsMap: Map<string, any>
            ) => {
              const itemsToUpload: any[] = [];
              const itemsToDeleteFromRemote: string[] = [];

              // Check what to upload/update on server
              finalLocalItems.forEach(local => {
                const remote = remoteItemsMap.get(local.id);
                if (!remote) {
                  itemsToUpload.push(local);
                } else {
                  const localTime = local.updatedAt || 0;
                  const remoteTime = remote.updatedAt || 0;
                  if (localTime > remoteTime) {
                    itemsToUpload.push(local);
                  }
                }
              });

              // Check what to delete from server (retrieve latest tombstones from state)
              const currentTombstones = get().tombstones;
              const localIds = new Set(finalLocalItems.map(item => item.id));
              for (const [remoteId, remote] of remoteItemsMap.entries()) {
                if (!localIds.has(remoteId)) {
                  const tombstone = currentTombstones[remoteId];
                  if (tombstone) {
                    itemsToDeleteFromRemote.push(remoteId);
                  } else if (lastSyncTime > 0 && (remote.updatedAt || 0) < lastSyncTime) {
                    itemsToDeleteFromRemote.push(remoteId);
                  }
                }
              }

              if (itemsToUpload.length > 0 || itemsToDeleteFromRemote.length > 0) {
                const batch = writeBatch(db);
                itemsToUpload.forEach(item => {
                  const ref = doc(db, `users/${userId}/${collectionName}`, item.id);
                  const cleanItem = { ...item, userId };
                  Object.keys(cleanItem).forEach(key => {
                    if ((cleanItem as any)[key] === undefined) delete (cleanItem as any)[key];
                  });
                  batch.set(ref, cleanItem);
                });

                itemsToDeleteFromRemote.forEach(id => {
                  const ref = doc(db, `users/${userId}/${collectionName}`, id);
                  batch.delete(ref);
                });

                await batch.commit();
              }
            };

            await Promise.all([
              uploadAndDeleteSingleCollection('accounts', get().accounts, accountsResult.remoteItemsMap),
              uploadAndDeleteSingleCollection('categories', get().categories, categoriesResult.remoteItemsMap),
              uploadAndDeleteSingleCollection('transactions', get().transactions, transactionsResult.remoteItemsMap),
              uploadAndDeleteSingleCollection('budgets', get().budgets, budgetsResult.remoteItemsMap),
              uploadAndDeleteSingleCollection('templates', get().templates, templatesResult.remoteItemsMap),
              uploadAndDeleteSingleCollection('goals', get().goals, goalsResult.remoteItemsMap)
            ]);

            // Clean up old tombstones
            const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
            const activeTombstones = { ...get().tombstones };
            let tombstonesChanged = false;
            Object.entries(activeTombstones).forEach(([id, tomb]) => {
              if (tomb.deletedAt < thirtyDaysAgo) {
                delete activeTombstones[id];
                tombstonesChanged = true;
              }
            });

            set({
              syncStatus: 'synced',
              syncSettings: { ...get().syncSettings, lastSyncTime: Date.now() },
              ...(tombstonesChanged ? { tombstones: activeTombstones } : {})
            });

            setTimeout(() => {
              if (get().syncStatus === 'synced') {
                set({ syncStatus: 'idle' });
              }
            }, 3000);

          } catch (e) {
            console.error("Data bidirectional synchronization failed", e);
            set({ syncStatus: 'error' });
          }
        }
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
        tombstones: state.tombstones
      }),
    }
  )
);
