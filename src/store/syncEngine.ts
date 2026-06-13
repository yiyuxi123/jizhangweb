import { collection, getDocs, getDoc, writeBatch, doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { firestoreService } from '../services/firestoreService';
import { Category, Account, Budget, TransactionTemplate, SavingGoal, Transaction } from '../types';

type SetFn = (partial: any) => void;
type GetFn = () => any;

export function createSyncToCloudNow(set: SetFn, get: GetFn) {
  return async function syncToCloudNow() {
    const state = get();
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error('Not logged in');

      const operations: { ref: any; data: any }[] = [];

      state.accounts.forEach((acc: any) => {
        operations.push({ ref: doc(db, `users/${userId}/accounts`, acc.id), data: { ...acc, userId } });
      });
      state.categories.forEach((cat: any) => {
        operations.push({ ref: doc(db, `users/${userId}/categories`, cat.id), data: { ...cat, userId } });
      });
      state.transactions.forEach((tx: any) => {
        let cleanTx = { ...tx, userId };
        if (typeof cleanTx.image === 'string' && cleanTx.image.length > 200_000) {
          console.warn(`Stripping oversized image (${cleanTx.image.length} chars) from tx ${tx.id}`);
          delete cleanTx.image;
          const localTx = get().transactions.find((t: any) => t.id === tx.id);
          if (localTx && localTx.image) {
            set((s: any) => ({
              transactions: s.transactions.map((t: any) =>
                t.id === tx.id ? { ...t, image: undefined } : t
              ),
            }));
          }
        }
        operations.push({ ref: doc(db, `users/${userId}/transactions`, tx.id), data: cleanTx });
      });
      state.budgets.forEach((b: any) => {
        operations.push({ ref: doc(db, `users/${userId}/budgets`, b.id), data: { ...b, userId } });
      });
      state.templates.forEach((t: any) => {
        operations.push({ ref: doc(db, `users/${userId}/templates`, t.id), data: { ...t, userId } });
      });
      state.goals.forEach((g: any) => {
        operations.push({ ref: doc(db, `users/${userId}/goals`, g.id), data: { ...g, userId } });
      });

      if (operations.length > 0) {
        const batches = [];
        let currentBatch = writeBatch(db);
        let count = 0;

        for (const op of operations) {
          const cleanData = { ...op.data };
          Object.keys(cleanData).forEach((key) => {
            if (cleanData[key] === undefined) delete cleanData[key];
          });
          currentBatch.set(op.ref, cleanData);
          count++;
          if (count === 400) {
            batches.push(currentBatch);
            currentBatch = writeBatch(db);
            count = 0;
          }
        }
        if (count > 0) batches.push(currentBatch);
        for (const b of batches) await b.commit();
      }

      if (state.deepseekApiKey || state.qwenApiKey) {
        await setDoc(
          doc(db, `users/${userId}/config`, 'api_keys'),
          {
            deepseekApiKey: state.deepseekApiKey || '',
            qwenApiKey: state.qwenApiKey || '',
            updatedAt: Date.now(),
          },
          { merge: true }
        );
      }

      set({ syncSettings: { ...state.syncSettings, lastSyncTime: Date.now() } });
    } catch (e: any) {
      console.error('Failed to syncToCloudNow:', e);
      const msg = e?.message || String(e);
      const code = e?.code || '';
      const fullMsg = `[${code}] ${msg}`;
      if (msg.includes('exceeds') || msg.includes('size') || code === 'out-of-range') {
        set({ syncError: `数据过大无法同步：${msg}\n\n请删除过大的图片附件，或清空旧数据后重试。` });
      } else if (msg.includes('permission') || msg.includes('PERMISSION_DENIED')) {
        set({ syncError: `权限不足：${msg}\n\n请在 Firebase 控制台检查 Firestore 安全规则。` });
      } else if (msg.includes('unavailable') || msg.includes('network') || msg.includes('timeout') || code === 'unavailable') {
        set({ syncError: `网络错误：${fullMsg}\n\n请确认设备能访问 Google 服务（Firestore）。` });
      } else {
        set({ syncError: `云端同步失败: ${fullMsg}` });
      }
      set({ syncStatus: 'error' });
      throw e;
    }
  };
}

