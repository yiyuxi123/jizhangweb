import { auth, db } from '../firebase';
import { firestoreService } from '../services/firestoreService';
import { Account } from '../types';
import { writeBatch, doc } from 'firebase/firestore';

export function createRecalculateBalances(
  set: (partial: any) => void,
  get: () => any
) {
  return function recalculateBalances(skipUpload = false) {
    const { accounts, transactions, syncSettings } = get();
    let changed = false;

    const updatedAccounts = accounts.map((account: Account) => {
      const accountTxs = transactions.filter(
        (t: any) => t.fromAccountId === account.id || t.toAccountId === account.id
      );

      const netEffect = accountTxs.reduce((sum: number, t: any) => {
        if (t.type === 'expense' && t.fromAccountId === account.id) {
          return sum - t.amount;
        }
        if (t.type === 'income' && t.toAccountId === account.id) {
          return sum + t.amount;
        }
        if (t.type === 'transfer') {
          if (t.fromAccountId === account.id) return sum - t.amount;
          if (t.toAccountId === account.id) return sum + t.amount;
        }
        return sum;
      }, 0);

      let initialBalance = account.initialBalance;
      if (initialBalance === undefined) {
        initialBalance = Math.round((account.balance - netEffect) * 100) / 100;
      }

      const expectedBalance = Math.round((initialBalance + netEffect) * 100) / 100;
      if (account.balance !== expectedBalance || account.initialBalance === undefined) {
        console.log(
          `[recalculateBalances] ${account.name}: balance=${account.balance} expected=${expectedBalance} initialBalance=${initialBalance}→${Math.round((account.balance - netEffect) * 100) / 100} netEffect=${netEffect} — anchoring initialBalance, NOT changing balance`
        );
        changed = true;
        return {
          ...account,
          initialBalance: Math.round((account.balance - netEffect) * 100) / 100,
          updatedAt: Date.now(),
        };
      }
      return account;
    });

    if (changed) {
      set({ accounts: updatedAccounts });
      if (!skipUpload) {
        if (syncSettings.storageMode === 'cloud' && syncSettings.syncFrequency === 'realtime') {
          const userId = auth.currentUser?.uid;
          if (userId) {
            updatedAccounts.forEach(async (acc: Account) => {
              await firestoreService.updateDocument('accounts', acc.id, acc);
            });
          }
        }
      }
    }
  };
}

export function computeNetEffect(transactions: any[], accountId: string): number {
  return transactions
    .filter((t) => t.fromAccountId === accountId || t.toAccountId === accountId)
    .reduce((sum, t) => {
      if (t.type === 'expense' && t.fromAccountId === accountId) return sum - t.amount;
      if (t.type === 'income' && t.toAccountId === accountId) return sum + t.amount;
      if (t.type === 'transfer') {
        if (t.fromAccountId === accountId) return sum - t.amount;
        if (t.toAccountId === accountId) return sum + t.amount;
      }
      return sum;
    }, 0);
}
