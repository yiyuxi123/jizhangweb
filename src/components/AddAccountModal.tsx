import React, { useState } from 'react';
import { X, Check } from '../utils/icons';
import { useStore } from '../store/useStore';

export default function AddAccountModal({ onClose }: { onClose: () => void }) {
  const { addAccount, accounts } = useStore();
  const [name, setName] = useState('');
  const [type, setType] = useState<'cash' | 'bank' | 'alipay' | 'wechat' | 'credit' | 'auto_deposit'>('bank');
  const [balance, setBalance] = useState('');
  const [autoDepositAmount, setAutoDepositAmount] = useState('');
  const [autoDepositDay, setAutoDepositDay] = useState('');
  const [fundType, setFundType] = useState<'working' | 'investment' | 'unavailable'>('working');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    if (accounts.some(a => a.name === name)) {
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

    addAccount({
      name,
      type,
      balance: Math.round((Number(balance) || 0) * 100) / 100,
      color,
      icon,
      autoDepositAmount: type === 'auto_deposit' && autoDepositAmount ? Number(autoDepositAmount) : undefined,
      autoDepositDay: type === 'auto_deposit' && autoDepositDay ? Number(autoDepositDay) : undefined,
      fundType
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/40 backdrop-blur-sm transition-opacity">
      <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-10 duration-300 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">添加账户</h2>
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
            <select 
              value={type} 
              onChange={e => setType(e.target.value as any)}
              className="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            >
              <option value="bank">银行卡</option>
              <option value="cash">现金</option>
              <option value="alipay">支付宝</option>
              <option value="wechat">微信</option>
              <option value="credit">信用卡</option>
              <option value="auto_deposit">自动入账 (如公积金/医保)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">资金分类</label>
            <select 
              value={fundType} 
              onChange={e => setFundType(e.target.value as any)}
              className="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            >
              <option value="working">流动资金 (现金/微信/支付宝/储蓄卡等)</option>
              <option value="investment">投资资金 (股票/基金/理财等)</option>
              <option value="unavailable">不可用资金 (定期/冻结/公积金等)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">初始余额</label>
            <input 
              type="number" 
              step="0.01"
              value={balance}
              onChange={e => setBalance(e.target.value)}
              placeholder="0.00"
              className="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
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

          <button 
            type="submit"
            className="w-full py-4 mt-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 transition-colors flex items-center justify-center space-x-2"
          >
            <Check size={20} />
            <span>保存账户</span>
          </button>
        </form>
      </div>
    </div>
  );
}
