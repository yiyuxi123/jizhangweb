import React, { useState } from 'react';
import { X, Trash2, Calendar, Tag, CreditCard, AlignLeft, ArrowRight, Edit2, History, Copy, Icons } from '../utils/icons';
import { useStore } from '../store/useStore';
import { Transaction } from '../types';
import { format, parseISO } from 'date-fns';
import AddTransactionModal from './AddTransactionModal';

export default function TransactionDetailModal({ transaction, onClose }: { transaction: Transaction | null, onClose: () => void }) {
  const { deleteTransaction, categories, accounts } = useStore();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

  if (!transaction) return null;

  const category = categories.find(c => c.id === transaction.categoryId);
  const fromAccount = accounts.find(a => a.id === transaction.fromAccountId);
  const toAccount = accounts.find(a => a.id === transaction.toAccountId);
  const IconComponent = category ? (Icons as any)[category.icon] : Icons.ArrowRightLeft;

  const handleDelete = () => {
    deleteTransaction(transaction.id);
    onClose();
  };

  const typeLabel = transaction.type === 'expense' ? '支出' : transaction.type === 'income' ? '收入' : '转账';
  const typeColor = transaction.type === 'expense' ? 'text-gray-900' : transaction.type === 'income' ? 'text-emerald-500' : 'text-blue-500';
  const sign = transaction.type === 'expense' ? '-' : transaction.type === 'income' ? '+' : '';

  const fieldNameMap: Record<string, string> = {
    amount: '金额',
    categoryId: '分类',
    fromAccountId: '付款账户',
    toAccountId: '收款账户',
    note: '备注',
    date: '日期',
    type: '类型',
    isReimbursable: '可报销'
  };

  const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || '已删除分类';
  const getAccountName = (id: string) => accounts.find(a => a.id === id)?.name || '已删除账户';

  const formatValue = (field: string, value: any) => {
    if (value === undefined || value === null || value === '') return '无';
    if (field === 'categoryId') return getCategoryName(String(value));
    if (field === 'fromAccountId' || field === 'toAccountId') return getAccountName(String(value));
    if (field === 'date') return format(parseISO(String(value)), 'yyyy-MM-dd HH:mm');
    if (field === 'isReimbursable') return value ? '是' : '否';
    if (field === 'type') return value === 'expense' ? '支出' : value === 'income' ? '收入' : '转账';
    return String(value);
  };

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/40 backdrop-blur-sm transition-opacity">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-10 duration-300 max-h-[90vh] overflow-y-auto">
        
        {/* Top decorative bar */}
        <div className={`h-3 w-full ${transaction.type === 'expense' ? 'bg-gray-800' : transaction.type === 'income' ? 'bg-emerald-500' : 'bg-blue-500'}`} />

        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">账单详情</h2>
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => {
                  const { addTemplate } = useStore.getState();
                  addTemplate({
                    name: `${transaction.type === 'transfer' ? '转账' : category?.name || '未知'}模板`,
                    type: transaction.type,
                    amount: Math.round(transaction.amount * 100) / 100,
                    categoryId: transaction.categoryId,
                    fromAccountId: transaction.fromAccountId,
                    toAccountId: transaction.toAccountId,
                    note: transaction.note,
                    tags: transaction.tags
                  });
                  alert('已保存为快捷记账模板');
                }} 
                className="p-2 text-gray-400 hover:text-emerald-600 rounded-full hover:bg-emerald-50 transition-colors" 
                title="保存为模板"
              >
                <Icons.BookmarkPlus size={20} />
              </button>
              <button onClick={() => setIsDuplicateModalOpen(true)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors" title="复制记录">
                <Copy size={20} />
              </button>
              <button onClick={() => setIsEditModalOpen(true)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors" title="编辑记录">
                <Edit2 size={20} />
              </button>
              <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                <X size={24} />
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center mb-8">
            <div 
              className="w-20 h-20 rounded-full flex items-center justify-center text-white mb-4 shadow-inner ring-4 ring-gray-50"
              style={{ backgroundColor: transaction.type === 'transfer' ? '#6b7280' : category?.color || '#9ca3af' }}
            >
              {IconComponent && <IconComponent size={36} strokeWidth={1.5} />}
            </div>
            <p className="text-gray-500 font-medium mb-2 flex items-center space-x-1">
              <Tag size={14} />
              <span>{transaction.type === 'transfer' ? '转账' : category?.name || '未知分类'}</span>
              {transaction.isReimbursable && (
                <span className={`ml-2 px-1.5 py-0.5 text-[10px] rounded-sm font-medium ${transaction.isReimbursed ? 'bg-gray-100 text-gray-500' : 'bg-amber-100 text-amber-700'}`}>
                  {transaction.isReimbursed ? '已报销' : '待报销'}
                </span>
              )}
              {category?.isFixed && transaction.type === 'expense' && (
                <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded-sm font-medium">固定</span>
              )}
            </p>
            <h3 className={`text-5xl font-bold tracking-tight ${typeColor}`}>
              {sign}¥{transaction.amount.toFixed(2)}
            </h3>
          </div>

          <div className="bg-gray-50 rounded-2xl p-5 space-y-4 mb-8 border border-gray-100">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2 text-gray-500">
                <Calendar size={18} />
                <span className="text-sm">记录时间</span>
              </div>
              <span className="text-gray-900 font-medium">{format(parseISO(transaction.date), 'yyyy-MM-dd HH:mm')}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2 text-gray-500">
                <Tag size={18} />
                <span className="text-sm">交易类型</span>
              </div>
              <span className="text-gray-900 font-medium">{typeLabel}</span>
            </div>

            {transaction.type === 'transfer' ? (
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2 text-gray-500">
                  <CreditCard size={18} />
                  <span className="text-sm">转账路径</span>
                </div>
                <div className="flex items-center space-x-2 text-gray-900 font-medium">
                  <span>{fromAccount?.name || '-'}</span>
                  <ArrowRight size={14} className="text-gray-400" />
                  <span>{toAccount?.name || '-'}</span>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2 text-gray-500">
                  <CreditCard size={18} />
                  <span className="text-sm">{transaction.type === 'expense' ? '付款账户' : '收款账户'}</span>
                </div>
                <span className="text-gray-900 font-medium">{transaction.type === 'expense' ? fromAccount?.name : toAccount?.name || '-'}</span>
              </div>
            )}

            {transaction.note && (
              <div className="pt-3 mt-3 border-t border-gray-200/60">
                <div className="flex items-center space-x-2 text-gray-500 mb-2">
                  <AlignLeft size={18} />
                  <span className="text-sm">备注</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-gray-100 text-gray-900 text-sm leading-relaxed break-words shadow-sm">
                  {transaction.note}
                </div>
              </div>
            )}

            {transaction.image && (
              <div className="pt-3 mt-3 border-t border-gray-200/60">
                <div className="flex items-center space-x-2 text-gray-500 mb-2">
                  <Icons.Image size={18} />
                  <span className="text-sm">关联单据/凭证图片</span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-gray-100 shadow-sm flex items-center justify-center overflow-hidden max-h-60">
                  <img 
                    src={transaction.image} 
                    alt="单据凭证" 
                    className="max-w-full max-h-56 object-contain rounded-lg cursor-zoom-in"
                    onClick={() => {
                      const w = window.open();
                      w?.document.write(`<img src="${transaction.image}" style="max-width:100%; max-height:100%; display:block; margin:auto;" />`);
                    }}
                  />
                </div>
              </div>
            )}

            {transaction.tags && transaction.tags.length > 0 && (
              <div className="pt-3 mt-3 border-t border-gray-200/60">
                <div className="flex items-center space-x-2 text-gray-500 mb-2">
                  <Tag size={18} />
                  <span className="text-sm">标签</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {transaction.tags.map((tag, index) => (
                    <span key={index} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-md">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

          </div>

          {transaction.history && transaction.history.length > 0 && (
            <div className="mb-8">
              <button 
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center space-x-2 text-gray-500 hover:text-gray-700 text-sm font-medium mb-3"
              >
                <History size={16} />
                <span>修改历史 ({transaction.history.length})</span>
              </button>
              {showHistory && (
                <div className="space-y-3">
                  {transaction.history.map((h, i) => (
                    <div key={i} className="bg-gray-50 p-3 rounded-lg text-xs border border-gray-100">
                      <div className="text-gray-400 mb-1">{format(parseISO(h.date), 'yyyy-MM-dd HH:mm')}</div>
                      {h.changes.map((c, j) => (
                        <div key={j} className="text-gray-600">
                          <span className="font-medium text-gray-700">{fieldNameMap[c.field] || c.field}: </span>
                          <span className="line-through text-gray-400 mr-1">{formatValue(c.field, c.oldValue)}</span>
                          <ArrowRight size={10} className="inline mx-1" />
                          <span className="text-emerald-600">{formatValue(c.field, c.newValue)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {showConfirm ? (
            <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
              <p className="text-center text-red-500 font-medium mb-2 text-sm">删除后将退回账户余额，确定删除吗？</p>
              <div className="flex space-x-3">
                <button onClick={() => setShowConfirm(false)} className="flex-1 py-3.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">
                  取消
                </button>
                <button onClick={handleDelete} className="flex-1 py-3.5 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors shadow-lg shadow-red-500/30">
                  确认删除
                </button>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => setShowConfirm(true)}
              className="w-full py-4 bg-white border-2 border-red-100 text-red-500 hover:bg-red-50 font-bold rounded-xl transition-colors flex items-center justify-center space-x-2"
            >
              <Trash2 size={20} />
              <span>删除记录</span>
            </button>
          )}
        </div>
      </div>
    </div>
    {isEditModalOpen && (
      <AddTransactionModal 
        isOpen={isEditModalOpen} 
        onClose={() => {
          setIsEditModalOpen(false);
          onClose(); // Close detail modal after editing
        }} 
        initialTransaction={transaction}
      />
    )}
    {isDuplicateModalOpen && (
      <AddTransactionModal 
        isOpen={isDuplicateModalOpen} 
        onClose={() => {
          setIsDuplicateModalOpen(false);
          onClose(); // Close detail modal after duplicating
        }} 
        initialTransaction={{
          ...transaction,
          id: '', // Clear ID to create a new one
          date: new Date().toISOString(), // Default to today
          history: [] // Clear history
        }}
      />
    )}
    </>
  );
}
