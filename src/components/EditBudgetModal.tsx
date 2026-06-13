import React, { useState, useEffect } from 'react';
import { X, Check, Plus, Trash2 } from '../utils/icons';
import { useStore } from '../store/useStore';

export default function EditBudgetModal({ onClose }: { onClose: () => void }) {
  const { budgets, updateBudget, addBudget, deleteBudget, categories } = useStore();
  
  const totalBudget = budgets.find(b => !b.categoryId);
  const categoryBudgets = budgets.filter(b => b.categoryId);
  
  const [totalAmount, setTotalAmount] = useState(totalBudget ? Number(totalBudget.amount.toFixed(2)).toString() : '');
  const [catBudgets, setCatBudgets] = useState<{id?: string, categoryId: string, amount: string}[]>(
    categoryBudgets.map(b => ({ id: b.id, categoryId: b.categoryId!, amount: Number(b.amount.toFixed(2)).toString() }))
  );

  const expenseCategories = categories.filter(c => c.type === 'expense' && !c.excludeFromBudget);

  const handleAddCategoryBudget = () => {
    if (expenseCategories.length > 0) {
      setCatBudgets([...catBudgets, { categoryId: expenseCategories[0].id, amount: '' }]);
    }
  };

  const handleRemoveCategoryBudget = (index: number) => {
    const newBudgets = [...catBudgets];
    const removed = newBudgets.splice(index, 1)[0];
    setCatBudgets(newBudgets);
    if (removed.id) {
      deleteBudget(removed.id);
    }
  };

  const handleCategoryBudgetChange = (index: number, field: 'categoryId' | 'amount', value: string) => {
    const newBudgets = [...catBudgets];
    newBudgets[index][field] = value;
    setCatBudgets(newBudgets);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Save total budget
    const numTotal = Math.round(Number(totalAmount) * 100) / 100;
    if (!isNaN(numTotal)) {
      if (numTotal > 0) {
        if (totalBudget) {
          updateBudget(totalBudget.id, { amount: numTotal });
        } else {
          addBudget({ amount: numTotal, period: 'monthly' });
        }
      } else if (totalBudget) {
        deleteBudget(totalBudget.id);
      }
    }

    // Save category budgets
    catBudgets.forEach(cb => {
      const numAmount = Math.round(Number(cb.amount) * 100) / 100;
      if (!isNaN(numAmount)) {
        if (numAmount > 0) {
          if (cb.id) {
            updateBudget(cb.id, { amount: numAmount, categoryId: cb.categoryId });
          } else {
            addBudget({ amount: numAmount, period: 'monthly', categoryId: cb.categoryId });
          }
        } else if (cb.id) {
          deleteBudget(cb.id);
        }
      }
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/40 backdrop-blur-sm transition-opacity">
      <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-10 duration-300 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <h2 className="text-xl font-bold text-gray-900">设置月度预算</h2>
          <button onClick={onClose} className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300 rounded-full hover:bg-gray-100">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <form id="budget-form" onSubmit={handleSubmit} className="space-y-8">
            {/* Total Budget */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">总预算</label>
              <div className="flex items-center border-b-2 border-emerald-500 py-2">
                <span className="text-3xl font-bold text-gray-900 dark:text-gray-100 mr-2">¥</span>
                <input 
                  type="number" 
                  step="0.01"
                  value={totalAmount}
                  onChange={e => setTotalAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full text-4xl font-bold text-gray-900 dark:text-gray-100 focus:outline-none placeholder-gray-300 bg-transparent"
                  autoFocus
                />
              </div>
            </div>

            {/* Category Budgets */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <label className="block text-sm font-medium text-gray-700">分类预算</label>
                <button 
                  type="button"
                  onClick={handleAddCategoryBudget}
                  className="text-xs flex items-center text-emerald-600 hover:text-emerald-700 font-medium bg-emerald-50 px-2 py-1 rounded-lg"
                >
                  <Plus size={14} className="mr-1" /> 添加分类预算
                </button>
              </div>
              
              <div className="space-y-3">
                {catBudgets.map((cb, index) => (
                  <div key={index} className="flex items-center space-x-2 bg-gray-50 dark:bg-gray-700 dark:bg-gray-900 p-2 rounded-xl border border-gray-100">
                    <select
                      value={cb.categoryId}
                      onChange={(e) => handleCategoryBudgetChange(index, 'categoryId', e.target.value)}
                      className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium text-gray-700 dark:text-gray-200 outline-none"
                    >
                      {expenseCategories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <div className="flex items-center bg-white dark:bg-gray-800 px-2 py-1 rounded-lg border border-gray-200">
                      <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500 mr-1 text-sm">¥</span>
                      <input
                        type="number"
                        value={cb.amount}
                        onChange={(e) => handleCategoryBudgetChange(index, 'amount', e.target.value)}
                        className="w-20 outline-none text-sm font-bold text-gray-900"
                        placeholder="0.00"
                      />
                    </div>
                    <button 
                      type="button"
                      onClick={() => handleRemoveCategoryBudget(index)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {catBudgets.length === 0 && (
                  <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4 bg-gray-50 dark:bg-gray-700 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 border-dashed">
                    暂无分类预算，点击上方按钮添加
                  </p>
                )}
              </div>
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-gray-100 dark:border-gray-700 shrink-0">
          <button 
            form="budget-form"
            type="submit"
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 transition-colors flex items-center justify-center space-x-2"
          >
            <Check size={20} />
            <span>保存预算</span>
          </button>
        </div>
      </div>
    </div>
  );
}
