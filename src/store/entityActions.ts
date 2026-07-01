import { v4 as uuidv4 } from 'uuid';
import { writeBatch, doc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { firestoreService } from '../services/firestoreService';
import { computeNetEffect } from './balanceEngine';

type SetFn = (partial: any) => void;
type GetFn = () => any;

// ─── Transaction Actions ────────────────────────────────────────
export function createTransactionActions(set: SetFn, get: GetFn) {
  const syncToCloud = async (action: () => Promise<void>) => {
    const { syncSettings } = get();
    if (syncSettings.storageMode !== 'cloud') return;
    try { await action(); } catch (e: any) {
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
  };

  return {
    addTransaction: async (transaction: any) => {
      const newTx = { ...transaction, id: uuidv4(), updatedAt: Date.now() };

      const accounts = get().accounts.map((a: any) => ({ ...a }));
      if (newTx.type === 'expense' && newTx.fromAccountId) {
        const acc = accounts.find((a: any) => a.id === newTx.fromAccountId);
        if (acc) acc.balance -= newTx.amount;
      } else if (newTx.type === 'income' && newTx.toAccountId) {
        const acc = accounts.find((a: any) => a.id === newTx.toAccountId);
        if (acc) acc.balance += newTx.amount;
      } else if (newTx.type === 'transfer' && newTx.fromAccountId && newTx.toAccountId) {
        const fromAcc = accounts.find((a: any) => a.id === newTx.fromAccountId);
        const toAcc = accounts.find((a: any) => a.id === newTx.toAccountId);
        if (fromAcc) fromAcc.balance -= newTx.amount;
        if (toAcc) toAcc.balance += newTx.amount;
      }

      set((state: any) => {
        let updatedTransactions = [newTx, ...state.transactions];

        if (newTx.reimbursedTxIds && newTx.reimbursedTxIds.length > 0) {
          updatedTransactions = updatedTransactions.map((t: any) => {
            if (newTx.reimbursedTxIds.includes(t.id)) {
              return { ...t, isReimbursed: true, reimbursedByTxId: newTx.id };
            }
            return t;
          });
        }

        return {
          transactions: updatedTransactions.sort((a: any, b: any) => {
            const timeA = a.date ? new Date(a.date).getTime() : 0;
            const timeB = b.date ? new Date(b.date).getTime() : 0;
            return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
          }),
          accounts,
        };
      });

      await syncToCloud(async () => {
        await firestoreService.addTransaction(newTx, get().accounts, get().transactions);
      });
    },

    updateTransaction: async (id: string, updatedFields: any) => {
      const oldTx = get().transactions.find((t: any) => t.id === id);
      if (!oldTx) return;

      const newTx = { ...oldTx, ...updatedFields, updatedAt: Date.now() };
      const accounts = get().accounts.map((a: any) => ({ ...a }));

      // Revert old
      if (oldTx.type === 'expense' && oldTx.fromAccountId) {
        const acc = accounts.find((a: any) => a.id === oldTx.fromAccountId);
        if (acc) acc.balance += oldTx.amount;
      } else if (oldTx.type === 'income' && oldTx.toAccountId) {
        const acc = accounts.find((a: any) => a.id === oldTx.toAccountId);
        if (acc) acc.balance -= oldTx.amount;
      } else if (oldTx.type === 'transfer' && oldTx.fromAccountId && oldTx.toAccountId) {
        const fromAcc = accounts.find((a: any) => a.id === oldTx.fromAccountId);
        const toAcc = accounts.find((a: any) => a.id === oldTx.toAccountId);
        if (fromAcc) fromAcc.balance += oldTx.amount;
        if (toAcc) toAcc.balance -= oldTx.amount;
      }

      // Apply new
      if (newTx.type === 'expense' && newTx.fromAccountId) {
        const acc = accounts.find((a: any) => a.id === newTx.fromAccountId);
        if (acc) acc.balance -= newTx.amount;
      } else if (newTx.type === 'income' && newTx.toAccountId) {
        const acc = accounts.find((a: any) => a.id === newTx.toAccountId);
        if (acc) acc.balance += newTx.amount;
      } else if (newTx.type === 'transfer' && newTx.fromAccountId && newTx.toAccountId) {
        const fromAcc = accounts.find((a: any) => a.id === newTx.fromAccountId);
        const toAcc = accounts.find((a: any) => a.id === newTx.toAccountId);
        if (fromAcc) fromAcc.balance -= newTx.amount;
        if (toAcc) toAcc.balance += newTx.amount;
      }

      set((state: any) => {
        let updatedTransactions = state.transactions.map((t: any) => t.id === id ? newTx : t);

        if (oldTx.reimbursedTxIds !== newTx.reimbursedTxIds) {
          const oldIds = oldTx.reimbursedTxIds || [];
          const newIds = newTx.reimbursedTxIds || [];
          
          const removedIds = oldIds.filter((tid: string) => !newIds.includes(tid));
          const addedIds = newIds.filter((tid: string) => !oldIds.includes(tid));

          updatedTransactions = updatedTransactions.map((t: any) => {
            if (removedIds.includes(t.id)) {
              return { ...t, isReimbursed: false, reimbursedByTxId: undefined };
            }
            if (addedIds.includes(t.id)) {
              return { ...t, isReimbursed: true, reimbursedByTxId: newTx.id };
            }
            return t;
          });
        }

        return {
          transactions: updatedTransactions.sort((a: any, b: any) => {
            const timeA = a.date ? new Date(a.date).getTime() : 0;
            const timeB = b.date ? new Date(b.date).getTime() : 0;
            return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
          }),
          accounts,
        };
      });

      await syncToCloud(async () => {
        await firestoreService.updateTransaction(id, updatedFields, oldTx, get().accounts, get().transactions);
      });
    },

    deleteTransaction: async (id: string) => {
      const tx = get().transactions.find((t: any) => t.id === id);
      if (!tx) return;
      get().addTombstone(id, 'transactions');

      const accounts = get().accounts.map((a: any) => ({ ...a }));
      if (tx.type === 'expense' && tx.fromAccountId) {
        const acc = accounts.find((a: any) => a.id === tx.fromAccountId);
        if (acc) acc.balance += tx.amount;
      } else if (tx.type === 'income' && tx.toAccountId) {
        const acc = accounts.find((a: any) => a.id === tx.toAccountId);
        if (acc) acc.balance -= tx.amount;
      } else if (tx.type === 'transfer' && tx.fromAccountId && tx.toAccountId) {
        const fromAcc = accounts.find((a: any) => a.id === tx.fromAccountId);
        const toAcc = accounts.find((a: any) => a.id === tx.toAccountId);
        if (fromAcc) fromAcc.balance += tx.amount;
        if (toAcc) toAcc.balance -= tx.amount;
      }

      set((state: any) => {
        let updatedTransactions = state.transactions.filter((t: any) => t.id !== id);

        if (tx.reimbursedTxIds && tx.reimbursedTxIds.length > 0) {
          updatedTransactions = updatedTransactions.map((t: any) => {
            if (tx.reimbursedTxIds.includes(t.id)) {
              return { ...t, isReimbursed: false, reimbursedByTxId: undefined };
            }
            return t;
          });
        }

        if (tx.reimbursedByTxId) {
          updatedTransactions = updatedTransactions.map((t: any) => {
            if (t.id === tx.reimbursedByTxId) {
              return { ...t, reimbursedTxIds: t.reimbursedTxIds?.filter((tid: string) => tid !== id) || [] };
            }
            return t;
          });
        }

        return {
          transactions: updatedTransactions,
          accounts,
        };
      });

      await syncToCloud(async () => {
        await firestoreService.deleteTransaction(id, tx, get().accounts, get().transactions);
      });
    },
  };
}

// ─── Account Actions ────────────────────────────────────────────
export function createAccountActions(set: SetFn, get: GetFn) {
  const syncToCloud = async (action: () => Promise<void>) => {
    const { syncSettings } = get();
    if (syncSettings.storageMode !== 'cloud') return;
    try { await action(); } catch (e) { console.error('Cloud sync failed', e); }
  };

  return {
    addAccount: async (account: any) => {
      const newAccount = { ...account, id: uuidv4(), order: get().accounts.length, updatedAt: Date.now() };
      set((state: any) => ({ accounts: [...state.accounts, newAccount] }));
      await syncToCloud(async () => { await firestoreService.addDocument('accounts', newAccount); });
    },

    updateAccount: async (id: string, account: any) => {
      if (account.balance !== undefined) {
        const { transactions } = get();
        const netEffect = computeNetEffect(transactions, id);
        account = {
          ...account,
          initialBalance: Math.round((account.balance - netEffect) * 100) / 100,
        };
      }
      set((state: any) => ({
        accounts: state.accounts.map((a: any) => a.id === id ? { ...a, ...account, updatedAt: Date.now() } : a),
      }));
      await syncToCloud(async () => {
        await firestoreService.updateDocument('accounts', id, { ...account, updatedAt: Date.now() });
      });
    },

    deleteAccount: async (id: string) => {
      get().addTombstone(id, 'accounts');
      set((state: any) => ({ accounts: state.accounts.filter((a: any) => a.id !== id) }));
      await syncToCloud(async () => { await firestoreService.deleteDocument('accounts', id); });
    },

    reorderAccount: async (id: string, direction: 'up' | 'down') => {
      const accounts = [...get().accounts].sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
      const index = accounts.findIndex((a: any) => a.id === id);
      if (index < 0) return;
      let swapIndex = -1;
      if (direction === 'up' && index > 0) swapIndex = index - 1;
      else if (direction === 'down' && index < accounts.length - 1) swapIndex = index + 1;
      if (swapIndex !== -1) {
        const temp = accounts[index].order ?? index;
        accounts[index].order = accounts[swapIndex].order ?? swapIndex;
        accounts[swapIndex].order = temp;
        const sorted = accounts.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
        set({ accounts: sorted });
        await syncToCloud(async () => {
          await firestoreService.updateDocument('accounts', accounts[index].id, { order: accounts[index].order });
          await firestoreService.updateDocument('accounts', accounts[swapIndex].id, { order: accounts[swapIndex].order });
        });
      }
    },

    reorderAccountsList: async (reorderedAccounts: any[]) => {
      const currentAccounts = get().accounts;
      const updatedAccounts: any[] = [];
      reorderedAccounts.forEach((acc, index) => {
        const currentAcc = currentAccounts.find((a: any) => a.id === acc.id);
        if (!currentAcc || currentAcc.order !== index) {
          updatedAccounts.push({ ...acc, order: index });
        }
      });
      if (updatedAccounts.length === 0) return;
      const allAccounts = currentAccounts.map((acc: any) => {
        const updated = updatedAccounts.find((ua: any) => ua.id === acc.id);
        return updated ? updated : acc;
      }).sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
      set({ accounts: allAccounts });
      await syncToCloud(async () => {
        const batch = writeBatch(db);
        const userId = auth.currentUser?.uid;
        if (!userId) return;
        updatedAccounts.forEach((acc: any) => {
          batch.update(doc(db, `users/${userId}/accounts`, acc.id), { order: acc.order });
        });
        await batch.commit();
      });
    },
  };
}

// ─── Category Actions ───────────────────────────────────────────
export function createCategoryActions(set: SetFn, get: GetFn) {
  const syncToCloud = async (action: () => Promise<void>) => {
    const { syncSettings } = get();
    if (syncSettings.storageMode !== 'cloud') return;
    try { await action(); } catch (e) { console.error('Cloud sync failed', e); }
  };

  return {
    addCategory: async (category: any) => {
      const id = category.id || uuidv4();
      const newCategory = { ...category, id, order: get().categories.length, updatedAt: Date.now() };
      set((state: any) => ({ categories: [...state.categories, newCategory] }));
      await syncToCloud(async () => { await firestoreService.addDocument('categories', newCategory); });
    },

    updateCategory: async (id: string, category: any) => {
      set((state: any) => ({
        categories: state.categories.map((c: any) => c.id === id ? { ...c, ...category, updatedAt: Date.now() } : c),
      }));
      await syncToCloud(async () => {
        await firestoreService.updateDocument('categories', id, { ...category, updatedAt: Date.now() });
      });
    },

    deleteCategory: async (id: string) => {
      get().addTombstone(id, 'categories');
      set((state: any) => ({ categories: state.categories.filter((c: any) => c.id !== id) }));
      await syncToCloud(async () => { await firestoreService.deleteDocument('categories', id); });
    },

    reorderCategory: async (id: string, direction: 'up' | 'down') => {
      const cat = get().categories.find((c: any) => c.id === id);
      if (!cat) return;
      const typeCategories = get().categories
        .filter((c: any) => c.type === cat.type)
        .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
      const index = typeCategories.findIndex((c: any) => c.id === id);
      if (index < 0) return;
      let swapIndex = -1;
      if (direction === 'up' && index > 0) swapIndex = index - 1;
      else if (direction === 'down' && index < typeCategories.length - 1) swapIndex = index + 1;
      if (swapIndex !== -1) {
        const temp = typeCategories[index].order ?? index;
        typeCategories[index].order = typeCategories[swapIndex].order ?? swapIndex;
        typeCategories[swapIndex].order = temp;
        const allCategories = get().categories.map((c: any) => {
          const updated = typeCategories.find((tc: any) => tc.id === c.id);
          return updated ? updated : c;
        }).sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
        set({ categories: allCategories });
        await syncToCloud(async () => {
          await firestoreService.updateDocument('categories', typeCategories[index].id, { order: typeCategories[index].order });
          await firestoreService.updateDocument('categories', typeCategories[swapIndex].id, { order: typeCategories[swapIndex].order });
        });
      }
    },

    reorderCategoriesList: async (reorderedCategories: any[]) => {
      const currentCategories = get().categories;
      const updatedCategories: any[] = [];
      reorderedCategories.forEach((cat, index) => {
        const currentCat = currentCategories.find((c: any) => c.id === cat.id);
        if (!currentCat || currentCat.order !== index) {
          updatedCategories.push({ ...cat, order: index });
        }
      });
      if (updatedCategories.length === 0) return;
      const allCategories = currentCategories.map((cat: any) => {
        const updated = updatedCategories.find((uc: any) => uc.id === cat.id);
        return updated ? updated : cat;
      }).sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
      set({ categories: allCategories });
      await syncToCloud(async () => {
        const batch = writeBatch(db);
        const userId = auth.currentUser?.uid;
        if (!userId) return;
        updatedCategories.forEach((cat: any) => {
          batch.update(doc(db, `users/${userId}/categories`, cat.id), { order: cat.order });
        });
        await batch.commit();
      });
    },
  };
}

// ─── Budget / Template / Goal Actions ───────────────────────────
function simpleSyncToCloud(get: GetFn) {
  return async (action: () => Promise<void>) => {
    const { syncSettings } = get();
    if (syncSettings.storageMode !== 'cloud') return;
    try { await action(); } catch (e) { console.error('Cloud sync failed', e); }
  };
}

export function createBudgetActions(set: SetFn, get: GetFn) {
  const sync = simpleSyncToCloud(get);
  return {
    addBudget: async (budget: any) => {
      const newBudget = { ...budget, id: uuidv4(), updatedAt: Date.now() };
      set((state: any) => ({ budgets: [...state.budgets, newBudget] }));
      await sync(async () => { await firestoreService.addDocument('budgets', newBudget); });
    },
    updateBudget: async (id: string, budget: any) => {
      set((state: any) => ({
        budgets: state.budgets.map((b: any) => b.id === id ? { ...b, ...budget, updatedAt: Date.now() } : b),
      }));
      await sync(async () => {
        await firestoreService.updateDocument('budgets', id, { ...budget, updatedAt: Date.now() });
      });
    },
    deleteBudget: async (id: string) => {
      get().addTombstone(id, 'budgets');
      set((state: any) => ({ budgets: state.budgets.filter((b: any) => b.id !== id) }));
      await sync(async () => { await firestoreService.deleteDocument('budgets', id); });
    },
  };
}

export function createTemplateActions(set: SetFn, get: GetFn) {
  const sync = simpleSyncToCloud(get);
  return {
    addTemplate: async (template: any) => {
      const newTemplate = { ...template, id: uuidv4(), updatedAt: Date.now() };
      set((state: any) => ({ templates: [...state.templates, newTemplate] }));
      await sync(async () => { await firestoreService.addDocument('templates', newTemplate); });
    },
    updateTemplate: async (id: string, updatedFields: any) => {
      set((state: any) => ({
        templates: state.templates.map((t: any) => t.id === id ? { ...t, ...updatedFields, updatedAt: Date.now() } : t),
      }));
      await sync(async () => {
        await firestoreService.updateDocument('templates', id, { ...updatedFields, updatedAt: Date.now() });
      });
    },
    deleteTemplate: async (id: string) => {
      get().addTombstone(id, 'templates');
      set((state: any) => ({ templates: state.templates.filter((t: any) => t.id !== id) }));
      await sync(async () => { await firestoreService.deleteDocument('templates', id); });
    },
  };
}

export function createGoalActions(set: SetFn, get: GetFn) {
  const sync = simpleSyncToCloud(get);
  return {
    addGoal: async (goal: any) => {
      const newGoal = { ...goal, id: uuidv4(), updatedAt: Date.now() };
      set((state: any) => ({ goals: [...state.goals, newGoal] }));
      await sync(async () => { await firestoreService.addDocument('goals', newGoal); });
    },
    updateGoal: async (id: string, goal: any) => {
      set((state: any) => ({
        goals: state.goals.map((g: any) => g.id === id ? { ...g, ...goal, updatedAt: Date.now() } : g),
      }));
      await sync(async () => {
        await firestoreService.updateDocument('goals', id, { ...goal, updatedAt: Date.now() });
      });
    },
    deleteGoal: async (id: string) => {
      get().addTombstone(id, 'goals');
      set((state: any) => ({ goals: state.goals.filter((g: any) => g.id !== id) }));
      await sync(async () => { await firestoreService.deleteDocument('goals', id); });
    },
  };
}