export function createPullFromCloud(set: SetFn, get: GetFn) {
  return async function pullFromCloud() {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('Not logged in');

    const { syncStatus } = get();
    if (syncStatus === 'syncing') return;
    set({ syncStatus: 'syncing' });

    try {
      const [accSnap, catSnap, txSnap, budSnap, tplSnap, goalSnap, keysSnap] = await Promise.all([
        getDocs(collection(db, `users/${userId}/accounts`)),
        getDocs(collection(db, `users/${userId}/categories`)),
        getDocs(collection(db, `users/${userId}/transactions`)),
        getDocs(collection(db, `users/${userId}/budgets`)),
        getDocs(collection(db, `users/${userId}/templates`)),
        getDocs(collection(db, `users/${userId}/goals`)),
        getDoc(doc(db, `users/${userId}/config`, 'api_keys')).catch(() => null),
      ]);

      const keysData = keysSnap && keysSnap.exists() ? keysSnap.data() : null;
      const remoteDSKey = keysData?.deepseekApiKey || '';
      const remoteQWKey = keysData?.qwenApiKey || '';

      set({
        accounts: accSnap.docs.map((d) => ({ ...d.data(), id: d.id } as any)),
        categories: catSnap.docs.map((d) => ({ ...d.data(), id: d.id } as any)),
        transactions: txSnap.docs
          .map((d) => ({ ...d.data(), id: d.id } as any))
          .sort((a: any, b: any) => {
            const timeA = a.date ? new Date(a.date).getTime() : 0;
            const timeB = b.date ? new Date(b.date).getTime() : 0;
            return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
          }),
        budgets: budSnap.docs.map((d) => ({ ...d.data(), id: d.id } as any)),
        templates: tplSnap.docs.map((d) => ({ ...d.data(), id: d.id } as any)),
        goals: goalSnap.docs.map((d) => ({ ...d.data(), id: d.id } as any)),
        deepseekApiKey: remoteDSKey || get().deepseekApiKey,
        qwenApiKey: remoteQWKey || get().qwenApiKey,
        syncSettings: { ...get().syncSettings, lastSyncTime: Date.now() },
        syncStatus: 'synced',
      });

      setTimeout(() => {
        if (get().syncStatus === 'synced') set({ syncStatus: 'idle' });
      }, 3000);
    } catch (e) {
      console.error('Pull from cloud failed', e);
      set({ syncStatus: 'error' });
      throw e;
    }
  };
}

export function createClearAllData(set: SetFn, get: GetFn) {
  return async function clearAllData() {
    set({
      accounts: [],
      categories: [],
      transactions: [],
      budgets: [],
      templates: [],
      goals: [],
      tombstones: {},
    });
    const userId = auth.currentUser?.uid;
    if (userId && get().syncSettings.storageMode === 'cloud') {
      await firestoreService.clearAllData();
    }
  };
}

export function createRestoreData(set: SetFn, get: GetFn) {
  return async function restoreData(data: any) {
    set({
      accounts: (data.accounts || []).map((a: any) => ({
        ...a,
        balance: Math.round((a.balance || 0) * 100) / 100,
      })),
      categories: data.categories || [],
      transactions: (data.transactions || [])
        .map((t: any) => {
          const cleanTx = { ...t, amount: Math.round((t.amount || 0) * 100) / 100 };
          if (cleanTx.history) delete cleanTx.history;
          if (cleanTx.note && cleanTx.note.length > 500) cleanTx.note = cleanTx.note.substring(0, 500);
          return cleanTx;
        })
        .sort((a: any, b: any) => {
          const timeA = a.date ? new Date(a.date).getTime() : 0;
          const timeB = b.date ? new Date(b.date).getTime() : 0;
          return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
        }),
      budgets: data.budgets || [],
      templates: data.templates || [],
      goals: data.goals || [],
      tombstones: data.tombstones || {},
    });

    get().recalculateBalances(true);

    const userId = auth.currentUser?.uid;
    if (userId && get().syncSettings.storageMode === 'cloud') {
      await firestoreService.restoreData({
        accounts: get().accounts,
        categories: get().categories,
        transactions: get().transactions,
        budgets: get().budgets,
        templates: get().templates,
        goals: get().goals,
      });
    }
  };
}

// ─── Deduplication helpers (pure functions) ─────────────────────

