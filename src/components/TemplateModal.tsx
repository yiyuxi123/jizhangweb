import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { X, Check, Trash2 } from 'lucide-react';
import * as Icons from 'lucide-react';
import { TransactionTemplate, TransactionType } from '../types';
import { motion } from 'motion/react';

export default function TemplateModal({
  isOpen,
  onClose,
  templateToEdit
}: {
  isOpen: boolean;
  onClose: () => void;
  templateToEdit?: TransactionTemplate | null;
}) {
  const { categories, accounts, addTemplate, updateTemplate, deleteTemplate } = useStore();
  const [name, setName] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [note, setNote] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (templateToEdit) {
        setName(templateToEdit.name);
        setType(templateToEdit.type);
        setAmount(templateToEdit.amount ? templateToEdit.amount.toString() : '');
        setCategoryId(templateToEdit.categoryId || '');
        setFromAccountId(templateToEdit.fromAccountId || '');
        setToAccountId(templateToEdit.toAccountId || '');
        setNote(templateToEdit.note || '');
        setTagsInput(templateToEdit.tags ? templateToEdit.tags.join(' ') : '');
      } else {
        setName('');
        setType('expense');
        setAmount('');
        const defaultExpenseCat = categories.find(c => c.type === 'expense');
        setCategoryId(defaultExpenseCat?.id || '');
        setFromAccountId(accounts[0]?.id || '');
        setToAccountId(accounts[1]?.id || accounts[0]?.id || '');
        setNote('');
        setTagsInput('');
      }
    }
  }, [isOpen, templateToEdit, categories, accounts]);

  useEffect(() => {
    // Keep category in sync with type
    if (!templateToEdit) {
      const defaultCat = categories.find(c => c.type === type);
      setCategoryId(defaultCat?.id || '');
    }
  }, [type, categories, templateToEdit]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('请输入模板名称');
      return;
    }

    const tags = tagsInput.split(/[,，\s]+/).map(t => t.trim()).filter(t => t);
    const parsedAmount = amount && !isNaN(Number(amount)) ? Math.round(Number(amount) * 100) / 100 : 0;

    const tplData = {
      name: name.trim(),
      type,
      amount: parsedAmount,
      categoryId: type !== 'transfer' ? categoryId : undefined,
      fromAccountId: type !== 'income' ? fromAccountId : undefined,
      toAccountId: type !== 'expense' ? toAccountId : undefined,
      note: note.trim(),
      tags: tags.length > 0 ? tags : undefined
    };

    if (templateToEdit) {
      updateTemplate(templateToEdit.id, tplData);
    } else {
      addTemplate(tplData);
    }
    onClose();
  };

  const handleDelete = () => {
    if (templateToEdit && confirm('确定要删除这个模板吗？')) {
      deleteTemplate(templateToEdit.id);
      onClose();
    }
  };

  const filteredCategories = categories.filter(c => c.type === type);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-100 shrink-0">
          <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full">
            <X size={20} />
          </button>
          <h3 className="font-bold text-gray-900 text-sm">
            {templateToEdit ? '编辑快捷模板' : '新增快捷模板'}
          </h3>
          <div className="w-9" /> {/* Spacer */}
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Template Name */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">模板名称</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="如：工作午餐、地铁通勤"
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium text-gray-900"
            />
          </div>

          {/* Type Selection */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">账单类型</label>
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl w-fit">
              {(['expense', 'income', 'transfer'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    type === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t === 'expense' ? '支出' : t === 'income' ? '收入' : '转账'}
                </button>
              ))}
            </div>
          </div>

          {/* Default Amount */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">默认金额 (选填，输入0或空表示每次手动填写)</label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-gray-400 font-bold text-sm">¥</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-semibold text-gray-900"
              />
            </div>
          </div>

          {/* Category */}
          {type !== 'transfer' && (
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">分类</label>
              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-semibold text-gray-900"
              >
                {filteredCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Account selection */}
          <div className="space-y-4">
            {type !== 'income' && (
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">
                  {type === 'transfer' ? '转出账户' : '付款账户'}
                </label>
                <select
                  value={fromAccountId}
                  onChange={e => setFromAccountId(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-semibold text-gray-900"
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
              </div>
            )}

            {type !== 'expense' && (
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">
                  {type === 'transfer' ? '转入账户' : '收款账户'}
                </label>
                <select
                  value={toAccountId}
                  onChange={e => setToAccountId(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-semibold text-gray-900"
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Note & Tags */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">默认备注</label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="默认备注内容..."
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-semibold text-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">默认标签 (空格分隔)</label>
              <input
                type="text"
                value={tagsInput}
                onChange={e => setTagsInput(e.target.value)}
                placeholder="例如: 餐饮 团建"
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-semibold text-gray-900"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="pt-4 flex space-x-3">
            {templateToEdit && (
              <button
                type="button"
                onClick={handleDelete}
                className="p-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors flex items-center justify-center"
                title="删除模板"
              >
                <Trash2 size={20} />
              </button>
            )}
            <button
              type="submit"
              className="flex-1 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-colors flex items-center justify-center space-x-1.5"
            >
              <Check size={18} />
              <span>保存模板</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
