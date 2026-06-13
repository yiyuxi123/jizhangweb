import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { parseOneSentence, parseReceiptImage } from '../services/aiService';
import TemplateModal from './TemplateModal';
import ManageTemplatesModal from './ManageTemplatesModal';
import { useStore } from '../store/useStore';
import { Icons } from '../utils/icons';
import { format, parseISO } from 'date-fns';
import { Transaction } from '../types';
import { motion } from 'motion/react';
import Numpad from './Numpad';
import { v4 as uuidv4 } from 'uuid';
import { compressImage } from '../lib/utils';

export default function AddTransactionModal({ isOpen, onClose, initialTransaction }: { isOpen: boolean, onClose: () => void, initialTransaction?: Transaction, key?: string | number }) {
  const { categories, accounts, addTransaction, updateTransaction, transactions, templates } = useStore();
  const [type, setType] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [note, setNote] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [isReimbursable, setIsReimbursable] = useState(false);
  const [selectedReimbursableIds, setSelectedReimbursableIds] = useState<string[]>([]);
  const [fee, setFee] = useState('');

  // AI helper & Image Attachment states
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [image, setImage] = useState<string | null>(null);

  // Template Modal States
  const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false);
  const [isManageTemplatesOpen, setIsManageTemplatesOpen] = useState(false);

  const applyAiResult = (result: any) => {
    if (result.type) setType(result.type);
    if (result.amount) setAmount(Number(result.amount).toString());
    
    if (result.categoryId) {
      setCategoryId(result.categoryId);
    } else if (result.suggestedCategoryName) {
      const matched = categories.find(c => c.name === result.suggestedCategoryName && c.type === result.type);
      if (matched) {
        setCategoryId(matched.id);
      } else {
        const defaultCat = categories.find(c => c.type === result.type);
        if (defaultCat) setCategoryId(defaultCat.id);
        setNote(prev => result.note ? `${result.suggestedCategoryName} - ${result.note}` : result.suggestedCategoryName);
        return;
      }
    }

    if (result.fromAccountId) setFromAccountId(result.fromAccountId);
    if (result.toAccountId) setToAccountId(result.toAccountId);
    if (result.note) setNote(result.note);
    if (result.tags && result.tags.length > 0) {
      setTagsInput(result.tags.join(' ') + ' ');
    }
    if (result.date) {
      setDate(format(parseISO(result.date), "yyyy-MM-dd'T'HH:mm"));
    }
  };

  const handleAiTextParse = async () => {
    if (!aiInput.trim() || aiLoading) return;
    setAiLoading(true);
    try {
      const result = await parseOneSentence(aiInput, accounts, categories);
      applyAiResult(result);
      setAiInput('');
    } catch (err: any) {
      if (err.message === 'MISSING_API_KEY_DEEPSEEK') {
        alert('未配置 DeepSeek API Key。请在「设置」->「AI 智能助理密钥设置」中配置您的 API Key。');
      } else {
        alert(`AI 一句话解析失败: ${err.message || err}`);
      }
    } finally {
      setAiLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Data = event.target?.result as string;
      try {
        const compressed = await compressImage(base64Data);
        setImage(compressed);
      } catch {
        setImage(base64Data); // fallback to original if compression fails
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const takePhotoNative = async () => {
    try {
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera
      });
      if (photo.base64String) {
        const raw = `data:image/jpeg;base64,${photo.base64String}`;
        try {
          const compressed = await compressImage(raw);
          setImage(compressed);
        } catch {
          setImage(raw);
        }
      }
    } catch (error) {
      console.error('Failed to take photo via Capacitor Camera:', error);
    }
  };

  const choosePhotoNative = async () => {
    try {
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Photos
      });
      if (photo.base64String) {
        const raw = `data:image/jpeg;base64,${photo.base64String}`;
        try {
          const compressed = await compressImage(raw);
          setImage(compressed);
        } catch {
          setImage(raw);
        }
      }
    } catch (error) {
      console.error('Failed to choose photo via Capacitor Gallery:', error);
    }
  };

  const handleRunAiOnAttachedImage = async () => {
    if (!image || aiLoading) return;
    setAiLoading(true);
    try {
      const result = await parseReceiptImage(image, accounts, categories);
      applyAiResult(result);
    } catch (err: any) {
      if (err.message === 'MISSING_API_KEY_QWEN') {
        alert('未配置 Qwen API Key。请在「设置」->「AI 智能助理密钥设置」中配置您的 API Key。');
      } else {
        alert(`图片识别失败: ${err.message || err}`);
      }
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (initialTransaction) {
        setType(initialTransaction.type);
        setAmount(Number(initialTransaction.amount.toFixed(2)).toString());
        setCategoryId(initialTransaction.categoryId || '');
        setFromAccountId(initialTransaction.fromAccountId || '');
        setToAccountId(initialTransaction.toAccountId || '');
        setNote(initialTransaction.note || '');
        setTagsInput(initialTransaction.tags ? initialTransaction.tags.join(', ') : '');
        setDate(format(parseISO(initialTransaction.date), "yyyy-MM-dd'T'HH:mm"));
        setIsReimbursable(initialTransaction.isReimbursable || false);
        setSelectedReimbursableIds(initialTransaction.reimbursedTxIds || []);
        setImage(initialTransaction.image || null);
        setFee('');
      } else {
        // Set defaults
        const defaultExpenseCat = categories.find(c => c.type === 'expense');
        const defaultIncomeCat = categories.find(c => c.type === 'income');
        const defaultAccount = accounts[0];
        
        if (type === 'expense' && defaultExpenseCat) setCategoryId(defaultExpenseCat.id);
        if (type === 'income' && defaultIncomeCat) setCategoryId(defaultIncomeCat.id);
        if (defaultAccount) setFromAccountId(defaultAccount.id);
        if (accounts.length > 1) setToAccountId(accounts[1].id);
        setIsReimbursable(false);
        setSelectedReimbursableIds([]);
        setAmount('');
        setTagsInput('');
        setImage(null);
        setFee('');
      }
    }
  }, [isOpen, initialTransaction, type, categories, accounts]);

  const selectedCategory = categories.find(c => c.id === categoryId);

  useEffect(() => {
    if (type === 'income' && selectedCategory?.name === '报销款') {
      const total = selectedReimbursableIds.reduce((sum, id) => {
        const tx = transactions.find(t => t.id === id);
        return sum + (tx?.amount || 0);
      }, 0);
      if (total > 0) {
        setAmount((Math.round(total * 100) / 100).toString());
      } else if (selectedReimbursableIds.length === 0 && !initialTransaction) {
        setAmount('');
      }
    }
  }, [selectedReimbursableIds, type, selectedCategory?.name, transactions, initialTransaction]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      alert('请输入有效的金额');
      return;
    }

    if (type !== 'transfer' && !categoryId) {
      alert('请选择分类');
      return;
    }
    if (type !== 'income' && !fromAccountId) {
      alert('请选择付款账户');
      return;
    }
    if (type !== 'expense' && !toAccountId) {
      alert('请选择收款账户');
      return;
    }
    if (type === 'transfer' && fromAccountId === toAccountId) {
      alert('付款账户和收款账户不能相同');
      return;
    }

    const tags = tagsInput.split(/[,，\s]+/).map(t => t.trim()).filter(t => t);

    const txData = {
      type,
      amount: Math.round(Number(amount) * 100) / 100,
      date: new Date(date).toISOString(),
      categoryId: type !== 'transfer' ? categoryId : undefined,
      fromAccountId: type !== 'income' ? fromAccountId : undefined,
      toAccountId: type !== 'expense' ? toAccountId : undefined,
      note,
      tags: tags.length > 0 ? tags : undefined,
      isReimbursable: type === 'expense' ? isReimbursable : undefined,
      reimbursedTxIds: type === 'income' && selectedCategory?.name === '报销款' ? selectedReimbursableIds : undefined,
      image: image || undefined
    };

    if (initialTransaction && initialTransaction.id) {
      updateTransaction(initialTransaction.id, txData);
    } else {
      addTransaction(txData);
      
      // Handle transfer fee
      if (type === 'transfer' && fee && !isNaN(Number(fee)) && Number(fee) > 0) {
        let feeCategory = categories.find(c => c.type === 'expense' && (c.name.includes('手续费') || c.name.includes('转账')));
        
        const executeAddFeeTx = (catId: string) => {
          addTransaction({
            type: 'expense',
            amount: Math.round(Number(fee) * 100) / 100,
            date: new Date(date).toISOString(),
            categoryId: catId,
            fromAccountId: fromAccountId,
            note: `${note ? note + ' - ' : ''}转账手续费`,
            tags: tags.length > 0 ? tags : undefined,
          });
        };

        if (!feeCategory) {
          feeCategory = categories.find(c => c.type === 'expense' && c.name === '手续费');
        }

        if (feeCategory) {
          executeAddFeeTx(feeCategory.id);
        } else {
          // Auto-bootstrap a "手续费" category
          const newFeeCatId = uuidv4();
          useStore.getState().addCategory({
            id: newFeeCatId,
            name: '手续费',
            type: 'expense',
            icon: 'Percent',
            color: '#9ca3af',
          });
          executeAddFeeTx(newFeeCatId);
        }
      }
    }
    onClose();
  };

  const filteredCategories = categories.filter(c => c.type === type);

  const [showNumpad, setShowNumpad] = useState(false);

  const availableTags = React.useMemo(() => {
    const tags = new Set<string>();
    transactions.forEach(t => {
      if (t.tags) {
        t.tags.forEach(tag => tags.add(tag));
      }
    });
    return Array.from(tags);
  }, [transactions]);

  const categoryRecommendedTags = React.useMemo(() => {
    if (!categoryId) return [];
    const counts: Record<string, number> = {};
    transactions.forEach(t => {
      if (t.categoryId === categoryId && t.tags) {
        t.tags.forEach(tag => {
          counts[tag] = (counts[tag] || 0) + 1;
        });
      }
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0])
      .slice(0, 8);
  }, [categoryId, transactions]);

  const activeTypingTag = React.useMemo(() => {
    const parts = tagsInput.split(/[,，\s]+/);
    return parts[parts.length - 1]?.trim() || '';
  }, [tagsInput]);

  const filteredAvailableTags = React.useMemo(() => {
    if (!activeTypingTag) {
      if (categoryRecommendedTags.length > 0) {
        return categoryRecommendedTags;
      }
      const overallCounts: Record<string, number> = {};
      transactions.forEach(t => {
        if (t.tags) {
          t.tags.forEach(tag => {
            overallCounts[tag] = (overallCounts[tag] || 0) + 1;
          });
        }
      });
      return Object.entries(overallCounts)
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0])
        .slice(0, 8);
    }
    return availableTags
      .filter(tag => tag.toLowerCase().includes(activeTypingTag.toLowerCase()) && tag !== activeTypingTag)
      .slice(0, 8);
  }, [activeTypingTag, availableTags, categoryRecommendedTags, transactions]);

  const handleTagClick = (tag: string) => {
    const currentTags = tagsInput.split(/[,，\s]+/).map(t => t.trim()).filter(t => t);
    if (activeTypingTag && tag.toLowerCase().includes(activeTypingTag.toLowerCase())) {
      currentTags[currentTags.length - 1] = tag;
    } else if (!currentTags.includes(tag)) {
      currentTags.push(tag);
    }
    setTagsInput(currentTags.join(' ') + ' ');
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/40 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-white dark:bg-gray-800 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <button onClick={onClose} className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300 rounded-full hover:bg-gray-100">
            <Icons.X size={24} />
          </button>
          <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700/50 p-1 rounded-xl">
            {(['expense', 'income', 'transfer'] as const).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  type === t 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'expense' ? '支出' : t === 'income' ? '收入' : '转账'}
              </button>
            ))}
          </div>
          <button 
            type="button"
            onClick={() => {
              const aiEl = document.getElementById('ai-bookkeeper-section');
              aiEl?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-full animate-bounce"
            title="AI 智能记账"
          >
            <Icons.Mic size={24} />
          </button>
        </div>

        {/* Quick Add Templates Row */}
        <div className="px-6 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 flex items-center space-x-2 overflow-x-auto shrink-0 snap-x">
          <span className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 shrink-0 mr-1 flex items-center">
            <Icons.Zap size={12} className="text-yellow-500 mr-0.5" /> 快捷模板:
          </span>
          {templates.map(tpl => {
            const cat = categories.find(c => c.id === tpl.categoryId);
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => {
                  setType(tpl.type);
                  setAmount(tpl.amount > 0 ? tpl.amount.toString() : '');
                  if (tpl.categoryId) setCategoryId(tpl.categoryId);
                  if (tpl.fromAccountId) setFromAccountId(tpl.fromAccountId);
                  if (tpl.toAccountId) setToAccountId(tpl.toAccountId);
                  setNote(tpl.note || '');
                  setTagsInput(tpl.tags ? tpl.tags.join(' ') + ' ' : '');
                  if (tpl.amount === 0) {
                    setShowNumpad(true);
                  }
                }}
                className="snap-start shrink-0 px-2.5 py-1 bg-white dark:bg-gray-800 hover:bg-emerald-50 hover:text-emerald-700 text-xs font-semibold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-full transition-colors flex items-center space-x-1 shadow-sm"
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tpl.type === 'transfer' ? '#6b7280' : cat?.color || '#9ca3af' }} />
                <span>{tpl.name}</span>
                {tpl.amount > 0 && <span className="text-[10px] text-gray-400 dark:text-gray-500 font-normal">¥{tpl.amount}</span>}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setIsTemplateEditorOpen(true)}
            className="snap-start shrink-0 px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/30 dark:text-emerald-400 text-xs font-bold rounded-full transition-colors flex items-center space-x-0.5 shadow-sm"
          >
            <Icons.Plus size={10} />
            <span>新增</span>
          </button>
          <button
            type="button"
            onClick={() => setIsManageTemplatesOpen(true)}
            className="snap-start shrink-0 p-1.5 bg-gray-100 dark:bg-gray-700/50 hover:bg-200 text-gray-500 dark:text-gray-400 rounded-full transition-colors shadow-sm"
            title="管理快捷模板"
          >
            <Icons.Settings size={10} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Amount Input */}
          <div 
            className="flex items-center border-b-2 border-emerald-500 py-2 cursor-pointer"
            onClick={() => setShowNumpad(true)}
          >
            <span className="text-3xl font-bold text-gray-900 dark:text-gray-100 mr-2">¥</span>
            <div className={`w-full text-4xl font-bold ${amount ? 'text-gray-900 dark:text-gray-100' : 'text-gray-300 dark:text-gray-600'}`}>
              {amount || '0.00'}
            </div>
          </div>

          {/* AI Helper Card */}
          <div id="ai-bookkeeper-section" className="bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2 text-indigo-900 dark:text-indigo-200">
                <Icons.Sparkles size={16} className="text-violet-600 animate-pulse" />
                <span className="text-xs font-bold">AI 智能辅助记账 (一句话/小票截图)</span>
              </div>
              {aiLoading && (
                <span className="text-[10px] text-violet-600 font-bold animate-pulse">AI 正在识别...</span>
              )}
            </div>

            <div className="flex space-x-2">
              <input
                type="text"
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAiTextParse()}
                placeholder="在此输入一句话，如：刚才微信买奶茶花了15"
                className="flex-1 px-3 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none animate-pulse-slow text-gray-900 dark:text-gray-100"
              />
              <button
                type="button"
                onClick={handleAiTextParse}
                disabled={aiLoading || !aiInput.trim()}
                className="px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs rounded-xl transition-colors shrink-0 disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-gray-850 dark:disabled:text-gray-600"
              >
                解析
              </button>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-gray-400">自动提取分类、账户及消费详情</span>
              {Capacitor.isNativePlatform() ? (
                <div className="flex space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={takePhotoNative}
                    disabled={aiLoading}
                    className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-900/40 text-indigo-700 dark:text-indigo-400 font-bold text-xs rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition-colors flex items-center space-x-1 shadow-sm"
                  >
                    <Icons.Camera size={14} />
                    <span>拍照</span>
                  </button>
                  <button
                    type="button"
                    onClick={choosePhotoNative}
                    disabled={aiLoading}
                    className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-900/40 text-indigo-700 dark:text-indigo-400 font-bold text-xs rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition-colors flex items-center space-x-1 shadow-sm"
                  >
                    <Icons.Image size={14} />
                    <span>上传图片</span>
                  </button>
                </div>
              ) : (
                <div className="flex space-x-2 shrink-0">
                  {/* Take Photo Option */}
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleImageUpload}
                      disabled={aiLoading}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <button
                      type="button"
                      className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-900/40 text-indigo-700 dark:text-indigo-400 font-bold text-xs rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition-colors flex items-center space-x-1 shadow-sm"
                    >
                      <Icons.Camera size={14} />
                      <span>拍照</span>
                    </button>
                  </div>
                  {/* Upload Image Option */}
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={aiLoading}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <button
                      type="button"
                      className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-900/40 text-indigo-700 dark:text-indigo-400 font-bold text-xs rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition-colors flex items-center space-x-1 shadow-sm"
                    >
                      <Icons.Image size={14} />
                      <span>上传图片</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Image Preview / Attachment */}
          {image && (
            <div className="relative bg-gray-50 dark:bg-gray-900 border border-indigo-100/50 dark:border-indigo-950/30 rounded-2xl p-3 flex flex-col items-center justify-center space-y-2">
              <img src={image} alt="单据凭证" className="max-h-40 max-w-full rounded-lg object-contain" />
              <div className="flex space-x-2 w-full">
                <button
                  type="button"
                  onClick={handleRunAiOnAttachedImage}
                  disabled={aiLoading}
                  className="flex-1 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center space-x-1 shadow-sm"
                >
                  <Icons.Sparkles size={12} />
                  <span>AI 识别小票</span>
                </button>
                <button
                  type="button"
                  onClick={() => setImage(null)}
                  disabled={aiLoading}
                  className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl transition-colors flex items-center justify-center space-x-1 border border-red-200"
                >
                  <Icons.Trash2 size={12} />
                  <span>删除图片</span>
                </button>
              </div>
            </div>
          )}

          {/* Categories Grid */}
          {type !== 'transfer' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">分类</label>
              <div className="grid grid-cols-4 gap-4">
                {filteredCategories.map(cat => {
                  const IconComponent = (Icons as any)[cat.icon] || Icons.HelpCircle;
                  const isSelected = categoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategoryId(cat.id)}
                      className="flex flex-col items-center space-y-2 group"
                    >
                      <div 
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                          isSelected ? 'ring-4 ring-offset-2 scale-110' : 'hover:scale-105'
                        }`}
                        style={{ 
                          backgroundColor: isSelected ? cat.color : `${cat.color}20`,
                          color: isSelected ? 'white' : cat.color,
                          borderColor: cat.color
                        }}
                      >
                        <IconComponent size={24} />
                      </div>
                      <span className={`text-xs font-medium ${isSelected ? 'text-gray-900' : 'text-gray-500'}`}>
                        {cat.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Accounts */}
          <div className="space-y-4">
            {type !== 'income' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  {type === 'transfer' ? '转出账户' : '付款账户'}
                </label>
                <select 
                  value={fromAccountId} 
                  onChange={e => setFromAccountId(e.target.value)}
                  className="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} (余额: ¥{acc.balance})</option>
                  ))}
                </select>
              </div>
            )}

            {type !== 'expense' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  {type === 'transfer' ? '转入账户' : '收款账户'}
                </label>
                <select 
                  value={toAccountId} 
                  onChange={e => setToAccountId(e.target.value)}
                  className="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} (余额: ¥{acc.balance})</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Date & Note & Tags */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">日期</label>
              <input 
                type="datetime-local" 
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">备注</label>
              <input 
                type="text" 
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="写点什么..."
                className="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
              />
            </div>
          </div>
          
          {type === 'transfer' && !initialTransaction && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">转账手续费 (选填)</label>
              <input 
                type="number" 
                value={fee}
                onChange={e => setFee(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">标签 (用空格或逗号分隔)</label>
            <input 
              type="text" 
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              placeholder="例如: 旅游 聚餐"
              className="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm mb-2"
            />
            {filteredAvailableTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {filteredAvailableTags.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleTagClick(tag)}
                    className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 text-xs rounded-lg hover:bg-gray-200 transition-colors font-medium border border-gray-200/50"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reimbursable Checkbox */}
          {type === 'expense' && (
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="reimbursable"
                checked={isReimbursable}
                onChange={(e) => setIsReimbursable(e.target.checked)}
                className="w-4 h-4 text-emerald-500 border-gray-300 rounded focus:ring-emerald-500"
              />
              <label htmlFor="reimbursable" className="text-sm font-medium text-gray-700">
                可报销
              </label>
            </div>
          )}

          {/* Reimbursable Selection for Income */}
          {type === 'income' && selectedCategory?.name === '报销款' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-medium text-gray-700">选择要报销的记录</label>
                {transactions.filter(t => t.type === 'expense' && t.isReimbursable && (!t.isReimbursed || t.reimbursedByTxId === initialTransaction?.id)).length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const availableTxs = transactions.filter(t => t.type === 'expense' && t.isReimbursable && (!t.isReimbursed || t.reimbursedByTxId === initialTransaction?.id));
                      if (selectedReimbursableIds.length === availableTxs.length) {
                        setSelectedReimbursableIds([]);
                      } else {
                        setSelectedReimbursableIds(availableTxs.map(t => t.id));
                      }
                    }}
                    className="text-xs text-emerald-600 font-medium"
                  >
                    {selectedReimbursableIds.length === transactions.filter(t => t.type === 'expense' && t.isReimbursable && (!t.isReimbursed || t.reimbursedByTxId === initialTransaction?.id)).length ? '取消全选' : '全选'}
                  </button>
                )}
              </div>
              <div className="max-h-40 overflow-y-auto space-y-2 border border-gray-100 dark:border-gray-700 rounded-xl p-2 bg-gray-50">
                {transactions.filter(t => t.type === 'expense' && t.isReimbursable && (!t.isReimbursed || t.reimbursedByTxId === initialTransaction?.id)).length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 text-center py-2">没有待报销的记录</p>
                ) : (
                  transactions
                    .filter(t => t.type === 'expense' && t.isReimbursable && (!t.isReimbursed || t.reimbursedByTxId === initialTransaction?.id))
                    .map(t => (
                      <div key={t.id} className="flex items-center space-x-3 p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-100">
                        <input
                          type="checkbox"
                          checked={selectedReimbursableIds.includes(t.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedReimbursableIds(prev => [...prev, t.id]);
                            } else {
                              setSelectedReimbursableIds(prev => prev.filter(id => id !== t.id));
                            }
                          }}
                          className="w-4 h-4 text-emerald-500 border-gray-300 rounded focus:ring-emerald-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {format(parseISO(t.date), 'MM-dd')} {t.note || categories.find(c => c.id === t.categoryId)?.name}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-gray-900">¥{t.amount.toFixed(2)}</span>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button 
            onClick={handleSubmit}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 transition-colors flex items-center justify-center space-x-2"
          >
            <Icons.Check size={20} />
            <span>保存记录</span>
          </button>
        </div>

        {/* Custom Numpad */}
        {showNumpad && (
          <Numpad
            value={amount}
            onChange={setAmount}
            onComplete={() => setShowNumpad(false)}
          />
        )}
        {isTemplateEditorOpen && (
          <TemplateModal
            isOpen={isTemplateEditorOpen}
            onClose={() => setIsTemplateEditorOpen(false)}
          />
        )}
        {isManageTemplatesOpen && (
          <ManageTemplatesModal
            isOpen={isManageTemplatesOpen}
            onClose={() => setIsManageTemplatesOpen(false)}
          />
        )}
      </motion.div>
    </motion.div>
  );
}