export function dedupCategories(
  localCategories: Category[],
  localTransactions: Transaction[],
  localBudgets: Budget[],
  localTemplates: TransactionTemplate[],
  addTombstone: (id: string, type: string) => void
) {
  const uniqueMap = new Map<string, Category>();
  const duplicatesToRemap = new Map<string, string>();
  const keptCategories: Category[] = [];

  localCategories.forEach((cat) => {
    const key = `${cat.name.trim()}_${cat.type}`;
    const existing = uniqueMap.get(key);
    if (existing) {
      const keepExisting = !existing.id.startsWith('cat-') || cat.id.startsWith('cat-');
      if (keepExisting) {
        duplicatesToRemap.set(cat.id, existing.id);
      } else {
        duplicatesToRemap.set(existing.id, cat.id);
        uniqueMap.set(key, cat);
        const idx = keptCategories.findIndex((c) => c.id === existing.id);
        if (idx !== -1) keptCategories[idx] = cat;
      }
    } else {
      uniqueMap.set(key, cat);
      keptCategories.push(cat);
    }
  });

  if (duplicatesToRemap.size > 0) {
    duplicatesToRemap.forEach((targetId, sourceId) => {
      let current = targetId;
      const visited = new Set<string>([sourceId]);
      while (duplicatesToRemap.has(current) && !visited.has(current)) {
        visited.add(current);
        current = duplicatesToRemap.get(current)!;
      }
      duplicatesToRemap.set(sourceId, current);
    });

    const updatedTxs = localTransactions.map((tx) => {
      if (tx.categoryId && duplicatesToRemap.has(tx.categoryId)) {
        return { ...tx, categoryId: duplicatesToRemap.get(tx.categoryId)!, updatedAt: Date.now() };
      }
      return tx;
    });
    const updatedBudgets = localBudgets.map((b) => {
      if (b.categoryId && duplicatesToRemap.has(b.categoryId)) {
        return { ...b, categoryId: duplicatesToRemap.get(b.categoryId)!, updatedAt: Date.now() };
      }
      return b;
    });
    const updatedTemplates = localTemplates.map((t) => {
      if (t.categoryId && duplicatesToRemap.has(t.categoryId)) {
        return { ...t, categoryId: duplicatesToRemap.get(t.categoryId)!, updatedAt: Date.now() };
      }
      return t;
    });

    duplicatesToRemap.forEach((keptId, duplicateId) => {
      addTombstone(duplicateId, 'categories');
    });

    return { categories: keptCategories, transactions: updatedTxs, budgets: updatedBudgets, templates: updatedTemplates };
  }

  return { categories: keptCategories, transactions: localTransactions, budgets: localBudgets, templates: localTemplates };
}

export function dedupAccounts(
  localAccounts: Account[],
  localTransactions: Transaction[],
  localTemplates: TransactionTemplate[],
  localGoals: SavingGoal[],
  addTombstone: (id: string, type: string) => void
) {
  const uniqueMap = new Map<string, Account>();
  const duplicatesToRemap = new Map<string, string>();
  const keptAccounts: Account[] = [];

  localAccounts.forEach((acc) => {
    const key = acc.name.trim();
    const existing = uniqueMap.get(key);
    if (existing) {
      const keepExisting = !existing.id.startsWith('acc-') || acc.id.startsWith('acc-');
      if (keepExisting) {
        duplicatesToRemap.set(acc.id, existing.id);
      } else {
        duplicatesToRemap.set(existing.id, acc.id);
        uniqueMap.set(key, acc);
        const idx = keptAccounts.findIndex((a) => a.id === existing.id);
        if (idx !== -1) keptAccounts[idx] = acc;
      }
    } else {
      uniqueMap.set(key, acc);
      keptAccounts.push(acc);
    }
  });

  if (duplicatesToRemap.size > 0) {
    duplicatesToRemap.forEach((targetId, sourceId) => {
      let current = targetId;
      const visited = new Set<string>([sourceId]);
      while (duplicatesToRemap.has(current) && !visited.has(current)) {
        visited.add(current);
        current = duplicatesToRemap.get(current)!;
      }
      duplicatesToRemap.set(sourceId, current);
    });

    const updatedTxs = localTransactions.map((tx) => {
      let changed = false;
      let fromId = tx.fromAccountId;
      let toId = tx.toAccountId;
      if (fromId && duplicatesToRemap.has(fromId)) { fromId = duplicatesToRemap.get(fromId)!; changed = true; }
      if (toId && duplicatesToRemap.has(toId)) { toId = duplicatesToRemap.get(toId)!; changed = true; }
      return changed ? { ...tx, fromAccountId: fromId, toAccountId: toId, updatedAt: Date.now() } : tx;
    });
    const updatedTemplates = localTemplates.map((t) => {
      let changed = false;
      let fromId = t.fromAccountId;
      let toId = t.toAccountId;
      if (fromId && duplicatesToRemap.has(fromId)) { fromId = duplicatesToRemap.get(fromId)!; changed = true; }
      if (toId && duplicatesToRemap.has(toId)) { toId = duplicatesToRemap.get(toId)!; changed = true; }
      return changed ? { ...t, fromAccountId: fromId, toAccountId: toId, updatedAt: Date.now() } : t;
    });
    const updatedGoals = localGoals.map((g) => {
      if (g.accountId && duplicatesToRemap.has(g.accountId)) {
        return { ...g, accountId: duplicatesToRemap.get(g.accountId)!, updatedAt: Date.now() };
      }
      return g;
    });

    duplicatesToRemap.forEach((keptId, duplicateId) => {
      addTombstone(duplicateId, 'accounts');
    });

    return { accounts: keptAccounts, transactions: updatedTxs, templates: updatedTemplates, goals: updatedGoals };
  }

  return { accounts: keptAccounts, transactions: localTransactions, templates: localTemplates, goals: localGoals };
}

