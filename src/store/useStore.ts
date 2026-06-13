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

  // Actions
  addTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  updateTransaction: (id: string, transaction: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;

  addAccount: (account: Omit<Account, 'id'>) => void;
  updateAccount: (id: string, account: Partial<Account>) => void;
  deleteAccount: (id: string) => void;
  reorderAccount: (id: string, direction: 'up' | 'down') => void;
  reorderAccountsList: (accounts: Account[]) => void;

  addCategory: (category: Omit<Category, 'id'>) => void;
  updateCategory: (id: string, category: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  reorderCategory: (id: string, direction: 'up' | 'down') => void;
  reorderCategoriesList: (categories: Category[]) => void;

  addBudget: (budget: Omit<Budget, 'id'>) => void;
  updateBudget: (id: string, budget: Partial<Budget>) => void;
  deleteBudget: (id: string) => void;

  addTemplate: (template: Omit<TransactionTemplate, 'id'>) => void;
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

        setSyncSettings: (settings) => set((state) => ({ syncSettings: { ...state.syncSettings, ...settings } })),
        toggleShowReimbursables: () => set((state) => ({ showReimbursables: !state.showReimbursables })),

        setAccounts: (accounts) => set({ accounts: accounts.sort((a, b) => (a.order || 0) - (b.order || 0)) }),
        setCategories: (categories) => set({ categories: categories.sort((a, b) => (a.order || 0) - (b.order || 0)) }),
        setTransactions: (transactions) => set({ transactions }),
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
          const newTx = { ...transaction, id: uuidv4() } as Transaction;
          
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
            transactions: [newTx, ...state.transactions],
            accounts
          }));

          await syncToCloud(async () => {
            await firestoreService.addTransaction(newTx, get().accounts, get().transactions);
          });
        },

        updateTransaction: async (id, updatedFields) => {
          const oldTx = get().transactions.find((t) => t.id === id);
          if (!oldTx) return;
          
          const newTx = { ...oldTx, ...updatedFields };
          
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
            transactions: state.transactions.map(t => t.id === id ? newTx : t),
            accounts
          }));

          await syncToCloud(async () => {
            await firestoreService.updateTransaction(id, updatedFields, oldTx, get().accounts, get().transactions);
          });
        },

        deleteTransaction: async (id) => {
          const tx = get().transactions.find((t) => t.id === id);
          if (!tx) return;

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
          const newAccount = { ...account, id: uuidv4(), order: get().accounts.length } as Account;
          set((state) => ({ accounts: [...state.accounts, newAccount] }));
          await syncToCloud(async () => { await firestoreService.addDocument('accounts', newAccount); });
        },
        updateAccount: async (id, account) => {
          set((state) => ({ accounts: state.accounts.map(a => a.id === id ? { ...a, ...account } : a) }));
          await syncToCloud(async () => { await firestoreService.updateDocument('accounts', id, account); });
        },
        deleteAccount: async (id) => {
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
          const newCategory = { ...category, id: uuidv4(), order: get().categories.length } as Category;
          set((state) => ({ categories: [...state.categories, newCategory] }));
          await syncToCloud(async () => { await firestoreService.addDocument('categories', newCategory); });
        },
        updateCategory: async (id, category) => {
          set((state) => ({ categories: state.categories.map(c => c.id === id ? { ...c, ...category } : c) }));
          await syncToCloud(async () => { await firestoreService.updateDocument('categories', id, category); });
        },
        deleteCategory: async (id) => {
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
          const newBudget = { ...budget, id: uuidv4() } as Budget;
          set((state) => ({ budgets: [...state.budgets, newBudget] }));
          await syncToCloud(async () => { await firestoreService.addDocument('budgets', newBudget); });
        },
        updateBudget: async (id, budget) => {
          set((state) => ({ budgets: state.budgets.map(b => b.id === id ? { ...b, ...budget } : b) }));
          await syncToCloud(async () => { await firestoreService.updateDocument('budgets', id, budget); });
        },
        deleteBudget: async (id) => {
          set((state) => ({ budgets: state.budgets.filter(b => b.id !== id) }));
          await syncToCloud(async () => { await firestoreService.deleteDocument('budgets', id); });
        },

        addTemplate: async (template) => {
          const newTemplate = { ...template, id: uuidv4() } as TransactionTemplate;
          set((state) => ({ templates: [...state.templates, newTemplate] }));
          await syncToCloud(async () => { await firestoreService.addDocument('templates', newTemplate); });
        },
        deleteTemplate: async (id) => {
          set((state) => ({ templates: state.templates.filter(t => t.id !== id) }));
          await syncToCloud(async () => { await firestoreService.deleteDocument('templates', id); });
        },

        addGoal: async (goal) => {
          const newGoal = { ...goal, id: uuidv4() } as SavingGoal;
          set((state) => ({ goals: [...state.goals, newGoal] }));
          await syncToCloud(async () => { await firestoreService.addDocument('goals', newGoal); });
        },
        updateGoal: async (id, goal) => {
          set((state) => ({ goals: state.goals.map(g => g.id === id ? { ...g, ...goal } : g) }));
          await syncToCloud(async () => { await firestoreService.updateDocument('goals', id, goal); });
        },
        deleteGoal: async (id) => {
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
              transactions: txSnap.docs.map(d => ({ ...d.data(), id: d.id } as any)),
              budgets: budSnap.docs.map(d => ({ ...d.data(), id: d.id } as any)),
              templates: tplSnap.docs.map(d => ({ ...d.data(), id: d.id } as any)),
              goals: goalSnap.docs.map(d => ({ ...d.data(), id: d.id } as any)),
              syncSettings: { ...get().syncSettings, lastSyncTime: Date.now() }
            });
          } catch (e) {
            console.error("Pull from cloud failed", e);
            throw e;
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
        isGuestMode: state.isGuestMode
      }),
    }
  )
);
