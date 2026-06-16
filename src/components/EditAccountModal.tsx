import React, { useState, useEffect } from 'react';
import { X, Check, Trash2 } from '../utils/icons';
import { useStore } from '../store/useStore';
import { Account } from '../types';
import CustomSelect from './CustomSelect';

const typeOptions = [
  { value: 'bank', label: '银行卡' },
  { value: 'cash', label: '现金' },
  { value: 'alipay', label: '支付宝' },
  { value: 'wechat', label: '微信' },
  { value: 'credit', label: '信用卡' },
  { value: 'auto_deposit', label: '自动入账 (如公积金/医保)' }
];

const fundTypeOptions = [
  { value: 'working', label: '流动资金', desc: '现金/微信/支付宝/储蓄卡等' },
  { value: 'investment', label: '投资资金', desc: '股票/基金/理财等' },
  { value: 'unavailable', label: '不可用资金', desc: '定期/冻结/公积金等' }
];

export default function EditAccountModal({ account, onClose }: { account: Account, onClose: () => void }) {
  const { updateAccount, deleteAccount, accounts } = useStore();
  const [name, setName] = useState(account.name);
  const [type, setType] = useState<'cash' | 'bank' | 'alipay' | 'wechat' | 'credit' | 'auto_deposit'>(account.type);
  const [balance, setBalance] = useState(Number(account.balance.toFixed(2)).toString());
  const [isHidden, setIsHidden] = useState(account.isHidden || false);
  const [autoDepositAmount, setAutoDepositAmount] = useState(account.autoDepositAmount ? account.autoDepositAmount.toString() : '');
  const [autoDepositDay, setAutoDepositDay] = useState(account.autoDepositDay ? account.autoDepositDay.toString() : '');
  const [fundType, setFundType] = useState<'working' | 'investment' | 'unavailable'>(account.fundType || 'working');
  const [targetRatio, setTargetRatio] = useState(account.targetRatio ? account.targetRatio.toString() : '');
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    setName(account.name);
    setType(account.type);
    setBalance(Number(account.balance.toFixed(2)).toString());
    setIsHidden(account.isHidden || false);
    setAutoDepositAmount(account.autoDepositAmount ? account.autoDepositAmount.toString() : '');
    setAutoDepositDay(account.autoDepositDay ? account.autoDepositDay.toString() : '');
    setFundType(account.fundType || 'working');
    setTargetRatio(account.targetRatio ? account.targetRatio.toString() : '');
    setShowConfirm(false);
  }, [account]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    if (accounts.some(a => a.name === name && a.id !== account.id)) {
      alert('已存在同名账户，请更换名称');
      return;
    }

    let icon = 'CreditCard';
    let color = '#3b82f6';
    
    if (type === 'cash') { icon = 'Banknote'; color = '#10b981'; }
    if (type === 'alipay') { icon = 'Smartphone'; color = '#3b82f6'; }
    if (type === 'wechat') { icon = 'MessageCircle'; color = '#22c55e'; }
    if (type === 'credit') { icon = 'CreditCard'; color = '#f59e0b'; }
    if (type === 'bank') { icon = 'Landmark'; color = '#ef4444'; }
    if (type === 'auto_deposit') { icon = 'PiggyBank'; color = '#8b5cf6'; }

    updateAccount(account.id, {
      name,
      type,
      balance: Math.round((Number(balance) || 0) * 100) / 100,
      color,
      icon,
      isHidden,
      autoDepositAmount: type === 'auto_deposit' && autoDepositAmount ? Number(autoDepositAmount) : undefined,
      autoDepositDay: type === 'auto_deposit' && autoDepositDay ? Number(autoDepositDay) : undefined,
      fundType,
      targetRatio: fundType === 'investment' && targetRatio ? Math.round(Number(targetRatio)) : undefined
    });
    onClose();
  };

  const handleDelete = () => {
    deleteAccount(account.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/40 backdrop-blur-sm transition-opacity">
      <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-10 duration-300 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">编辑账户</h2>
          <button onClick={onClose} className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700/50">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">账户名称</label>
            <input 
              type="text" 
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="例如：招商银行储蓄卡"
              className="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">账户类型</label>
            <CustomSelect 
              value={type} 
              onChange={val => setType(val)}
              options={typeOptions}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">资金分类</label>
            <CustomSelect 
              value={fundType} 
              onChange={val => setFundType(val)}
              options={fundTypeOptions}
            />
          </div>
 
           {fundType === 'investment' && (
             <div>
               <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">目标仓位比例 (%)</label>
               <input 
                 type="number" 
                 min="0"
                 max="100"
                 step="1"
                 value={targetRatio}
                 onChange={e => setTargetRatio(e.target.value)}
                 placeholder="例如：30 (账户目标在投资总盘子中的比重)"
                 className="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
               />
             </div>
           )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">当前余额</label>
            <input 
              type="number" 
              step="0.01"
              value={balance}
              onChange={e => setBalance(e.target.value)}
              placeholder="0.00"
              className="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100">折叠账户</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-0.5">在资产列表中折叠显示此账户</p>
            </div>
            <button
              type="button"
              onClick={() => setIsHidden(!isHidden)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isHidden ? 'bg-emerald-500' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isHidden ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {type === 'auto_deposit' && (
            <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">自动入账设置</h4>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">每月入账金额</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={autoDepositAmount}
                  onChange={e => setAutoDepositAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">每月入账日 (1-31)</label>
                <input 
                  type="number" 
                  min="1"
                  max="31"
                  value={autoDepositDay}
                  onChange={e => setAutoDepositDay(e.target.value)}
                  placeholder="15"
                  className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
                />
              </div>
            </div>
          )}

          <div className="pt-4 space-y-3">
            <button 
              type="submit"
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 transition-colors flex items-center justify-center space-x-2"
            >
              <Check size={20} />
              <span>保存修改</span>
            </button>

            {showConfirm ? (
              <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <p className="text-center text-red-500 font-medium text-sm">删除账户将无法恢复，确定删除吗？</p>
                <div className="flex space-x-3">
                  <button type="button" onClick={() => setShowConfirm(false)} className="flex-1 py-3 bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-200 font-bold rounded-xl hover:bg-gray-200 transition-colors">
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
                className="w-full py-4 bg-red-50 dark:bg-red-950/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 font-bold rounded-xl transition-colors flex items-center justify-center space-x-2"
              >
                <Trash2 size={20} />
                <span>删除账户</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
