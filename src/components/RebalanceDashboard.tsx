import React, { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Sparkles, Scale, TrendingUp, AlertTriangle, CheckCircle2, HelpCircle } from '../utils/icons';
import { motion, AnimatePresence } from 'motion/react';
import {
  calculateDynamicInjection,
  calculatePeriodicRebalance,
  checkThresholdDeviation,
  roundMoney
} from '../utils/rebalanceUtils';
import { getRebalanceAdvice } from '../services/aiService';

// Simple markdown formatter helper to display bold text and list items cleanly
const renderFormattedText = (text: string) => {
  if (!text) return null;
  return text.split('\n').map((line, idx) => {
    let cleanLine = line;
    
    // Header check
    if (cleanLine.startsWith('### ')) {
      return <h4 key={idx} className="text-sm font-bold text-gray-900 dark:text-gray-100 mt-4 mb-2">{cleanLine.replace('### ', '')}</h4>;
    }
    if (cleanLine.startsWith('## ')) {
      return <h3 key={idx} className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-5 mb-3">{cleanLine.replace('## ', '')}</h3>;
    }
    if (cleanLine.startsWith('# ')) {
      return <h2 key={idx} className="text-lg font-bold text-emerald-500 dark:text-emerald-400 mt-6 mb-4">{cleanLine.replace('# ', '')}</h2>;
    }

    // List item check
    let isListItem = false;
    if (cleanLine.startsWith('- ') || cleanLine.startsWith('* ')) {
      isListItem = true;
      cleanLine = cleanLine.substring(2);
    }

    // Bold text parsing (**text**)
    const parts = [];
    let currentIdx = 0;
    const regex = /\*\*(.*?)\*\*/g;
    let match;

    while ((match = regex.exec(cleanLine)) !== null) {
      if (match.index > currentIdx) {
        parts.push(cleanLine.substring(currentIdx, match.index));
      }
      parts.push(<strong key={match.index} className="font-bold text-gray-900 dark:text-gray-50">{match[1]}</strong>);
      currentIdx = regex.lastIndex;
    }

    if (currentIdx < cleanLine.length) {
      parts.push(cleanLine.substring(currentIdx));
    }

    const element = parts.length > 0 ? parts : cleanLine;

    if (isListItem) {
      return (
        <li key={idx} className="list-disc ml-5 my-1 text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
          {element}
        </li>
      );
    }

    return (
      <p key={idx} className="text-xs text-gray-700 dark:text-gray-300 my-1.5 leading-relaxed whitespace-pre-wrap">
        {element}
      </p>
    );
  });
};