export function dedupBudgets(localBudgets: Budget[], addTombstone: (id: string, type: string) => void): Budget[] {
  const uniqueMap = new Map<string, Budget>();
  const keptBudgets: Budget[] = [];

  localBudgets.forEach((b) => {
    const key = b.categoryId || 'total';
    const existing = uniqueMap.get(key);
    if (existing) {
      if ((existing.updatedAt || 0) >= (b.updatedAt || 0)) {
        addTombstone(b.id, 'budgets');
      } else {
        addTombstone(existing.id, 'budgets');
        uniqueMap.set(key, b);
        const idx = keptBudgets.findIndex((x) => (x.categoryId || 'total') === key);
        if (idx !== -1) keptBudgets[idx] = b;
      }
    } else {
      uniqueMap.set(key, b);
      keptBudgets.push(b);
    }
  });

  return keptBudgets;
}

export function dedupTemplates(localTemplates: TransactionTemplate[], addTombstone: (id: string, type: string) => void): TransactionTemplate[] {
  const uniqueMap = new Map<string, TransactionTemplate>();
  const keptTemplates: TransactionTemplate[] = [];

  localTemplates.forEach((t) => {
    const key = `${t.name.trim()}_${t.type}`;
    const existing = uniqueMap.get(key);
    if (existing) {
      if ((existing.updatedAt || 0) >= (t.updatedAt || 0)) {
        addTombstone(t.id, 'templates');
      } else {
        addTombstone(existing.id, 'templates');
        uniqueMap.set(key, t);
        const idx = keptTemplates.findIndex((x) => x.name.trim() === t.name.trim() && x.type === t.type);
        if (idx !== -1) keptTemplates[idx] = t;
      }
    } else {
      uniqueMap.set(key, t);
      keptTemplates.push(t);
    }
  });

  return keptTemplates;
}

export function dedupGoals(localGoals: SavingGoal[], addTombstone: (id: string, type: string) => void): SavingGoal[] {
  const uniqueMap = new Map<string, SavingGoal>();
  const keptGoals: SavingGoal[] = [];

  localGoals.forEach((g) => {
    const key = g.name.trim();
    const existing = uniqueMap.get(key);
    if (existing) {
      if ((existing.updatedAt || 0) >= (g.updatedAt || 0)) {
        addTombstone(g.id, 'goals');
      } else {
        addTombstone(existing.id, 'goals');
        uniqueMap.set(key, g);
        const idx = keptGoals.findIndex((x) => x.name.trim() === g.name.trim());
        if (idx !== -1) keptGoals[idx] = g;
      }
    } else {
      uniqueMap.set(key, g);
      keptGoals.push(g);
    }
  });

  return keptGoals;
}

// ─── Main syncAllData ────────────────────────────────────────────

