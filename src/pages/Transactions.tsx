import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { format, isSameMonth, parseISO } from 'date-fns';
import { Filter, Search, List, Calendar as CalendarIcon, Eye, EyeOff, Icons } from '../utils/icons';
import { motion, AnimatePresence } from 'motion/react';
import { useVirtualizer } from '@tanstack/react-virtual';
import TransactionDetailModal from '../components/TransactionDetailModal';
import TransactionCalendar from '../components/TransactionCalendar';
import { Transaction } from '../types';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export default function Transactions() {
  const { transactions, categories, accounts, showReimbursables, toggleShowReimbursables, syncError, setSyncError, dismissedAlertTypes, dismissAlertType } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income' | 'transfer'>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());

  // Sync error auto-dismiss state
  const [syncErrorDontShow, setSyncErrorDontShow] = useState(false);
  const [syncErrorCountdown, setSyncErrorCountdown] = useState(8);
  const syncErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncErrorCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const ALERT_SYNC_ERROR = 'sync_error';

  // Auto-dismiss sync error after 8 seconds
  useEffect(() => {
    if (syncError) {
      // Check if this type is permanently dismissed
      if (dismissedAlertTypes.includes(ALERT_SYNC_ERROR)) {
        setSyncError(null);
        return;
      }

      setSyncErrorCountdown(8);
      const countdownInterval = setInterval(() => {
        setSyncErrorCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      syncErrorCountdownRef.current = countdownInterval;

      syncErrorTimerRef.current = setTimeout(() => {
        handleSyncErrorDismiss();
      }, 8000);

      return () => {
        clearInterval(countdownInterval);
        if (syncErrorTimerRef.current) clearTimeout(syncErrorTimerRef.current);
      };
    }
  }, [syncError]);

  const handleSyncErrorDismiss = () => {
    if (syncErrorDontShow) {
      dismissAlertType(ALERT_SYNC_ERROR);
    }
    if (syncErrorTimerRef.current) clearTimeout(syncErrorTimerRef.current);
    if (syncErrorCountdownRef.current) clearInterval(syncErrorCountdownRef.current);
    setSyncError(null);
    setSyncErrorDontShow(false);
  };

  // Batch Operations State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { deleteTransaction } = useStore();

  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    setShowBatchDeleteConfirm(true);
  };

  const confirmBatchDelete = () => {
    selectedIds.forEach(id => deleteTransaction(id));
    setSelectedIds(new Set());
    setIsSelectionMode(false);
    setShowBatchDeleteConfirm(false);
  };

  // Get unique months for filter
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    transactions.forEach(t => {
      months.add(format(parseISO(t.date), 'yyyy-MM'));
    });
    return Array.from(months).sort().reverse(); // Newest first
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const isReimbursableTx = (t: Transaction) => {
      if (t.type === 'expense' && t.isReimbursable) return true;
      if (t.type === 'income') {
        const cat = categories.find(c => c.id === t.categoryId);
        if (cat?.name === '报销款') return true;
      }
      return false;
    };

    const lowerSearchTerm = searchTerm.toLowerCase();

    return transactions.filter(t => {
      if (!showReimbursables && isReimbursableTx(t)) return false;
      
      const noteStr = t.note || '';
      const catName = categories.find(c => c.id === t.categoryId)?.name || '';
      
      const matchesSearch = noteStr.toLowerCase().includes(lowerSearchTerm) || 
                            catName.toLowerCase().includes(lowerSearchTerm) ||
                            (t.tags && t.tags.some(tag => tag.toLowerCase().includes(lowerSearchTerm))) ||
                            t.amount.toString().includes(lowerSearchTerm);
      const matchesType = filterType === 'all' || t.type === filterType;
      const matchesMonth = selectedMonth === 'all' || format(parseISO(t.date), 'yyyy-MM') === selectedMonth;
      const matchesAccount = selectedAccount === 'all' || t.fromAccountId === selectedAccount || t.toAccountId === selectedAccount;
      
      return matchesSearch && matchesType && matchesMonth && matchesAccount;
    });
  }, [transactions, categories, showReimbursables, searchTerm, filterType, selectedMonth, selectedAccount]);

  const escapeCSV = (str: string | undefined) => `"${String(str || '').replace(/"/g, '""')}"`;

  const handleExportFiltered = async () => {
    const headers = ['交易ID', '类型', '金额', '日期', '分类', '付款账户', '收款账户', '备注', '标签'];
    const rows = filteredTransactions.map(t => {
      const category = categories.find(c => c.id === t.categoryId)?.name || '';
      const fromAcc = accounts.find(a => a.id === t.fromAccountId)?.name || '';
      const toAcc = accounts.find(a => a.id === t.toAccountId)?.name || '';
      return [
        escapeCSV(t.id),
        escapeCSV(t.type === 'expense' ? '支出' : t.type === 'income' ? '收入' : '转账'),
        escapeCSV(t.amount.toString()),
        escapeCSV(format(parseISO(t.date), 'yyyy-MM-dd HH:mm:ss')),
        escapeCSV(category),
        escapeCSV(fromAcc),
        escapeCSV(toAcc),
        escapeCSV(t.note),
        escapeCSV(t.tags ? t.tags.join(', ') : '')
      ];
    });
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const content = "\uFEFF" + csvContent;
    const filename = `transactions_filtered_${format(new Date(), 'yyyyMMdd')}.csv`;

    if (Capacitor.isNativePlatform()) {
      try {
        const result = await Filesystem.writeFile({
          path: filename,
          data: content,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
        });
        
        await Share.share({
          title: '导出筛选结果',
          text: '这是您的记账数据导出文件',
          url: result.uri,
          dialogTitle: '分享或保存CSV文件',
        });
      } catch (e) {
        console.error('Export failed', e);
        alert('导出失败: ' + (e as Error).message + '\n文件可能已保存到Documents文件夹。');
      }
    } else {
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Group by month
  const grouped = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => {
      const month = format(parseISO(t.date), 'yyyy-MM');
      if (!acc[month]) acc[month] = [];
      acc[month].push(t);
      return acc;
    }, {} as Record<string, Transaction[]>);
  }, [filteredTransactions]);

  const toggleMonthCollapse = (month: string) => {
    const newCollapsed = new Set(collapsedMonths);
    if (newCollapsed.has(month)) {
      newCollapsed.delete(month);
    } else {
      newCollapsed.add(month);
    }
    setCollapsedMonths(newCollapsed);
  };

  return (
    <div className="p-4 space-y-6 max-w-md mx-auto">
      {/* Sync Error Banner */}
      {syncError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm bg-red-50 border border-red-200 text-red-800 rounded-2xl shadow-lg p-4 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-start space-x-3 mb-3">
            <Icons.AlertCircle size={20} className="shrink-0 mt-0.5 text-red-500" />
            <p className="text-sm font-medium flex-1 leading-relaxed">{syncError}</p>
            <button
              onClick={handleSyncErrorDismiss}
              className="shrink-0 p-1 text-red-400 hover:text-red-600 rounded-full hover:bg-red-100 transition-colors"
            >
              <Icons.X size={16} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={syncErrorDontShow}
                onChange={(e) => setSyncErrorDontShow(e.target.checked)}
                className="w-3.5 h-3.5 text-emerald-500 border-gray-300 rounded focus:ring-emerald-500"
              />
              <span className="text-xs text-red-600">不再显示同步错误</span>
            </label>
            <span className="text-xs text-red-400">
              {syncErrorCountdown > 0 ? `${syncErrorCountdown}秒后自动关闭` : ''}
            </span>
          </div>
        </div>
      )}
      {/* Header */}
      <header className="sticky top-0 bg-gray-50/80 backdrop-blur-md z-10 pt-4 pb-2">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900">账单明细</h1>
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => {
                setIsSelectionMode(!isSelectionMode);
                if (isSelectionMode) setSelectedIds(new Set());
              }}
              className={`p-1.5 rounded-lg transition-colors ${isSelectionMode ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}
              title={isSelectionMode ? "取消批量操作" : "批量操作"}
            >
              <Icons.CheckSquare size={18} />
            </button>
            <div className="flex bg-gray-200 p-1 rounded-xl">
              <button 
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <List size={18} />
              </button>
              <button 
                onClick={() => setViewMode('calendar')}
                className={`p-1.5 rounded-lg transition-colors ${viewMode === 'calendar' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <CalendarIcon size={18} />
              </button>
            </div>
          </div>
        </div>
        
        {/* Search & Filter */}
        <div className="flex flex-col space-y-2">
          <div className="flex space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="搜索备注、分类、标签或金额..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
              />
            </div>
          </div>
          <div className="flex space-x-2">
            <div className="relative flex-1">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full appearance-none pl-3 pr-8 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm font-medium"
              >
                <option value="all">全部月份</option>
                {availableMonths.map(month => (
                  <option key={month} value={month}>
                    {format(parseISO(`${month}-01`), 'yyyy年MM月')}
                  </option>
                ))}
              </select>
              <Filter size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
            </div>
            <div className="relative flex-1">
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full appearance-none pl-3 pr-8 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm font-medium"
              >
                <option value="all">全部账户</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
              <Icons.CreditCard size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Type Tabs & Actions */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mt-4 gap-2">
          <div className="flex space-x-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide flex-1">
            {(['all', 'expense', 'income', 'transfer'] as const).map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  filterType === type 
                    ? 'bg-gray-900 text-white shadow-sm' 
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {type === 'all' ? '全部' : type === 'expense' ? '支出' : type === 'income' ? '收入' : '转账'}
              </button>
            ))}
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <button 
              onClick={toggleShowReimbursables}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                showReimbursables 
                  ? 'bg-emerald-100 text-emerald-700' 
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {showReimbursables ? <Eye size={14} /> : <EyeOff size={14} />}
              <span>{showReimbursables ? '含报销' : '不含报销'}</span>
            </button>
            <button 
              onClick={handleExportFiltered}
              className="p-1.5 rounded-lg transition-colors bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-200 hover:bg-gray-50"
              title="导出当前筛选结果"
            >
              <Icons.Download size={16} />
            </button>
          </div>
        </div>
      </header>

      {viewMode === 'calendar' ? (
        <TransactionCalendar />
      ) : (
        /* Transactions List — virtual scrolling ready */
        <div className="space-y-6" style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
          {Object.entries(grouped).length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search size={24} className="text-gray-300" />
              </div>
              <p>没有找到相关记录</p>
            </div>
          ) : (
            (Object.entries(grouped) as [string, Transaction[]][]).map(([month, monthTransactions]) => {
              const monthExpense = monthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
              const monthIncome = monthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);

              return (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={month} 
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
                >
                  {/* Month Header */}
                  <div 
                    className="bg-gray-50 dark:bg-gray-900 px-4 py-3 flex justify-between items-center border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:bg-gray-700/50 transition-colors"
                    onClick={() => toggleMonthCollapse(month)}
                  >
                    <div className="flex items-center space-x-2">
                      <Icons.ChevronDown 
                        size={16} 
                        className={`text-gray-400 transition-transform ${collapsedMonths.has(month) ? '-rotate-90' : ''}`} 
                      />
                      <h3 className="font-bold text-gray-900">{format(parseISO(`${month}-01`), 'yyyy年MM月')}</h3>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 flex space-x-3">
                      <span>支 ¥{monthExpense.toFixed(2)}</span>
                      <span>收 ¥{monthIncome.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Items */}
                  <AnimatePresence>
                    {!collapsedMonths.has(month) && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="divide-y divide-gray-50 dark:divide-gray-700/50 overflow-hidden"
                      >
                        {monthTransactions.map(t => {
                          const category = categories.find(c => c.id === t.categoryId);
                          const IconComponent = category ? (Icons as any)[category.icon] : Icons.ArrowRightLeft;
                          const fromAccount = accounts.find(a => a.id === t.fromAccountId);
                          const toAccount = accounts.find(a => a.id === t.toAccountId);
                          
                          return (
                        <motion.div 
                          whileHover={{ backgroundColor: '#f9fafb' }}
                          whileTap={isSelectionMode ? undefined : { scale: 0.98 }}
                          key={t.id} 
                          className={`p-4 flex items-center justify-between cursor-pointer ${isSelectionMode && selectedIds.has(t.id) ? 'bg-emerald-50/50' : ''}`}
                          onClick={() => {
                            if (isSelectionMode) {
                              toggleSelection(t.id);
                            } else {
                              setSelectedTx(t);
                            }
                          }}
                        >
                          <div className="flex items-center space-x-4 flex-1 min-w-0">
                            {isSelectionMode && (
                              <div className="shrink-0 mr-2">
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedIds.has(t.id) ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 bg-white'}`}>
                                  {selectedIds.has(t.id) && <Icons.Check size={14} />}
                                </div>
                              </div>
                            )}
                            <div 
                              className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0"
                              style={{ backgroundColor: t.type === 'transfer' ? '#6b7280' : category?.color || '#9ca3af' }}
                            >
                              {IconComponent && <IconComponent size={20} />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-gray-900 dark:text-gray-100 flex items-center space-x-2">
                                <span>{t.type === 'transfer' ? '转账' : category?.name || '未知'}</span>
                                {t.isReimbursable && (
                                  <span className={`px-1.5 py-0.5 text-[10px] rounded-sm font-medium shrink-0 ${t.isReimbursed ? 'bg-gray-100 text-gray-500' : 'bg-amber-100 text-amber-700'}`}>
                                    {t.isReimbursed ? '已报销' : '待报销'}
                                  </span>
                                )}
                                {category?.isFixed && t.type === 'expense' && (
                                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded-sm font-medium shrink-0">固定</span>
                                )}
                              </p>
                              <div className="mt-0.5 flex flex-col space-y-1">
                                <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 truncate">
                                  {format(parseISO(t.date), 'MM-dd HH:mm')}
                                  {t.type === 'transfer' && fromAccount && toAccount && ` | ${fromAccount.name} -> ${toAccount.name}`}
                                  {t.type !== 'transfer' && fromAccount && ` | ${fromAccount.name}`}
                                  {t.type !== 'transfer' && toAccount && ` | ${toAccount.name}`}
                                </p>
                                {t.note && (
                                  <p className="text-xs text-gray-600 dark:text-gray-300 truncate bg-gray-100/80 px-1.5 py-0.5 rounded w-fit max-w-full">
                                    {t.note}
                                  </p>
                                )}
                                {t.tags && t.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {t.tags.map((tag, i) => (
                                      <span key={i} className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">
                                        #{tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className={`font-bold shrink-0 ml-4 ${t.type === 'expense' ? 'text-gray-900' : t.type === 'income' ? 'text-emerald-500' : 'text-blue-500'}`}>
                            {t.type === 'expense' ? '-' : t.type === 'income' ? '+' : ''}¥{t.amount.toFixed(2)}
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                  )}
                  </AnimatePresence>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {selectedTx && <TransactionDetailModal transaction={selectedTx} onClose={() => setSelectedTx(null)} />}

      {/* Batch Operations Floating Bar */}
      <AnimatePresence>
        {isSelectionMode && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-24 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-md bg-gray-900 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between z-40"
          >
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => {
                  if (selectedIds.size === filteredTransactions.length) {
                    setSelectedIds(new Set());
                  } else {
                    setSelectedIds(new Set(filteredTransactions.map(t => t.id)));
                  }
                }}
                className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
              >
                {selectedIds.size === filteredTransactions.length ? '取消全选' : '全选'}
              </button>
              <span className="text-sm">已选 {selectedIds.size} 项</span>
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => {
                  setIsSelectionMode(false);
                  setSelectedIds(new Set());
                }}
                className="px-3 py-1.5 text-sm font-medium text-gray-300 hover:text-white transition-colors"
              >
                取消
              </button>
              <button 
                onClick={handleBatchDelete}
                disabled={selectedIds.size === 0}
                className={`px-4 py-1.5 rounded-xl text-sm font-bold transition-colors ${selectedIds.size > 0 ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
              >
                删除
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Batch Delete Confirm Modal */}
      <AnimatePresence>
        {showBatchDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            >
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">确认删除</h3>
              <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-6">确定要删除选中的 {selectedIds.size} 条记录吗？此操作不可恢复。</p>
              <div className="flex space-x-3">
                <button 
                  onClick={() => setShowBatchDeleteConfirm(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={confirmBatchDelete}
                  className="flex-1 py-3 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 transition-colors"
                >
                  确定删除
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