export default function RebalanceDashboard() {
  const { accounts, updateAccount, rebalanceConfig, setRebalanceConfig, theme } = useStore();
  const [newFunds, setNewFunds] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);

  // 1. Filter out investment accounts
  const investmentAccounts = useMemo(() => {
    return accounts.filter(a => a.fundType === 'investment' && !a.isHidden);
  }, [accounts]);

  // 2. Sum up balances
  const totalInvestment = useMemo(() => {
    return investmentAccounts.reduce((sum, a) => sum + (a.balance > 0 ? a.balance : 0), 0);
  }, [investmentAccounts]);

  // 3. Sum up target ratios & validate
  const sumTargetRatios = useMemo(() => {
    return investmentAccounts.reduce((sum, a) => sum + (a.targetRatio || 0), 0);
  }, [investmentAccounts]);

  const isRatioValid = sumTargetRatios === 100;

  // 4. Calculate deviations
  const deviations = useMemo(() => {
    const currentBalancesMap: Record<string, number> = {};
    const targetRatiosMap: Record<string, number> = {};
    
    investmentAccounts.forEach(a => {
      currentBalancesMap[a.id] = a.balance > 0 ? a.balance : 0;
      targetRatiosMap[a.id] = a.targetRatio || 0;
    });

    try {
      return checkThresholdDeviation(currentBalancesMap, targetRatiosMap, rebalanceConfig.thresholdValue);
    } catch (e) {
      return [];
    }
  }, [investmentAccounts, rebalanceConfig.thresholdValue]);

  // 5. Dynamic injection results
  const injectionPlan = useMemo(() => {
    if (rebalanceConfig.strategy !== 'dynamic' || !isRatioValid || !newFunds || Number(newFunds) <= 0) return null;
    
    const currentBalancesMap: Record<string, number> = {};
    const targetRatiosMap: Record<string, number> = {};
    investmentAccounts.forEach(a => {
      currentBalancesMap[a.id] = a.balance > 0 ? a.balance : 0;
      targetRatiosMap[a.id] = a.targetRatio || 0;
    });

    try {
      const allocations = calculateDynamicInjection(currentBalancesMap, targetRatiosMap, Number(newFunds));
      return Object.entries(allocations).map(([id, amount]) => {
        const acc = investmentAccounts.find(a => a.id === id);
        return {
          id,
          name: acc?.name || '未知账户',
          amount
        };
      }).filter(item => item.amount > 0);
    } catch (e) {
      return null;
    }
  }, [investmentAccounts, rebalanceConfig.strategy, isRatioValid, newFunds]);

  // 6. Periodic rebalance results
  const periodicPlan = useMemo(() => {
    if (rebalanceConfig.strategy !== 'periodic' || !isRatioValid) return null;

    const currentBalancesMap: Record<string, number> = {};
    const targetRatiosMap: Record<string, number> = {};
    investmentAccounts.forEach(a => {
      currentBalancesMap[a.id] = a.balance > 0 ? a.balance : 0;
      targetRatiosMap[a.id] = a.targetRatio || 0;
    });

    try {
      const actions = calculatePeriodicRebalance(currentBalancesMap, targetRatiosMap);
      return actions.map(act => {
        const acc = investmentAccounts.find(a => a.id === act.accountId);
        return {
          ...act,
          name: acc?.name || '未知账户',
          color: acc?.color || '#cbd5e1'
        };
      }).filter(a => a.action !== 'hold');
    } catch (e) {
      return null;
    }
  }, [investmentAccounts, rebalanceConfig.strategy, isRatioValid]);

  // Recharts theme colors
  const isDark = useMemo(() => {
    if (theme === 'dark') return true;
    if (theme === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }, [theme]);

  // Pie chart data
  const pieDataActual = useMemo(() => {
    if (totalInvestment === 0) {
      return [{ name: '无资金', value: 1, color: '#94a3b8' }];
    }
    return investmentAccounts.map(a => ({
      name: a.name,
      value: a.balance > 0 ? a.balance : 0,
      color: a.color
    }));
  }, [investmentAccounts, totalInvestment]);

  const pieDataTarget = useMemo(() => {
    if (sumTargetRatios === 0) {
      return [{ name: '未设定占比', value: 1, color: '#94a3b8' }];
    }
    return investmentAccounts.map(a => ({
      name: a.name,
      value: a.targetRatio || 0,
      color: a.color
    })).filter(item => item.value > 0);
  }, [investmentAccounts, sumTargetRatios]);

  // Ask AI for quant advice
  const handleAiAdvice = async () => {
    if (!isRatioValid || investmentAccounts.length === 0) return;
    
    setAiLoading(true);
    setAiAdvice(null);
    setShowAiModal(true);

    try {
      const currentBalancesList = investmentAccounts.map(a => {
        const devDetail = deviations.find(d => d.accountId === a.id);
        return {
          name: a.name,
          balance: a.balance > 0 ? a.balance : 0,
          currentRatio: devDetail?.currentRatio || 0,
          targetRatio: a.targetRatio || 0,
          deviation: devDetail?.deviation || 0
        };
      });

      let strategyParams: any = {};
      if (rebalanceConfig.strategy === 'dynamic') {
        strategyParams.newFunds = Number(newFunds) || 0;
        strategyParams.actions = (injectionPlan || []).map(p => ({
          name: p.name,
          action: 'buy',
          amount: p.amount
        }));
      } else if (rebalanceConfig.strategy === 'periodic') {
        strategyParams.actions = (periodicPlan || []).map(p => ({
          name: p.name,
          action: p.action,
          amount: p.amount
        }));
      } else if (rebalanceConfig.strategy === 'threshold') {
        strategyParams.thresholdValue = rebalanceConfig.thresholdValue;
      }

      const advice = await getRebalanceAdvice(
        currentBalancesList,
        rebalanceConfig.strategy,
        strategyParams
      );
      setAiAdvice(advice);
    } catch (error) {
      console.error(error);
      setAiAdvice('AI 投顾连接失败，请确认您已在设置中配置了有效的 DeepSeek API Key，并检查您的网络连接。');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Ratio Validation Warnings */}
      {investmentAccounts.length === 0 ? (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 p-5 rounded-3xl text-center">
          <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
            <Scale size={24} className="text-amber-500" />
          </div>
          <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-1">未检测到理财账户</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto leading-relaxed">
            请前往“账户管理”添加账户或编辑现有账户，将“资金分类”设为**【投资资金】**以启用再平衡监控。
          </p>
        </div>
      ) : !isRatioValid ? (
        <div className="bg-red-50 dark:bg-red-950/15 border border-red-200/50 dark:border-red-900/30 p-5 rounded-3xl flex items-start space-x-3.5">
          <AlertTriangle size={24} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-red-800 dark:text-red-400 text-sm">目标占比配置错误</h4>
            <p className="text-xs text-red-700/80 dark:text-red-300/80 mt-1 leading-relaxed">
              当前所有理财账户的目标比例总和为 **{sumTargetRatios}%**。为了执行合理的资产配平，各投资账户的目标比例总和**必须等于 100%**。请修改相关账户的目标配比。
            </p>
          </div>
        </div>
      ) : null}

      {investmentAccounts.length > 0 && (
        <>
          {/* 2. Compare Charts */}
          <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
              <TrendingUp size={20} className="text-emerald-500" />
              <span>持仓占比对比</span>
            </h3>
            
            <div className="grid grid-cols-2 gap-4 h-48">
              <div className="flex flex-col items-center justify-center h-full relative">
                <ResponsiveContainer width="100%" height="80%">
                  <PieChart>
                    <Pie
                      data={pieDataActual}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={50}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieDataActual.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(val: number) => `¥${val.toFixed(2)}`}
                      contentStyle={{ background: isDark ? '#1f2937' : '#ffffff', border: 'none', borderRadius: '12px', fontSize: '10px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute top-[40%] text-center pointer-events-none">
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold leading-none">实际</p>
                  <p className="text-xs font-bold text-gray-900 dark:text-gray-100 mt-0.5">¥{totalInvestment.toFixed(0)}</p>
                </div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-1">实际持仓</p>
              </div>

              <div className="flex flex-col items-center justify-center h-full relative">
                <ResponsiveContainer width="100%" height="80%">
                  <PieChart>
                    <Pie
                      data={pieDataTarget}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={50}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieDataTarget.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(val: number) => `${val}%`}
                      contentStyle={{ background: isDark ? '#1f2937' : '#ffffff', border: 'none', borderRadius: '12px', fontSize: '10px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute top-[40%] text-center pointer-events-none">
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold leading-none">目标</p>
                  <p className="text-xs font-bold text-gray-900 dark:text-gray-100 mt-0.5">{sumTargetRatios}%</p>
                </div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-1">目标配置</p>
              </div>
            </div>
          </div>

          {/* 3. Account Deviation List */}
          <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center justify-between">
              <span>资产分布及偏差</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 font-medium text-gray-400">
                总额: ¥{totalInvestment.toFixed(2)}
              </span>
            </h3>
            
            <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {investmentAccounts.map(account => {
                const devDetail = deviations.find(d => d.accountId === account.id);
                const currentRatio = devDetail?.currentRatio || 0;
                const targetRatio = account.targetRatio || 0;
                const deviation = devDetail?.deviation || 0;

                const isDeviated = Math.abs(deviation) >= rebalanceConfig.thresholdValue;

                return (
                  <div key={account.id} className="py-3.5 flex items-center justify-between">
                    <div className="flex items-center space-x-3 min-w-0 pr-2">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: account.color }} />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{account.name}</p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                          余额: ¥{account.balance.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-6 shrink-0">
                      <div className="text-right">
                        <p className="text-xs font-bold text-gray-900 dark:text-gray-100">
                          {currentRatio.toFixed(1)}% <span className="text-gray-300 dark:text-gray-600 font-normal">/</span> {targetRatio}%
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">实际 / 目标</p>
                      </div>

                      <div className="text-right w-16">
                        <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${
                          deviation === 0 
                            ? 'text-gray-500 bg-gray-50 dark:bg-gray-900' 
                            : deviation > 0 
                              ? 'text-red-600 bg-red-50 dark:bg-red-950/15' 
                              : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/15'
                        }`}>
                          {deviation > 0 ? `+${deviation.toFixed(1)}` : deviation.toFixed(1)}%
                        </span>
                        {isRatioValid && isDeviated && (
                          <span className="block text-[8px] text-red-500 font-bold mt-0.5 animate-pulse">
                            超偏离度 ⚠️
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Rebalance config panel */}
          <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center space-x-2">
              <Scale size={20} className="text-emerald-500" />
              <span>策略控制台</span>
            </h3>

            {/* Strategy Select Tabs */}
            <div className="grid grid-cols-3 gap-2 bg-gray-50 dark:bg-gray-900 p-1 rounded-2xl border border-gray-100 dark:border-gray-700">
              <button
                onClick={() => setRebalanceConfig({ strategy: 'dynamic' })}
                className={`py-2 text-[11px] font-bold rounded-xl transition-all ${
                  rebalanceConfig.strategy === 'dynamic'
                    ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
              >
                增量注入
              </button>
              <button
                onClick={() => setRebalanceConfig({ strategy: 'periodic' })}
                className={`py-2 text-[11px] font-bold rounded-xl transition-all ${
                  rebalanceConfig.strategy === 'periodic'
                    ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
              >
                存量调仓
              </button>
              <button
                onClick={() => setRebalanceConfig({ strategy: 'threshold' })}
                className={`py-2 text-[11px] font-bold rounded-xl transition-all ${
                  rebalanceConfig.strategy === 'threshold'
                    ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
              >
                阈值监控
              </button>
            </div>

            {/* Dynamic injection details */}
            {rebalanceConfig.strategy === 'dynamic' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                    追加投资金额 (CNY)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    disabled={!isRatioValid}
                    value={newFunds}
                    onChange={e => setNewFunds(e.target.value)}
                    placeholder="请输入准备追加投入的新资金"
                    className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm disabled:opacity-50"
                  />
                </div>

                {isRatioValid && injectionPlan && injectionPlan.length > 0 && (
                  <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/10 rounded-2xl border border-emerald-100/30">
                    <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-2 flex items-center space-x-1.5">
                      <CheckCircle2 size={14} />
                      <span>增量资金分配方案</span>
                    </h4>
                    <ul className="space-y-1.5">
                      {injectionPlan.map(item => (
                        <li key={item.id} className="text-xs text-gray-600 dark:text-gray-300 flex justify-between">
                          <span>将资金注入到：**{item.name}**</span>
                          <span className="font-bold text-gray-800 dark:text-gray-100">¥{item.amount.toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Periodic stock rebalancing */}
            {rebalanceConfig.strategy === 'periodic' && (
              <div className="space-y-3">
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  存量一键配平策略通过卖出已经超配的资产，买入低配的资产，在不追加新资金的前提下，直接配平至目标比率。
                </p>

                {isRatioValid && periodicPlan && (
                  periodicPlan.length === 0 ? (
                    <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/10 rounded-2xl border border-emerald-100/30 text-center text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                      当前配置比例已极其完美，无需进行存量调仓 🎉
                    </div>
                  ) : (
                    <div className="p-4 bg-emerald-50/30 dark:bg-emerald-950/5 rounded-2xl border border-gray-100 dark:border-gray-700/50">
                      <h4 className="text-xs font-bold text-gray-900 dark:text-gray-200 mb-2">生成存量调仓指南</h4>
                      <ul className="space-y-2">
                        {periodicPlan.map(item => (
                          <li key={item.accountId} className="text-xs flex items-center justify-between py-1.5 border-b border-gray-50 dark:border-gray-800 last:border-0">
                            <span className="flex items-center space-x-1.5">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                              <span>{item.name}</span>
                            </span>
                            <span className="font-bold">
                              {item.action === 'sell' ? (
                                <span className="text-red-500">卖出 ¥{item.amount.toFixed(2)}</span>
                              ) : (
                                <span className="text-emerald-500">买入 ¥{item.amount.toFixed(2)}</span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                )}
              </div>
            )}

            {/* Threshold check config */}
            {rebalanceConfig.strategy === 'threshold' && (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                      资产偏离度触发阈值: <strong className="text-gray-900 dark:text-gray-250 font-bold">{rebalanceConfig.thresholdValue}%</strong>
                    </label>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="1"
                    disabled={!isRatioValid}
                    value={rebalanceConfig.thresholdValue}
                    onChange={e => setRebalanceConfig({ thresholdValue: Number(e.target.value) })}
                    className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-50"
                  />
                  <p className="text-[10px] text-gray-400 leading-normal mt-1.5">
                    只要有任意一档资产的实际占比与目标比率的差值达到此数值，列表将报警预警。
                  </p>
                </div>

                {isRatioValid && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700 flex flex-col space-y-1.5">
                    <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-200">偏离度监控状态</h4>
                    {deviations.some(d => d.isOverThreshold) ? (
                      <p className="text-xs text-red-500 font-bold flex items-center space-x-1.5">
                        <AlertTriangle size={14} />
                        <span>检测到有资产触发了报警偏离度（偏差值 &ge; {rebalanceConfig.thresholdValue}%）</span>
                      </p>
                    ) : (
                      <p className="text-xs text-emerald-500 font-semibold flex items-center space-x-1.5">
                        <CheckCircle2 size={14} />
                        <span>各资产运行平衡，均在阈值监控范围内。</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* AI Suggestion Activation button */}
            <button
              onClick={handleAiAdvice}
              disabled={!isRatioValid || aiLoading}
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-bold rounded-xl shadow-lg disabled:shadow-none hover:shadow-emerald-500/20 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:cursor-not-allowed text-sm mt-2"
            >
              <Sparkles size={18} className={aiLoading ? 'animate-pulse' : ''} />
              <span>{aiLoading ? 'AI 正在全力解析中...' : '💡 唤醒 AI 投顾建议'}</span>
            </button>
          </div>
        </>
      )}

      {/* 5. AI Advisor Report Dialog Modal */}
      <AnimatePresence>
        {showAiModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.25 }}
              className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-gray-100 dark:border-gray-700"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/10">
                <div className="flex items-center space-x-2">
                  <Sparkles className="text-emerald-500 animate-pulse" size={20} />
                  <h3 className="font-bold text-gray-900 dark:text-gray-100">AI 智能再平衡投资报告</h3>
                </div>
                <button
                  onClick={() => setShowAiModal(false)}
                  disabled={aiLoading}
                  className="text-gray-400 hover:text-gray-600 dark:text-gray-300 rounded-full p-1.5 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
                >
                  关闭
                </button>
              </div>

              {/* Modal Body / Report details */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
                {aiLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <div className="relative w-16 h-16 flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 animate-ping" />
                      <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
                      <Sparkles className="text-emerald-500" size={24} />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">大模型正在对齐投资配置...</p>
                      <p className="text-xs text-gray-400 mt-1 max-w-[280px]">
                        基于您的实际持仓和再平衡模型计算最佳调仓计划，提供反人性心理引导与交易风控。
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="prose dark:prose-invert max-w-none text-left">
                    {renderFormattedText(aiAdvice || '')}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                <button
                  onClick={() => setShowAiModal(false)}
                  disabled={aiLoading}
                  className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 font-bold rounded-xl transition-colors text-xs"
                >
                  确认知晓
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
