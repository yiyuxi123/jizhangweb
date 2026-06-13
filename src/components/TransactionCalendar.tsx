import React, { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths, 
  parseISO,
  isToday
} from 'date-fns';
import { ChevronLeft, ChevronRight, Icons } from '../utils/icons';
import TransactionDetailModal from './TransactionDetailModal';
import { Transaction } from '../types';

export default function TransactionCalendar() {
  const { transactions, categories, accounts, showReimbursables } = useStore();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const isReimbursableTx = (t: Transaction) => {
    if (t.type === 'expense' && t.isReimbursable) return true;
    if (t.type === 'income') {
      const cat = categories.find(c => c.id === t.categoryId);
      if (cat?.name === '报销款') return true;
    }
    return false;
  };

  const filteredTransactions = transactions.filter(t => {
    if (!showReimbursables && isReimbursableTx(t)) return false;
    return true;
  });

  const daysInMonth = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
  });

  const { maxNetIncome, maxNetExpense } = useMemo(() => {
    let maxInc = 0;
    let maxExp = 0;
    daysInMonth.forEach(day => {
      if (isSameMonth(day, currentMonth)) {
        const dayTransactions = filteredTransactions.filter(t => isSameDay(parseISO(t.date), day));
        const exp = dayTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        const inc = dayTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const net = inc - exp;
        if (net > maxInc) maxInc = net;
        if (net < -maxExp) maxExp = Math.abs(net);
      }
    });
    return { maxNetIncome: maxInc, maxNetExpense: maxExp };
  }, [daysInMonth, filteredTransactions, currentMonth]);

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  // Get transactions for the selected day
  const selectedDayTransactions = filteredTransactions.filter(t => 
    isSameDay(parseISO(t.date), selectedDate)
  );

  const selectedDayExpense = selectedDayTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
    
  const selectedDayIncome = selectedDayTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-6">
      {/* Calendar Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronLeft size={20} className="text-gray-600" />
          </button>
          <h2 className="text-lg font-bold text-gray-900">
            {format(currentMonth, 'yyyy年MM月')}
          </h2>
          <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronRight size={20} className="text-gray-600" />
          </button>
        </div>

        {/* Days of Week */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['一', '二', '三', '四', '五', '六', '日'].map(day => (
            <div key={day} className="text-center text-xs font-medium text-gray-400 py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {daysInMonth.map((day, idx) => {
            const dayTransactions = filteredTransactions.filter(t => isSameDay(parseISO(t.date), day));
            const expense = dayTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
            const income = dayTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
            
            const isSelected = isSameDay(day, selectedDate);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isDayToday = isToday(day);

            let customStyle = {};
            let bgClass = '';

            if (isSelected) {
              bgClass = 'bg-gray-900 text-white shadow-md ring-2 ring-gray-900 ring-offset-1';
            } else if (!isCurrentMonth) {
              bgClass = 'opacity-40 bg-gray-50/50';
            } else {
              const net = income - expense;
              if (net > 0) {
                const intensity = maxNetIncome > 0 ? Math.max(0.05, net / maxNetIncome) : 0;
                customStyle = { backgroundColor: `rgba(16, 185, 129, ${intensity * 0.3})` }; // Emerald
                bgClass = 'hover:brightness-95';
              } else if (net < 0) {
                const intensity = maxNetExpense > 0 ? Math.max(0.05, Math.abs(net) / maxNetExpense) : 0;
                customStyle = { backgroundColor: `rgba(239, 68, 68, ${intensity * 0.3})` }; // Red
                bgClass = 'hover:brightness-95';
              } else if (expense > 0 || income > 0) {
                customStyle = { backgroundColor: `rgba(156, 163, 175, 0.15)` }; // Gray for net zero but active
                bgClass = 'hover:brightness-95';
              } else {
                bgClass = 'bg-white hover:bg-gray-50';
              }
            }

            return (
              <button
                key={idx}
                onClick={() => setSelectedDate(day)}
                style={customStyle}
                className={`flex flex-col items-center p-1 rounded-xl min-h-[60px] transition-all ${bgClass}`}
              >
                <span className={`text-sm font-medium mb-1 ${
                  isDayToday && !isSelected ? 'text-emerald-500 font-bold' : ''
                }`}>
                  {format(day, 'd')}
                </span>
                
                <div className="flex flex-col items-center w-full space-y-0.5 mt-auto">
                  {income > 0 && (
                    <span className={`text-[9px] font-semibold truncate w-full text-center ${isSelected ? 'text-emerald-300' : 'text-emerald-600'}`}>
                      +{income > 999 ? '999+' : income.toFixed(0)}
                    </span>
                  )}
                  {expense > 0 && (
                    <span className={`text-[9px] font-semibold truncate w-full text-center ${isSelected ? 'text-gray-300' : 'text-red-500'}`}>
                      -{expense > 999 ? '999+' : expense.toFixed(0)}
                    </span>
                  )}
                  {expense === 0 && income === 0 && (
                    <span className="text-[9px] opacity-0">-</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Transactions */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 flex justify-between items-center border-b border-gray-100">
          <h3 className="font-bold text-gray-900">
            {format(selectedDate, 'MM月dd日')} {isToday(selectedDate) && <span className="text-xs font-normal text-emerald-500 ml-1">今天</span>}
          </h3>
          <div className="text-xs text-gray-500 flex space-x-3">
            <span>支 {`¥${selectedDayExpense.toFixed(2)}`}</span>
            <span>收 {`¥${selectedDayIncome.toFixed(2)}`}</span>
          </div>
        </div>

        <div className="divide-y divide-gray-50">
          {selectedDayTransactions.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              这一天没有记账记录
            </div>
          ) : (
            selectedDayTransactions.map(t => {
              const category = categories.find(c => c.id === t.categoryId);
              const IconComponent = category ? (Icons as any)[category.icon] : Icons.ArrowRightLeft;
              const fromAccount = accounts.find(a => a.id === t.fromAccountId);
              const toAccount = accounts.find(a => a.id === t.toAccountId);
              
              return (
                <div 
                  key={t.id} 
                  className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => setSelectedTx(t)}
                >
                  <div className="flex items-center space-x-4 flex-1 min-w-0">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0"
                      style={{ backgroundColor: t.type === 'transfer' ? '#6b7280' : category?.color || '#9ca3af' }}
                    >
                      {IconComponent && <IconComponent size={20} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 flex items-center space-x-2">
                        <span>{t.type === 'transfer' ? '转账' : category?.name || '未知'}</span>
                        {t.isReimbursable && (
                          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] rounded-sm font-medium shrink-0">可报销</span>
                        )}
                      </p>
                      <div className="mt-0.5 flex flex-col space-y-1">
                        <p className="text-xs text-gray-500 truncate">
                          {format(parseISO(t.date), 'HH:mm')}
                          {t.type === 'transfer' && fromAccount && toAccount && ` | ${fromAccount.name} -> ${toAccount.name}`}
                          {t.type !== 'transfer' && fromAccount && ` | ${fromAccount.name}`}
                          {t.type !== 'transfer' && toAccount && ` | ${toAccount.name}`}
                        </p>
                        {t.note && (
                          <p className="text-xs text-gray-600 truncate bg-gray-100/80 px-1.5 py-0.5 rounded w-fit max-w-full">
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
                    {t.type === 'expense' ? '-' : t.type === 'income' ? '+' : ''}{`¥${t.amount.toFixed(2)}`}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {selectedTx && <TransactionDetailModal transaction={selectedTx} onClose={() => setSelectedTx(null)} />}
    </div>
  );
}
