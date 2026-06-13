import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { SavingGoal } from '../types';
import { Icons } from '../utils/icons';
import { motion, AnimatePresence } from 'motion/react';
import Numpad from './Numpad';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
const AVAILABLE_ICONS = ['Target', 'Car', 'Home', 'Plane', 'Laptop', 'Gift', 'Heart', 'GraduationCap'];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  goal?: SavingGoal | null;
}

export default function GoalModal({ isOpen, onClose, goal }: Props) {
  const { addGoal, updateGoal, deleteGoal, accounts } = useStore();
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [icon, setIcon] = useState(AVAILABLE_ICONS[0]);
  const [accountId, setAccountId] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [activeInput, setActiveInput] = useState<'target' | 'current' | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (goal) {
        setName(goal.name);
        setTargetAmount(Number(goal.targetAmount.toFixed(2)).toString());
        setCurrentAmount(Number(goal.currentAmount.toFixed(2)).toString());
        setDeadline(goal.deadline ? goal.deadline.split('T')[0] : '');
        setColor(goal.color);
        setIcon(goal.icon);
        setAccountId(goal.accountId || '');
      } else {
        setName('');
        setTargetAmount('');
        setCurrentAmount('0');
        setDeadline('');
        setColor(COLORS[0]);
        setIcon(AVAILABLE_ICONS[0]);
        setAccountId('');
      }
      setShowConfirm(false);
      setActiveInput(null);
    }
  }, [isOpen, goal]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !targetAmount || Number(targetAmount) <= 0) {
      alert('请输入有效的目标金额');
      return;
    }

    const goalData = {
      name,
      targetAmount: Math.round(Number(targetAmount) * 100) / 100,
      currentAmount: Math.round((Number(currentAmount) || 0) * 100) / 100,
      deadline: deadline ? new Date(deadline).toISOString() : undefined,
      color,
      icon,
      accountId: accountId || undefined
    };

    if (goal) {
      updateGoal(goal.id, goalData);
    } else {
      addGoal(goalData);
    }
    onClose();
  };

  const handleDelete = () => {
    if (goal) {
      deleteGoal(goal.id);
      onClose();
    }
  };

  const handleNumpadChange = (val: string) => {
    if (!activeInput) return;
    if (activeInput === 'target') setTargetAmount(val);
    else setCurrentAmount(val);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/40 backdrop-blur-sm transition-opacity">
        <motion.div 
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        >
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <h2 className="text-xl font-bold text-gray-900">{goal ? '编辑目标' : '新建存钱目标'}</h2>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
              <Icons.X size={20} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto">
            {showConfirm ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                  <Icons.AlertTriangle size={32} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">确定要删除此目标吗？</h3>
                <p className="text-gray-500 mb-6 text-sm">此操作不可恢复。</p>
                <div className="flex space-x-3">
                  <button type="button" onClick={() => setShowConfirm(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">
                    取消
                  </button>
                  <button type="button" onClick={handleDelete} className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors shadow-sm shadow-red-500/30">
                    确认删除
                  </button>
                </div>
              </div>
            ) : (
              <form id="goal-form" onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">目标名称</label>
                  <input 
                    type="text" 
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="例如：买车、旅游"
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">目标金额</label>
                    <div 
                      className={`w-full p-3 bg-gray-50 border rounded-xl outline-none transition-all cursor-pointer ${activeInput === 'target' ? 'ring-2 ring-emerald-500 border-emerald-500' : 'border-gray-200'}`}
                      onClick={() => setActiveInput('target')}
                    >
                      {targetAmount || '0.00'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">已存金额</label>
                    <div 
                      className={`w-full p-3 bg-gray-50 border rounded-xl outline-none transition-all ${accountId ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${activeInput === 'current' ? 'ring-2 ring-emerald-500 border-emerald-500' : 'border-gray-200'}`}
                      onClick={() => !accountId && setActiveInput('current')}
                    >
                      {accountId ? (accounts.find(a => a.id === accountId)?.balance || 0).toFixed(2) : (currentAmount || '0.00')}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">关联账户 (选填)</label>
                  <select 
                    value={accountId} 
                    onChange={e => setAccountId(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  >
                    <option value="">不关联账户</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} (余额: ¥{acc.balance})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">目标日期 (选填)</label>
                  <input 
                    type="date" 
                    value={deadline}
                    onChange={e => setDeadline(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">图标</label>
                  <div className="grid grid-cols-4 gap-3">
                    {AVAILABLE_ICONS.map(i => {
                      const IconComponent = (Icons as any)[i];
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setIcon(i)}
                          className={`p-3 rounded-xl flex items-center justify-center transition-all ${icon === i ? 'bg-emerald-100 text-emerald-600 ring-2 ring-emerald-500' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                        >
                          <IconComponent size={24} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">颜色</label>
                  <div className="flex space-x-3 overflow-x-auto py-3 px-2 -mx-2 scrollbar-hide">
                    {COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center transition-transform ${color === c ? 'scale-110 ring-4 ring-offset-2' : 'hover:scale-110'}`}
                        style={{ backgroundColor: c, '--tw-ring-color': c } as any}
                      >
                        {color === c && <Icons.Check size={20} className="text-white" />}
                      </button>
                    ))}
                  </div>
                </div>
              </form>
            )}
          </div>

          {!showConfirm && !activeInput && (
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex space-x-3">
              {goal && (
                <button 
                  type="button"
                  onClick={() => setShowConfirm(true)}
                  className="px-4 py-3 bg-white border border-gray-200 text-red-500 font-bold rounded-xl hover:bg-red-50 transition-colors"
                >
                  <Icons.Trash2 size={20} />
                </button>
              )}
              <button 
                type="submit" 
                form="goal-form"
                className="flex-1 py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-colors shadow-sm shadow-emerald-500/30"
              >
                保存
              </button>
            </div>
          )}

          {activeInput && (
            <Numpad
              value={activeInput === 'target' ? targetAmount : currentAmount}
              onChange={handleNumpadChange}
              onComplete={() => setActiveInput(null)}
            />
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
