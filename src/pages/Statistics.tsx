import { useState, useMemo, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval, parseISO, subMonths, addMonths, subYears, addYears } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Sector, AreaChart, Area } from 'recharts';
import { Sparkles, ChevronLeft, ChevronRight, PieChart as PieChartIcon, BarChart2, TrendingUp, Scale, Wallet, Tags, Icons } from '../utils/icons';
import { motion, AnimatePresence } from 'motion/react';
import AiChatModal from '../components/AiChatModal';

const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        className="transition-all duration-300 ease-out"
      />
    </g>
  );
};

const METRICS_CONFIG = [
  { key: 'insights', label: '智能洞察', icon: Sparkles },
  { key: 'category', label: '分类占比', icon: PieChartIcon },
  { key: 'dailyAverage', label: '日均统计', icon: BarChart2 },
  { key: 'trend', label: '收支趋势', icon: BarChart2 },
  { key: 'assetTrend', label: '资产趋势', icon: TrendingUp },
  { key: 'fixedVsVariable', label: '固定/浮动', icon: Scale, expenseOnly: true as boolean },
  { key: 'account', label: '账户分布', icon: Wallet },
  { key: 'tags', label: '标签统计', icon: Tags },
] as const;

export default function Statistics() {
  const { transactions, categories, budgets, accounts, theme } = useStore();
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  
  const isDark = useMemo(() => {
    if (theme === 'dark') return true;
    if (theme === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }, [theme]);
  
  const [visibleMetrics, setVisibleMetrics] = useState(() => {
    const saved = localStorage.getItem('statistics_visible_metrics');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      insights: true,
      category: true,
      dailyAverage: true,
      trend: true,
      fixedVsVariable: true,
      account: false,
      assetTrend: true,
      tags: false,
    };
  });

  const [dailyAverageCategories, setDailyAverageCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('statistics_daily_average_categories');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return []; // Empty means all categories are included by default, or maybe we should store excluded? Let's store included.
  });

  useEffect(() => {
    localStorage.setItem('statistics_visible_metrics', JSON.stringify(visibleMetrics));
  }, [visibleMetrics]);

  useEffect(() => {
    localStorage.setItem('statistics_daily_average_categories', JSON.stringify(dailyAverageCategories));
  }, [dailyAverageCategories]);

  const toggleMetric = (key: keyof typeof visibleMetrics) => {
    setVisibleMetrics((prev: any) => ({ ...prev, [key]: !prev[key] }));
  };

  const [activeIndexCategory, setActiveIndexCategory] = useState<number | undefined>(undefined);
  const [activeIndexFixed, setActiveIndexFixed] = useState<number | undefined>(undefined);
  const [activeIndexAccount, setActiveIndexAccount] = useState<number | undefined>(undefined);

  const { start, end } = useMemo(() => {
    return {
      start: period === 'month' ? startOfMonth(selectedDate) : startOfYear(selectedDate),
      end: period === 'month' ? endOfMonth(selectedDate) : endOfYear(selectedDate)
    };
  }, [period, selectedDate]);

  const handlePrev = () => {
    setSelectedDate(prev => period === 'month' ? subMonths(prev, 1) : subYears(prev, 1));
  };

  const handleNext = () => {
    setSelectedDate(prev => period === 'month' ? addMonths(prev, 1) : addYears(prev, 1));
  };

  const dateLabel = useMemo(() => period === 'month' ? format(selectedDate, 'yyyy年MM月') : format(selectedDate, 'yyyy年'), [period, selectedDate]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const d = new Date(t.date);
      const cat = categories.find(c => c.id === t.categoryId);
      return t.type === type && isWithinInterval(d, { start, end }) && !cat?.excludeFromStats;
    });
  }, [transactions, type, start, end, categories]);

  const total = useMemo(() => filteredTransactions.reduce((sum, t) => sum + t.amount, 0), [filteredTransactions]);

  // Group by category
  const chartData = useMemo(() => {
    const categoryData = filteredTransactions.reduce((acc, t) => {
      const cat = categories.find(c => c.id === t.categoryId);
      if (!cat) return acc;
      
      if (!acc[cat.id]) {
        acc[cat.id] = { name: cat.name, value: 0, color: cat.color, icon: cat.icon };
      }
      acc[cat.id].value += t.amount;
      return acc;
    }, {} as Record<string, { name: string, value: number, color: string, icon: string }>);

    return Object.values(categoryData).sort((a: any, b: any) => b.value - a.value);
  }, [filteredTransactions, categories]);

  // Trend data for bar chart
  const barData = useMemo(() => {
    const trendData = filteredTransactions.reduce((acc, t) => {
      const key = period === 'month' ? format(parseISO(t.date), 'dd') : format(parseISO(t.date), 'MM');
      if (!acc[key]) acc[key] = { name: key, value: 0 };
      acc[key].value += t.amount;
      return acc;
    }, {} as Record<string, { name: string, value: number }>);

    return Object.values(trendData).sort((a: any, b: any) => Number(a.name) - Number(b.name));
  }, [filteredTransactions, period]);

  // Fixed vs Variable data
  const fixedVsVariableChartData = useMemo(() => {
    const fixedData = filteredTransactions.reduce((acc, t) => {
      const cat = categories.find(c => c.id === t.categoryId);
      if (cat?.isFixed) {
        acc.fixed += t.amount;
      } else {
        acc.variable += t.amount;
      }
      return acc;
    }, { fixed: 0, variable: 0 });

    return [
      { name: '固定支出', value: fixedData.fixed, color: '#3b82f6' },
      { name: '浮动支出', value: fixedData.variable, color: '#f59e0b' }
    ].filter(d => d.value > 0);
  }, [filteredTransactions, categories]);

  // Account data
  const accountChartData = useMemo(() => {
    const accountData = filteredTransactions.reduce((acc, t) => {
      const accountId = type === 'expense' ? t.fromAccountId : t.toAccountId;
      if (!accountId) return acc;
      const account = accounts.find(a => a.id === accountId);
      if (!account) return acc;
      
      if (!acc[account.id]) {
        acc[account.id] = { name: account.name, value: 0, color: account.color, icon: account.icon };
      }
      acc[account.id].value += t.amount;
      return acc;
    }, {} as Record<string, { name: string, value: number, color: string, icon: string }>);

    return Object.values(accountData).sort((a: any, b: any) => b.value - a.value);
  }, [filteredTransactions, type, accounts]);

  // Tag data
  const tagChartData = useMemo(() => {
    const tagData = filteredTransactions.reduce((acc, t) => {
      if (t.tags && t.tags.length > 0) {
        t.tags.forEach(tag => {
          if (!acc[tag]) {
            acc[tag] = { name: tag, value: 0 };
          }
          acc[tag].value += t.amount;
        });
      } else {
        if (!acc['无标签']) {
          acc['无标签'] = { name: '无标签', value: 0 };
        }
        acc['无标签'].value += t.amount;
      }
      return acc;
    }, {} as Record<string, { name: string, value: number }>);

    return Object.values(tagData).sort((a: any, b: any) => b.value - a.value);
  }, [filteredTransactions]);

  // Insights calculations
  const maxCategory = useMemo(() => chartData.length > 0 ? chartData[0] : null, [chartData]);
  const maxTrend = useMemo(() => barData.length > 0 ? barData.reduce((max, d) => d.value > max.value ? d : max, barData[0]) : null, [barData]);
  const totalBudget = useMemo(() => {
    const baseBudget = budgets.find(b => !b.categoryId)?.amount || 0;
    return period === 'month' ? baseBudget : baseBudget * 12;
  }, [budgets, period]);

  const budgetTotal = useMemo(() => {
    return filteredTransactions.reduce((sum, t) => {
      const cat = categories.find(c => c.id === t.categoryId);
      if (cat?.excludeFromBudget) return sum;
      return sum + t.amount;
    }, 0);
  }, [filteredTransactions, categories]);

  // Total Asset Trend (Past 12 Months)
  const assetTrendData = useMemo(() => {
    const currentTotalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
    
    const last12Months = Array.from({ length: 12 }).map((_, i) => {
      return format(subMonths(new Date(), i), 'yyyy-MM');
    }).reverse();

    return last12Months.map(month => {
      const futureNetFlow = transactions
        .filter(t => format(parseISO(t.date), 'yyyy-MM') > month)
        .reduce((sum, t) => {
          if (t.type === 'income') return sum + t.amount;
          if (t.type === 'expense') return sum - t.amount;
          return sum;
        }, 0);
        
      return {
        name: `${parseInt(month.split('-')[1])}月`,
        fullMonth: month,
        value: currentTotalBalance - futureNetFlow
      };
    });
  }, [accounts, transactions]);

  return (
    <div className="p-4 space-y-6 max-w-md mx-auto">
      {/* Header */}
      <header className="pt-4 pb-2">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">统计分析</h1>
          <button
            onClick={() => setIsAiChatOpen(true)}
            className="px-3.5 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-bold rounded-full transition-colors flex items-center space-x-1 shadow-md"
          >
            <Icons.Sparkles size={14} className="text-yellow-300" />
            <span>AI 分析助手</span>
          </button>
        </div>
        
        {/* Period & Type Controls */}
        <div className="space-y-3">
          <div className="flex space-x-2 bg-gray-100 dark:bg-gray-700/50 p-1 rounded-xl w-full max-w-xs mx-auto">
            {(['month', 'year'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  period === p 
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {p === 'month' ? '月度统计' : '年度统计'}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl p-2 shadow-sm border border-gray-100 dark:border-gray-700">
            <button onClick={handlePrev} className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg transition-colors">
              <ChevronLeft size={20} />
            </button>
            <span className="font-bold text-gray-900 dark:text-gray-100">{dateLabel}</span>
            <button onClick={handleNext} className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg transition-colors">
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="flex space-x-2 bg-gray-100 dark:bg-gray-700/50 p-1 rounded-xl w-full max-w-xs mx-auto">
            {(['expense', 'income'] as const).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  type === t 
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {t === 'expense' ? '支出' : '收入'}
              </button>
            ))}
          </div>

          {/* Metrics Toggles */}
          <div className="mt-6">
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-3 px-1">显示模块</p>
            <div className="flex overflow-x-auto pb-2 -mx-4 px-4 space-x-2 scrollbar-hide">
              {METRICS_CONFIG.map(metric => {
                if ('expenseOnly' in metric && metric.expenseOnly && type !== 'expense') return null;
                const isActive = visibleMetrics[metric.key as keyof typeof visibleMetrics];
                const Icon = metric.icon;
                
                return (
                  <button
                    key={metric.key}
                    onClick={() => toggleMetric(metric.key as keyof typeof visibleMetrics)}
                    className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                      isActive 
                        ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 shadow-md' 
                        : 'bg-white text-gray-500 border border-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <Icon size={16} className={isActive ? 'text-emerald-400' : 'text-gray-400'} />
                    <span>{metric.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      {/* Total Card */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 text-center"
      >
        <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-2">{period === 'month' ? '本月' : '本年'}总{type === 'expense' ? '支出' : '收入'}</p>
        <h2 className={`text-4xl font-bold ${type === 'expense' ? 'text-gray-900 dark:text-gray-100' : 'text-emerald-500'}`}>
          ¥{total.toFixed(2)}
        </h2>
      </motion.div>

      <AnimatePresence mode="popLayout">
        {/* Smart Insights */}
        {visibleMetrics.insights && type === 'expense' && filteredTransactions.length > 0 && (
          <motion.div 
            key="insights"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-3xl shadow-sm text-white space-y-4"
          >
            <div className="flex items-center space-x-2 mb-2">
              <Sparkles size={20} className="text-yellow-300" />
              <h3 className="text-lg font-bold">{period === 'month' ? '本月' : '本年'}消费洞察</h3>
            </div>
            
            <div className="space-y-3">
              {maxCategory && (
                <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm">
                  <p className="text-indigo-100 text-xs mb-1">🔥 最大开销分类</p>
                  <p className="font-medium">
                    <span className="text-xl font-bold">{maxCategory.name}</span> 
                    <span className="ml-2">¥{maxCategory.value.toFixed(2)}</span>
                    <span className="text-indigo-200 text-sm ml-2">占 {((maxCategory.value / total) * 100).toFixed(1)}%</span>
                  </p>
                </div>
              )}
              
              {maxTrend && (
                <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm">
                  <p className="text-indigo-100 text-xs mb-1">📅 最高消费{period === 'month' ? '日' : '月'}</p>
                  <p className="font-medium">
                    <span className="text-xl font-bold">{maxTrend.name}{period === 'month' ? '日' : '月'}</span> 
                    <span className="ml-2">¥{maxTrend.value.toFixed(2)}</span>
                  </p>
                </div>
              )}

              {totalBudget > 0 && (
                <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm">
                  <p className="text-indigo-100 text-xs mb-1">💰 预算健康度</p>
                  <p className="font-medium">
                    {budgetTotal > totalBudget ? (
                      <span className="text-red-300">已超支 ¥{(budgetTotal - totalBudget).toFixed(2)}，请注意控制！</span>
                    ) : (
                      <span className="text-emerald-300">预算剩余 ¥{(totalBudget - budgetTotal).toFixed(2)}，继续保持！</span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Pie Chart */}
        {visibleMetrics.category && (chartData.length > 0 ? (
          <motion.div 
            key="category-chart"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-gray-800 p-4 rounded-3xl shadow-sm border border-gray-100"
          >
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 px-2">分类占比</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  activeIndex={activeIndexCategory}
                  activeShape={renderActiveShape}
                  onMouseEnter={(_, index) => setActiveIndexCategory(index)}
                  onClick={(_, index) => setActiveIndexCategory(index)}
                  onMouseLeave={() => setActiveIndexCategory(undefined)}
                  isAnimationActive={true}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`category-cell-${index}`} fill={entry.color} className="outline-none" />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => `¥${value.toFixed(2)}`}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Daily Average */}
          {visibleMetrics.dailyAverage && chartData.length > 0 && (
            <motion.div 
              key="daily-average"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 p-4 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 mt-6"
            >
              <div className="flex justify-between items-center mb-4 px-2">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">日均统计</h3>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {period === 'month' ? '本月' : '本年'}共 {period === 'month' ? new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate() : (isWithinInterval(new Date(), { start, end }) ? Math.ceil((new Date().getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) : 365)} 天
                </div>
              </div>
              
              <div className="space-y-3">
                {chartData.map((item, index) => {
                  const IconComponent = (Icons as any)[item.icon] || Icons.HelpCircle;
                  const isIncluded = dailyAverageCategories.length === 0 || dailyAverageCategories.includes(item.name);
                  const days = period === 'month' ? new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate() : (isWithinInterval(new Date(), { start, end }) ? Math.ceil((new Date().getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) : 365);
                  const dailyAvg = item.value / Math.max(1, days);
                  
                  return (
                    <div key={index} className={`flex items-center justify-between p-2 rounded-xl transition-colors ${isIncluded ? 'bg-gray-50 dark:bg-gray-700/30' : 'opacity-50 grayscale'}`}>
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => {
                            setDailyAverageCategories(prev => {
                              if (prev.length === 0) {
                                // If empty, it means all were included. Now we exclude this one, so we include all others.
                                return chartData.filter(c => c.name !== item.name).map(c => c.name);
                              }
                              if (prev.includes(item.name)) {
                                const newArr = prev.filter(n => n !== item.name);
                                return newArr.length === 0 ? ['__NONE__'] : newArr; // Hack to keep it from resetting to all
                              } else {
                                const newArr = prev.filter(n => n !== '__NONE__');
                                return [...newArr, item.name];
                              }
                            });
                          }}
                          className={`w-5 h-5 rounded flex items-center justify-center border ${isIncluded ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 text-transparent'}`}
                        >
                          <Icons.Check size={14} />
                        </button>
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                          style={{ backgroundColor: item.color }}
                        >
                          <IconComponent size={16} />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">{item.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900 dark:text-gray-100">¥{dailyAvg.toFixed(2)}<span className="text-xs text-gray-500 dark:text-gray-400 font-normal"> /天</span></p>
                      </div>
                    </div>
                  );
                })}
                
                <div className="pt-3 mt-3 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center px-2">
                  <span className="font-bold text-gray-900 dark:text-gray-100">合计日均</span>
                  <span className="font-bold text-lg text-emerald-500">
                    ¥{(chartData.filter(c => dailyAverageCategories.length === 0 || dailyAverageCategories.includes(c.name)).reduce((sum, c) => sum + c.value, 0) / Math.max(1, period === 'month' ? new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate() : (isWithinInterval(new Date(), { start, end }) ? Math.ceil((new Date().getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) : 365))).toFixed(2)}
                    <span className="text-sm text-gray-500 dark:text-gray-400 font-normal"> /天</span>
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Category List */}
          <div className="mt-4 space-y-3">
            {chartData.map((item, index) => {
              const IconComponent = (Icons as any)[item.icon] || Icons.HelpCircle;
              const percent = ((item.value / total) * 100).toFixed(1);
              
              return (
                <div key={index} className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-xl transition-colors">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                      style={{ backgroundColor: item.color }}
                    >
                      <IconComponent size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-gray-100">{item.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{percent}%</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900 dark:text-gray-100">¥{item.value.toFixed(2)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      ) : (
        <motion.div 
          key="category-empty"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-gray-800 p-12 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 text-center text-gray-400"
        >
          暂无数据
        </motion.div>
      ))}

      {/* Fixed vs Variable Chart */}
      {visibleMetrics.fixedVsVariable && type === 'expense' && fixedVsVariableChartData.length > 0 && (
        <motion.div 
          key="fixed-variable"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-gray-800 p-4 rounded-3xl shadow-sm border border-gray-100"
        >
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 px-2">固定 vs 浮动支出</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={fixedVsVariableChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={60}
                  paddingAngle={5}
                  dataKey="value"
                  activeIndex={activeIndexFixed}
                  activeShape={renderActiveShape}
                  onMouseEnter={(_, index) => setActiveIndexFixed(index)}
                  onClick={(_, index) => setActiveIndexFixed(index)}
                  onMouseLeave={() => setActiveIndexFixed(undefined)}
                  isAnimationActive={true}
                >
                  {fixedVsVariableChartData.map((entry, index) => (
                    <Cell key={`fixed-cell-${index}`} fill={entry.color} className="outline-none" />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => `¥${value.toFixed(2)}`}
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    backgroundColor: isDark ? '#1f2937' : '#ffffff',
                    color: isDark ? '#f3f4f6' : '#111827'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center space-x-6 mt-2">
            {fixedVsVariableChartData.map((item, index) => (
              <div key={index} className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-sm text-gray-600 dark:text-gray-300">{item.name}</span>
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">¥{item.value.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Bar Chart */}
      {visibleMetrics.trend && barData.length > 0 && (
        <motion.div 
          key="trend"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-gray-800 p-4 rounded-3xl shadow-sm border border-gray-100"
        >
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 px-2">收支趋势</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#374151' : '#f3f4f6'} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <YAxis hide />
                <Tooltip 
                  cursor={{ fill: isDark ? '#1f2937' : '#f9fafb' }}
                  formatter={(value: number) => [`¥${value.toFixed(2)}`, type === 'expense' ? '支出' : '收入']}
                  labelFormatter={(label) => `${label}${period === 'month' ? '日' : '月'}`}
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    backgroundColor: isDark ? '#1f2937' : '#ffffff',
                    color: isDark ? '#f3f4f6' : '#111827'
                  }}
                />
                <Bar 
                  dataKey="value" 
                  fill={type === 'expense' ? (isDark ? '#e5e7eb' : '#111827') : '#10b981'} 
                  radius={[4, 4, 0, 0]} 
                  barSize={8}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* Total Asset Trend Chart */}
      {visibleMetrics.assetTrend && (
        <motion.div 
          key="asset-trend"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-gray-800 p-4 rounded-3xl shadow-sm border border-gray-100"
        >
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 px-2">总资产趋势 (近12个月)</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={assetTrendData}>
                <defs>
                  <linearGradient id="colorAsset" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#374151' : '#f3f4f6'} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#9ca3af' }} 
                  minTickGap={20}
                />
                <YAxis 
                  hide 
                  domain={['auto', 'auto']} 
                />
                <Tooltip 
                  formatter={(value: number) => [`¥${value.toFixed(2)}`, '总资产']}
                  labelFormatter={(label, payload) => payload && payload.length > 0 ? payload[0].payload.fullMonth : label}
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    backgroundColor: isDark ? '#1f2937' : '#ffffff',
                    color: isDark ? '#f3f4f6' : '#111827'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorAsset)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* Account Breakdown Chart */}
      {visibleMetrics.account && (accountChartData.length > 0 ? (
        <motion.div 
          key="account-chart"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-gray-800 p-4 rounded-3xl shadow-sm border border-gray-100"
        >
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 px-2">账户分布</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={accountChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  activeIndex={activeIndexAccount}
                  activeShape={renderActiveShape}
                  onMouseEnter={(_, index) => setActiveIndexAccount(index)}
                  onClick={(_, index) => setActiveIndexAccount(index)}
                  onMouseLeave={() => setActiveIndexAccount(undefined)}
                  isAnimationActive={true}
                >
                  {accountChartData.map((entry, index) => (
                    <Cell key={`account-cell-${index}`} fill={entry.color} className="outline-none" />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => `¥${value.toFixed(2)}`}
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    backgroundColor: isDark ? '#1f2937' : '#ffffff',
                    color: isDark ? '#f3f4f6' : '#111827'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Account List */}
          <div className="mt-4 space-y-3">
            {accountChartData.map((item, index) => {
              const IconComponent = (Icons as any)[item.icon] || Icons.Wallet;
              const percent = ((item.value / total) * 100).toFixed(1);
              
              return (
                <div key={index} className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-750/50 dark:bg-gray-900 rounded-xl transition-colors">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                      style={{ backgroundColor: item.color }}
                    >
                      <IconComponent size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-gray-100">{item.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{percent}%</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900 dark:text-gray-100">¥{item.value.toFixed(2)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      ) : (
        <motion.div 
          key="account-empty"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-gray-800 p-12 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 text-center text-gray-400"
        >
          暂无数据
        </motion.div>
      ))}
        {/* Tags Breakdown */}
        {visibleMetrics.tags && tagChartData.length > 0 && (
          <motion.div 
            key="tags"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700"
          >
            <div className="flex items-center space-x-2 mb-6">
              <Icons.Tag size={20} className="text-purple-500" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">标签统计</h3>
            </div>
            
            <div className="space-y-4">
              {tagChartData.map((item, index) => {
                const percent = ((item.value / total) * 100).toFixed(1);
                const isNoTag = item.name === '无标签';
                
                return (
                  <div key={index} className="relative">
                    <div className="flex justify-between items-end mb-1">
                      <div className="flex items-center space-x-2">
                        <span className={`text-sm font-medium ${isNoTag ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>{item.name}</span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">{percent}%</span>
                      </div>
                      <span className="font-bold text-gray-900 dark:text-gray-100">¥{item.value.toFixed(2)}</span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${percent}%` }}
                        transition={{ duration: 1, delay: index * 0.1 }}
                        className={`h-full rounded-full ${isNoTag ? 'bg-gray-300' : 'bg-purple-500'}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {isAiChatOpen && <AiChatModal onClose={() => setIsAiChatOpen(false)} />}
    </div>
  );
}
