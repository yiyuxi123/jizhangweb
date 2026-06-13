import React, { useState } from 'react';
import { X, Check, Trash2 } from '../utils/icons';
import { useStore } from '../store/useStore';
import { Category } from '../types';
import { Icons } from '../utils/icons';

const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981', 
  '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', 
  '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#64748b', '#3f3f46'
];

const AVAILABLE_ICONS = [
  'Utensils', 'Bus', 'ShoppingBag', 'Home', 'Wallet', 'TrendingUp', 
  'Coffee', 'Film', 'Music', 'Heart', 'Briefcase', 'Gift', 
  'Zap', 'Book', 'Monitor', 'Smile', 'Car', 'Plane', 'Scissors', 'Smartphone'
];

export default function EditCategoryModal({ 
  category, 
  defaultType,
  onClose 
}: { 
  category: Category | null, 
  defaultType: 'expense' | 'income',
  onClose: () => void 
}) {
  const { addCategory, updateCategory, deleteCategory, categories } = useStore();
  const [name, setName] = useState(category?.name || '');
  const [color, setColor] = useState(category?.color || COLORS[0]);
  const [icon, setIcon] = useState(category ? (category.icon || 'HelpCircle') : AVAILABLE_ICONS[0]);
  const [isFixed, setIsFixed] = useState(category?.isFixed || false);
  const [excludeFromBudget, setExcludeFromBudget] = useState(category?.excludeFromBudget || false);
  const [excludeFromStats, setExcludeFromStats] = useState(category?.excludeFromStats || false);
  const [showConfirm, setShowConfirm] = useState(false);

  const isNew = !category;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    if (isNew && categories.some(c => c.name === name && c.type === defaultType)) {
      alert('已存在同名分类，请更换名称');
      return;
    } else if (!isNew && categories.some(c => c.name === name && c.type === defaultType && c.id !== category?.id)) {
      alert('已存在同名分类，请更换名称');
      return;
    }

    if (isNew) {
      addCategory({ name, type: defaultType, color, icon, isFixed, excludeFromBudget, excludeFromStats });
    } else {
      updateCategory(category.id, { name, color, icon, isFixed, excludeFromBudget, excludeFromStats });
    }
    onClose();
  };

  const handleDelete = () => {
    if (!isNew) {
      deleteCategory(category.id);
    }
    onClose();
  };

  const SelectedIcon = (Icons as any)[icon] || Icons.HelpCircle;

  const currentIcons = React.useMemo(() => {
    const icons = [...AVAILABLE_ICONS];
    const currentIcon = category ? (category.icon || 'HelpCircle') : null;
    if (currentIcon && !icons.includes(currentIcon)) {
      icons.unshift(currentIcon);
    }
    return icons;
  }, [category]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center bg-black/40 backdrop-blur-sm transition-opacity">
      <div className="bg-white w-full max-w-md h-[90vh] sm:h-auto sm:max-h-[90vh] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-10 duration-300">
        <div className="flex justify-between items-center p-6 border-b border-gray-100 shrink-0">
          <h2 className="text-xl font-bold text-gray-900">{isNew ? '添加分类' : '编辑分类'}</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <form id="category-form" onSubmit={handleSubmit} className="space-y-8">
            
            {/* Preview & Name */}
            <div className="flex items-center space-x-4">
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center text-white shrink-0 shadow-inner"
                style={{ backgroundColor: color }}
              >
                <SelectedIcon size={32} />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">分类名称</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="输入分类名称"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-medium"
                  required
                />
              </div>
            </div>

            {/* Color Picker */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">选择颜色</label>
              <div className="grid grid-cols-6 gap-3">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform ${color === c ? 'scale-110 ring-4 ring-offset-2' : 'hover:scale-110'}`}
                    style={{ backgroundColor: c, borderColor: c }}
                  >
                    {color === c && <Check size={20} className="text-white" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Icon Picker */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">选择图标</label>
              <div className="grid grid-cols-5 gap-3">
                {currentIcons.map(i => {
                  const IconComp = (Icons as any)[i] || Icons.HelpCircle;
                  const isSelected = icon === i;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setIcon(i)}
                      className={`aspect-square rounded-2xl flex items-center justify-center transition-all ${
                        isSelected 
                          ? 'bg-gray-900 text-white shadow-md scale-105' 
                          : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      <IconComp size={24} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Fixed Expense Toggle */}
            {defaultType === 'expense' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div>
                    <h4 className="font-medium text-gray-900">固定支出</h4>
                    <p className="text-xs text-gray-500 mt-0.5">房租、订阅等每月固定的开销</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsFixed(!isFixed)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isFixed ? 'bg-emerald-500' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isFixed ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div>
                    <h4 className="font-medium text-gray-900">不计入预算</h4>
                    <p className="text-xs text-gray-500 mt-0.5">此分类的消费不会占用总预算额度</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExcludeFromBudget(!excludeFromBudget)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${excludeFromBudget ? 'bg-emerald-500' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${excludeFromBudget ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div>
                    <h4 className="font-medium text-gray-900">不计入统计</h4>
                    <p className="text-xs text-gray-500 mt-0.5">此分类的消费不会计入本月总支出</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExcludeFromStats(!excludeFromStats)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${excludeFromStats ? 'bg-emerald-500' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${excludeFromStats ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-gray-100 bg-white shrink-0 space-y-3">
          <button 
            type="submit"
            form="category-form"
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 transition-colors flex items-center justify-center space-x-2"
          >
            <Check size={20} />
            <span>保存分类</span>
          </button>

          {!isNew && (
            showConfirm ? (
              <div className="space-y-3 pt-2 animate-in fade-in zoom-in-95 duration-200">
                <p className="text-center text-red-500 font-medium text-sm">删除分类不会删除已有账单，确定删除吗？</p>
                <div className="flex space-x-3">
                  <button type="button" onClick={() => setShowConfirm(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">
                    取消
                  </button>
                  <button type="button" onClick={handleDelete} className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors">
                    确认删除
                  </button>
                </div>
              </div>
            ) : (
              <button 
                type="button"
                onClick={() => setShowConfirm(true)}
                className="w-full py-4 bg-red-50 text-red-500 hover:bg-red-100 font-bold rounded-xl transition-colors flex items-center justify-center space-x-2"
              >
                <Trash2 size={20} />
                <span>删除分类</span>
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
