import React, { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths } from 'date-fns';
import { motion } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { 
  Wallet, 
  TrendingDown, 
  TrendingUp, 
  ChevronRight, 
  Eye, 
  EyeOff, 
  PieChart as PieChartIcon, 
  BarChart3, 
  Loader2, 
  Check, 
  Cloud,
  Icons
} from '../utils/icons';
import EditBudgetModal from '../components/EditBudgetModal';
import TransactionDetailModal from '../components/TransactionDetailModal';
import { Transaction } from '../types';
import AiChatModal from '../components/AiChatModal';

export default function Dashboard({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { transactions, accounts, budgets, categories, showReimbursables, toggleShowReimbursables, syncStatus, syncAllData, isGuestMode } = useStore();
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);

  const now = new Date();
  const start = startOfMonth(now);
  const end = endOfMonth(now);

  const filteredTransactions = useMemo(() => {
    const isReimbursableTx = (t: Transaction) => {
      if (t.type === 'expense' && t.isReimbursable) return true;
      if (t.type === 'income') {
        const cat = categories.find(c => c.id === t.categoryId);
        if (cat?.name === '报销款') return true;
      }
      return false;
    };

    return transactions.filter(t => {
      if (!showReimbursables && isReimbursableTx(t)) return false;
      return true;
    });
  }, [transactions, showReimbursables, categories]);

  const currentMonthTransactions = useMemo(() => {
    return filteredTransactions.filter(t => {
      const d = new Date(t.date);
      return isWithinInterval(d, { start, end });
    });
  }, [filteredTransactions, start, end]);

  const { expense, income } = useMemo(() => {
    let exp = 0;
    let inc = 0;
    currentMonthTransactions.forEach(t => {
      const cat = categories.find(c => c.id === t.categoryId);
      if (t.type === 'expense' && !cat?.excludeFromStats) exp += t.amount;
      if (t.type === 'income' && !cat?.excludeFromStats) inc += t.amount;
    });
    return { expense: exp, income: inc };
  }, [currentMonthTransactions, categories]);

  const dailyAverage = useMemo(() => {
    const currentDay = now.getDate();
    return expense / currentDay;
  }, [expense, now]);

  const totalBalance = useMemo(() => accounts.reduce((sum, a) => sum + a.balance, 0), [accounts]);
  
  const { totalBudget, budgetRemaining, budgetPercent } = useMemo(() => {
    const total = budgets.find(b => !b.categoryId)?.amount || 0;
    const budgetExpense = currentMonthTransactions
      .filter(t => {
        if (t.type !== 'expense') return false;
        const cat = categories.find(c => c.id === t.categoryId);
        return !cat?.excludeFromBudget;
      })
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      totalBudget: total,
      budgetRemaining: total - budgetExpense,
      budgetPercent: total > 0 ? (budgetExpense / total) * 100 : 0
    };
  }, [budgets, currentMonthTransactions, categories]);

  const categoryBudgets = useMemo(() => {
    return budgets.filter(b => b.categoryId).map(b => {
      const category = categories.find(c => c.id === b.categoryId);
      const catExpense = currentMonthTransactions
        .filter(t => t.type === 'expense' && t.categoryId === b.categoryId)
        .reduce((sum, t) => sum + t.amount, 0);
      
      return {
        ...b,
        categoryName: category?.name || '未知',
        color: category?.color || '#9ca3af',
        expense: catExpense,
        remaining: b.amount - catExpense,
        percent: b.amount > 0 ? (catExpense / b.amount) * 100 : 0
      };
    }).sort((a, b) => b.percent - a.percent);
  }, [budgets, categories, currentMonthTransactions]);

  const reimbursableAmount = useMemo(() => {
    return transactions
      .filter(t => t.type === 'expense' && t.isReimbursable && !t.isReimbursed)
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  const expensesByCategory = useMemo(() => {
    const expenses = currentMonthTransactions.filter(t => t.type === 'expense');
    const grouped = expenses.reduce((acc, t) => {
      const catId = t.categoryId || 'unknown';
      if (!acc[catId]) {
        acc[catId] = 0;
      }
      acc[catId] += t.amount;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .map(([categoryId, amount]) => {
        const category = categories.find(c => c.id === categoryId);
        return {
          name: category?.name || '未知',
          amount: Number(amount),
          color: category?.color || '#9ca3af'
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [currentMonthTransactions, categories]);

  const monthlyTrendData = useMemo(() => {
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(now, i));
      const monthEnd = endOfMonth(subMonths(now, i));
      const monthStr = format(monthStart, 'MM月');
      
      let exp = 0;
      let inc = 0;
      
      filteredTransactions.forEach(t => {
        const d = new Date(t.date);
        if (isWithinInterval(d, { start: monthStart, end: monthEnd })) {
          if (t.type === 'expense') exp += t.amount;
          if (t.type === 'income') inc += t.amount;
        }
      });
      
      data.push({
        name: monthStr,
        支出: exp,
        收入: inc
      });
    }
    return data;
  }, [filteredTransactions, now]);

  const recentTransactions = useMemo(() => filteredTransactions.slice(0, 5), [filteredTransactions]);
  
  const renderSyncStatus = () => {
    if (isGuestMode) {
      return (
        <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 dark:text-gray-500 text-[10px] rounded-full font-bold border border-gray-200/50 flex items-center space-x-1 shrink-0">
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
          <span>本地模式</span>
        </span>
      );
    }

    switch (syncStatus) {
      case 'connecting':
        return (
          <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 text-[10px] rounded-full font-bold border border-gray-200/50 flex items-center space-x-1 shrink-0 animate-pulse">
            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping" />
            <span>连接中...</span>
          </span>
        );
      case 'syncing':
        return (
          <button 
            type="button"
            onClick={() => syncAllData()}
            className="px-2 py-0.5 bg-yellow-50 text-yellow-700 text-[10px] rounded-full font-bold border border-yellow-100 flex items-center space-x-1 shrink-0 shadow-sm"
          >
            <Icons.Loader2 size={10} className="animate-spin text-yellow-600" />
            <span>同步中...</span>
          </button>
        );
      case 'synced':
        return (
          <button 
            type="button"
            onClick={() => syncAllData()}
            className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] rounded-full font-bold border border-emerald-100 flex items-center space-x-1 shrink-0 shadow-sm transition-all hover:bg-emerald-100"
          >
            <Icons.Check size={10} className="text-emerald-600" />
            <span>已同步</span>
          </button>
        );
      case 'error':
        return (
          <button 
            type="button"
            onClick={() => syncAllData()}
            className="px-2 py-0.5 bg-red-50 text-red-700 text-[10px] rounded-full font-bold border border-red-100 flex items-center space-x-1 shrink-0 shadow-sm hover:bg-red-100"
            title="点击重试同步"
          >
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
            <span>未连接</span>
          </button>
        );
      default: // 'idle'
        return (
          <button 
            type="button"
            onClick={() => syncAllData()}
            className="px-2 py-0.5 bg-gray-50 dark:bg-gray-700 dark:bg-gray-900 text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-200 text-[10px] rounded-full font-medium border border-gray-200/50 flex items-center space-x-1 shrink-0 hover:bg-gray-100 dark:bg-gray-700/50 transition-colors"
            title="点击同步数据"
          >
            <Icons.Cloud size={10} className="text-gray-400" />
            <span>云端就绪</span>
          </button>
        );
    }
  };

  return (
    <div className="p-4 space-y-6 max-w-md mx-auto">
      {/* Header */}
      <header className="flex justify-between items-center pt-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">记账本</h1>
            {renderSyncStatus()}
          </div>
          <p className="text-sm text-gray-500">{format(now, 'yyyy年MM月')}</p>
        </div>
        <div className="flex items-center space-x-3">
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
          <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
            <Wallet size={20} />
          </div>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div 
          whileHover={{ y: -2, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)' }}
          className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-all"
        >
          <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400 mb-2">
            <TrendingDown size={16} className="text-red-500" />
            <span className="text-sm font-medium">本月支出</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">¥{expense.toFixed(2)}</p>
          <p className="text-xs text-gray-400 dark:text-gray-400 mt-1">日均 ¥{dailyAverage.toFixed(2)}</p>
        </motion.div>
        <motion.div 
          whileHover={{ y: -2, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)' }}
          className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-all"
        >
          <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400 mb-2">
            <TrendingUp size={16} className="text-emerald-500" />
            <span className="text-sm font-medium">本月收入</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">¥{income.toFixed(2)}</p>
        </motion.div>
      </div>

      {/* Reimbursable Banner */}
      {reimbursableAmount > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 p-4 rounded-2xl flex items-center justify-between"
        >
          <div className="flex items-center space-x-2 text-amber-700 dark:text-amber-300">
            <Icons.Receipt size={18} />
            <span className="text-sm font-medium">待报销金额</span>
          </div>
          <p className="text-lg font-bold text-amber-700 dark:text-amber-300">¥{reimbursableAmount.toFixed(2)}</p>
        </motion.div>
      )}

      {/* AI Assistant Banner */}
      <motion.div 
        whileHover={{ y: -2, boxShadow: '0 10px 25px -5px rgba(124, 58, 237, 0.15)' }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsAiChatOpen(true)}
        className="bg-gradient-to-r from-violet-600 to-indigo-600 p-5 rounded-3xl text-white cursor-pointer shadow-lg shadow-indigo-100/50 flex items-center justify-between"
      >
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md">
            <Icons.Sparkles size={22} className="text-yellow-300 animate-pulse" />
          </div>
          <div>
            <h4 className="font-bold text-sm">AI 智能财务分析助手</h4>
            <p className="text-xs text-indigo-100 mt-0.5">一键提问“分析我的本月收支和超支情况”</p>
          </div>
        </div>
        <Icons.ChevronRight size={20} className="text-indigo-200" />
      </motion.div>

      {/* Budget Progress */}
      <motion.div 
        whileHover={{ y: -2, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)' }}
        whileTap={{ scale: 0.98 }}
        className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 cursor-pointer transition-all"
        onClick={() => setIsBudgetModalOpen(true)}
      >
        <div className="flex justify-between items-end mb-2">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">剩余总预算</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">¥{budgetRemaining.toFixed(2)}</p>
          </div>
          <p className="text-sm text-gray-400 dark:text-gray-500">总预算 ¥{totalBudget}</p>
        </div>
        <div className="h-2 w-full bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden mt-4">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(budgetPercent, 100)}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={`h-full rounded-full ${budgetPercent > 90 ? 'bg-red-500' : 'bg-emerald-500'}`}
          />
        </div>
        
        {/* Category Budgets */}
        {categoryBudgets.length > 0 && (
          <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700 space-y-3">
            {categoryBudgets.map(cb => (
              <div key={cb.id}>
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cb.color }} />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{cb.categoryName}</span>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ¥{cb.expense.toFixed(0)} / ¥{cb.amount.toFixed(0)}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(cb.percent, 100)}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={`h-full rounded-full ${cb.percent > 90 ? 'bg-red-500' : ''}`}
                    style={{ backgroundColor: cb.percent > 90 ? undefined : cb.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Expenses Chart */}
      {expensesByCategory.length > 0 && (
        <motion.div 
          whileHover={{ y: -2, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)' }}
          className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-all"
        >
          <div className="flex items-center space-x-2 mb-4">
            <PieChartIcon size={18} className="text-indigo-500" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">支出分布</h2>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expensesByCategory}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="amount"
                >
                  {expensesByCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => `¥${value.toFixed(2)}`}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {expensesByCategory.slice(0, 3).map((item, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-gray-600 dark:text-gray-300">{item.name}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-gray-900 dark:text-gray-100">¥{item.amount.toFixed(2)}</span>
                  <span className="text-gray-400 dark:text-gray-500 text-xs w-8 text-right">
                    {((item.amount / expense) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Monthly Trend Chart */}
      {monthlyTrendData.length > 0 && (
        <motion.div 
          whileHover={{ y: -2, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)' }}
          className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-all"
        >
          <div className="flex items-center space-x-2 mb-4">
            <BarChart3 size={18} className="text-blue-500" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">收支趋势</h2>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrendData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <Tooltip 
                  cursor={{ fill: '#f9fafb' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => `¥${value.toFixed(2)}`}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="支出" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="收入" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* Recent Transactions */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">最近记录</h2>
          <button 
            onClick={() => onNavigate('transactions')}
            className="text-sm text-emerald-600 font-medium flex items-center"
          >
            查看全部 <ChevronRight size={16} />
          </button>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          {recentTransactions.length === 0 ? (
            <div className="p-8 text-center text-gray-400">暂无记录，快去记一笔吧！</div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {recentTransactions.map(t => {
                const category = categories.find(c => c.id === t.categoryId);
                const IconComponent = category ? (Icons as any)[category.icon] : Icons.HelpCircle;
                
                return (
                  <div 
                    key={t.id} 
                    className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30 dark:bg-gray-900 transition-colors cursor-pointer"
                    onClick={() => setSelectedTx(t)}
                  >
                    <div className="flex items-center space-x-4 flex-1 min-w-0">
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0"
                        style={{ backgroundColor: category?.color || '#9ca3af' }}
                      >
                        {IconComponent && <IconComponent size={20} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 dark:text-gray-100 flex items-center space-x-2">
                          <span>{category?.name || '未知'}</span>
                          {t.isReimbursable && (
                            <span className={`px-1.5 py-0.5 text-[10px] rounded-sm font-medium shrink-0 ${t.isReimbursed ? 'bg-gray-100 text-gray-500' : 'bg-amber-100 text-amber-700'}`}>
                              {t.isReimbursed ? '已报销' : '待报销'}
                            </span>
                          )}
                        </p>
                        <div className="mt-0.5 flex flex-col space-y-1">
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{format(new Date(t.date), 'MM-dd HH:mm')}</p>
                          {t.note && (
                            <p className="text-xs text-gray-600 dark:text-gray-300 truncate bg-gray-100/80 dark:bg-gray-800/80 px-1.5 py-0.5 rounded w-fit max-w-full">
                              {t.note}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={`font-bold shrink-0 ml-4 ${t.type === 'expense' ? 'text-gray-900 dark:text-gray-100' : t.type === 'income' ? 'text-emerald-500' : 'text-blue-500'}`}>
                      {t.type === 'expense' ? '-' : t.type === 'income' ? '+' : ''}¥{t.amount.toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {isBudgetModalOpen && <EditBudgetModal onClose={() => setIsBudgetModalOpen(false)} />}
      {selectedTx && <TransactionDetailModal transaction={selectedTx} onClose={() => setSelectedTx(null)} />}
      {isAiChatOpen && <AiChatModal onClose={() => setIsAiChatOpen(false)} />}
    </div>
  );
}
