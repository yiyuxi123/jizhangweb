export type TransactionType = 'expense' | 'income' | 'transfer';

export interface Category {
  id: string;
  name: string;
  type: 'expense' | 'income';
  icon: string;
  color: string;
  isFixed?: boolean;
  excludeFromBudget?: boolean;
  excludeFromStats?: boolean;
  order?: number;
  updatedAt?: number; // Last modification timestamp
}

export interface Account {
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'alipay' | 'wechat' | 'credit' | 'auto_deposit';
  balance: number;
  color: string;
  icon: string;
  isHidden?: boolean;
  autoDepositAmount?: number;
  autoDepositDay?: number;
  order?: number;
  fundType?: 'working' | 'investment' | 'unavailable';
  updatedAt?: number; // Last modification timestamp
}

export interface SyncSettings {
  storageMode: 'local' | 'cloud';
  syncFrequency: 'realtime' | 'daily';
  lastSyncTime: number;
}

export interface TransactionHistory {
  date: string;
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  date: string; // ISO string
  categoryId?: string; // For expense/income
  fromAccountId?: string; // For expense/transfer
  toAccountId?: string; // For income/transfer
  note: string;
  tags?: string[]; // Added tags
  isReimbursable?: boolean;
  isReimbursed?: boolean;
  reimbursedTxIds?: string[];
  reimbursedByTxId?: string;
  history?: TransactionHistory[];
  image?: string; // Base64 data URL of attached receipt image
  updatedAt?: number; // Last modification timestamp
}

export interface TransactionTemplate {
  id: string;
  name: string;
  type: TransactionType;
  amount?: number;
  categoryId?: string;
  fromAccountId?: string;
  toAccountId?: string;
  note?: string;
  tags?: string[];
  updatedAt?: number; // Last modification timestamp
}

export interface Budget {
  id: string;
  categoryId?: string; // If undefined, it's a total budget
  amount: number;
  period: 'monthly' | 'yearly';
  updatedAt?: number; // Last modification timestamp
}

export interface SavingGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string; // ISO string
  color: string;
  icon: string;
  accountId?: string;
  updatedAt?: number; // Last modification timestamp
}