export function createSyncAllData(set: SetFn, get: GetFn) {
  return async function syncAllData() {
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

      const syncSingleCollectionMerge = async (collectionName: string, localItems: any[]) => {
        const dbCollectionRef = collection(db, `users/${userId}/${collectionName}`);
        const querySnapshot = await getDocs(dbCollectionRef);
        const remoteItemsMap = new Map<string, any>();
        querySnapshot.forEach((doc) => remoteItemsMap.set(doc.id, doc.data()));

        const updatedLocalItems = [...localItems];

        for (let i = 0; i < updatedLocalItems.length; i++) {
          const local = updatedLocalItems[i];
          const remote = remoteItemsMap.get(local.id);
          if (remote) {
            const localTime = local.updatedAt || 0;
            const remoteTime = remote.updatedAt || 0;
            if (remoteTime > localTime) updatedLocalItems[i] = remote;
          } else {
            const tombstone = tombstones[local.id];
            if (!tombstone && lastSyncTime > 0 && (local.updatedAt || 0) < lastSyncTime) {
              updatedLocalItems.splice(i, 1);
              i--;
            }
          }
        }

        const localItemsMap = new Map<string, any>(localItems.map((item) => [item.id, item]));
        for (const [remoteId, remote] of remoteItemsMap.entries()) {
          if (!localItemsMap.has(remoteId)) {
            const tombstone = tombstones[remoteId];
            if (tombstone) {
              if ((remote.updatedAt || 0) > tombstone.deletedAt) {
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
        goalsResult,
      ] = await Promise.all([
        syncSingleCollectionMerge('accounts', get().accounts),
        syncSingleCollectionMerge('categories', get().categories),
        syncSingleCollectionMerge('transactions', get().transactions),
        syncSingleCollectionMerge('budgets', get().budgets),
        syncSingleCollectionMerge('templates', get().templates),
        syncSingleCollectionMerge('goals', get().goals),
      ]);

      let mergedAccounts = accountsResult.updatedLocalItems;
      let mergedCategories = categoriesResult.updatedLocalItems;
      let mergedTransactions = transactionsResult.updatedLocalItems;
      let mergedBudgets = budgetsResult.updatedLocalItems;
      let mergedTemplates = templatesResult.updatedLocalItems;
      let mergedGoals = goalsResult.updatedLocalItems;

      const catDedup = dedupCategories(mergedCategories, mergedTransactions, mergedBudgets, mergedTemplates, get().addTombstone);
      mergedCategories = catDedup.categories;
      mergedTransactions = catDedup.transactions;
      mergedBudgets = catDedup.budgets;
      mergedTemplates = catDedup.templates;

      const accDedup = dedupAccounts(mergedAccounts, mergedTransactions, mergedTemplates, mergedGoals, get().addTombstone);
      mergedAccounts = accDedup.accounts;
      mergedTransactions = accDedup.transactions;
      mergedTemplates = accDedup.templates;
      mergedGoals = accDedup.goals;

      mergedBudgets = dedupBudgets(mergedBudgets, get().addTombstone);
      mergedTemplates = dedupTemplates(mergedTemplates, get().addTombstone);
      mergedGoals = dedupGoals(mergedGoals, get().addTombstone);

      set({
        accounts: mergedAccounts.sort((a: any, b: any) => (a.order || 0) - (b.order || 0)),
        categories: mergedCategories.sort((a: any, b: any) => (a.order || 0) - (b.order || 0)),
        transactions: mergedTransactions.sort((a: any, b: any) => {
          const timeA = a.date ? new Date(a.date).getTime() : 0;
          const timeB = b.date ? new Date(b.date).getTime() : 0;
          return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
        }),
        budgets: mergedBudgets,
        templates: mergedTemplates,
        goals: mergedGoals,
      });

      get().recalculateBalances(true);

      const uploadAndDeleteSingleCollection = async (
        collectionName: string,
        finalLocalItems: any[],
        remoteItemsMap: Map<string, any>
      ) => {
        const itemsToUpload: any[] = [];
        const itemsToDeleteFromRemote: string[] = [];

        finalLocalItems.forEach((local) => {
          const remote = remoteItemsMap.get(local.id);
          if (!remote) {
            itemsToUpload.push(local);
          } else if ((local.updatedAt || 0) > (remote.updatedAt || 0)) {
            itemsToUpload.push(local);
          }
        });

        const currentTombstones = get().tombstones;
        const localIds = new Set(finalLocalItems.map((item) => item.id));
        for (const [remoteId, remote] of remoteItemsMap.entries()) {
          if (!localIds.has(remoteId)) {
            const tombstone = currentTombstones[remoteId];
            if (tombstone || (lastSyncTime > 0 && (remote.updatedAt || 0) < lastSyncTime)) {
              itemsToDeleteFromRemote.push(remoteId);
            }
          }
        }

        if (itemsToUpload.length > 0 || itemsToDeleteFromRemote.length > 0) {
          const batches = [];
          let currentBatch = writeBatch(db);
          let count = 0;

          itemsToUpload.forEach((item) => {
            const ref = doc(db, `users/${userId}/${collectionName}`, item.id);
            const cleanItem = { ...item, userId };
            Object.keys(cleanItem).forEach((key) => {
              if (cleanItem[key] === undefined) delete cleanItem[key];
            });
            currentBatch.set(ref, cleanItem);
            count++;
            if (count === 400) { batches.push(currentBatch); currentBatch = writeBatch(db); count = 0; }
          });

          itemsToDeleteFromRemote.forEach((id) => {
            const ref = doc(db, `users/${userId}/${collectionName}`, id);
            currentBatch.delete(ref);
            count++;
            if (count === 400) { batches.push(currentBatch); currentBatch = writeBatch(db); count = 0; }
          });

          if (count > 0) batches.push(currentBatch);
          for (const batch of batches) await batch.commit();
        }
      };

      await Promise.all([
        uploadAndDeleteSingleCollection('accounts', get().accounts, accountsResult.remoteItemsMap),
        uploadAndDeleteSingleCollection('categories', get().categories, categoriesResult.remoteItemsMap),
        uploadAndDeleteSingleCollection('transactions', get().transactions, transactionsResult.remoteItemsMap),
        uploadAndDeleteSingleCollection('budgets', get().budgets, budgetsResult.remoteItemsMap),
        uploadAndDeleteSingleCollection('goals', get().goals, goalsResult.remoteItemsMap),
      ]);

      try {
        const keysDocRef = doc(db, `users/${userId}/config`, 'api_keys');
        const keysSnap = await getDoc(keysDocRef);
        const { deepseekApiKey, qwenApiKey } = get();
        if (keysSnap.exists()) {
          const keysData = keysSnap.data();
          const remoteDSKey = keysData.deepseekApiKey || '';
          const remoteQWKey = keysData.qwenApiKey || '';
          if (!deepseekApiKey && !qwenApiKey) {
            set({ deepseekApiKey: remoteDSKey, qwenApiKey: remoteQWKey });
          } else if (remoteDSKey !== deepseekApiKey || remoteQWKey !== qwenApiKey) {
            await setDoc(keysDocRef, { deepseekApiKey: deepseekApiKey || remoteDSKey, qwenApiKey: qwenApiKey || remoteQWKey, updatedAt: Date.now() }, { merge: true });
            set({ deepseekApiKey: deepseekApiKey || remoteDSKey, qwenApiKey: qwenApiKey || remoteQWKey });
          }
        } else if (deepseekApiKey || qwenApiKey) {
          await setDoc(keysDocRef, { deepseekApiKey, qwenApiKey, updatedAt: Date.now() });
        }
      } catch (e) {
        console.error('Failed to sync API keys during syncAllData', e);
      }

      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const activeTombstones = { ...get().tombstones };
      let tombstonesChanged = false;
      Object.entries(activeTombstones).forEach(([id, tomb]) => {
        if ((tomb as any).deletedAt < thirtyDaysAgo) {
          delete activeTombstones[id];
          tombstonesChanged = true;
        }
      });

      set({
        syncStatus: 'synced',
        syncSettings: { ...get().syncSettings, lastSyncTime: Date.now() },
        ...(tombstonesChanged ? { tombstones: activeTombstones } : {}),
      });

      setTimeout(() => {
        if (get().syncStatus === 'synced') set({ syncStatus: 'idle' });
      }, 3000);
    } catch (e) {
      console.error('Data bidirectional synchronization failed', e);
      set({ syncStatus: 'error' });
    }
  };
}
