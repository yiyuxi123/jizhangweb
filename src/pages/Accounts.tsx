import React, { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { Plus, Wallet, CreditCard, Smartphone, MessageCircle, Banknote, Download } from 'lucide-react';
import * as Icons from 'lucide-react';
import { motion } from 'motion/react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import AddAccountModal from '../components/AddAccountModal';
import EditAccountModal from '../components/EditAccountModal';
import CategoryManagementModal from '../components/CategoryManagementModal';
import GoalModal from '../components/GoalModal';
import SettingsModal from '../components/SettingsModal';
import DonationModal from '../components/DonationModal';
import GuideModal from '../components/GuideModal';
import { Account, SavingGoal } from '../types';
import { format, parseISO } from 'date-fns';
import { auth } from '../firebase';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SortableAccountItem: React.FC<{ account: Account, isReordering: boolean, onClick: () => void, index: number, total: number }> = ({ account, isReordering, onClick, index, total }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: account.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const IconComponent = (Icons as any)[account.icon] || Icons.Wallet;
  const typeLabels: Record<string, string> = {
    'cash': '现金',
    'bank': '银行卡',
    'alipay': '支付宝',
    'wechat': '微信',
    'credit': '信用卡',
    'auto_deposit': '自动入账'
  };
  const fundTypeLabels: Record<string, { label: string, colorClass: string }> = {
    'working': { label: '流动', colorClass: 'bg-blue-50 text-blue-600 border-blue-100/50' },
    'investment': { label: '投资', colorClass: 'bg-purple-50 text-purple-600 border-purple-100/50' },
    'unavailable': { label: '不可用', colorClass: 'bg-amber-50 text-amber-600 border-amber-100/50' }
  };
  const fundInfo = fundTypeLabels[account.fundType || 'working'];

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={`bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between transition-shadow hover:shadow-md ${isReordering ? 'cursor-grab active:cursor-grabbing select-none touch-none' : 'cursor-pointer'}`}
      onClick={onClick}
      {...(isReordering ? { ...attributes, ...listeners } : {})}
    >
      <div className="flex items-center space-x-4">
        {isReordering && (
          <div className="mr-2 text-gray-400">
            <Icons.GripVertical size={20} />
          </div>
        )}
        <div 
          className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-inner flex-shrink-0"
          style={{ backgroundColor: account.color }}
        >
          <IconComponent size={24} />
        </div>
        <div>
          <h4 className="font-bold text-gray-900">{account.name}</h4>
          <div className="flex items-center space-x-1.5 mt-0.5">
            <span className="text-xs text-gray-500">{typeLabels[account.type] || account.type}</span>
            <span className={`text-[10px] px-1 py-0.2 rounded border font-medium leading-none ${fundInfo.colorClass}`}>
              {fundInfo.label}
            </span>
          </div>
        </div>
      </div>
      <div className="text-right">
        <p className={`font-bold text-lg ${account.balance < 0 ? 'text-red-500' : 'text-gray-900'}`}>
          ¥{account.balance.toFixed(2)}
        </p>
      </div>
    </div>
  );
}

const SortableHiddenAccountItem: React.FC<{ account: Account, isReordering: boolean, onClick: () => void, index: number, total: number }> = ({ account, isReordering, onClick, index, total }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: account.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const IconComponent = (Icons as any)[account.icon] || Icons.Wallet;
  const typeLabels: Record<string, string> = {
    'cash': '现金',
    'bank': '银行卡',
    'alipay': '支付宝',
    'wechat': '微信',
    'credit': '信用卡',
    'auto_deposit': '自动入账'
  };
  const fundTypeLabels: Record<string, { label: string, colorClass: string }> = {
    'working': { label: '流动', colorClass: 'bg-blue-50 text-blue-600 border-blue-100/50' },
    'investment': { label: '投资', colorClass: 'bg-purple-50 text-purple-600 border-purple-100/50' },
    'unavailable': { label: '不可用', colorClass: 'bg-amber-50 text-amber-600 border-amber-100/50' }
  };
  const fundInfo = fundTypeLabels[account.fundType || 'working'];

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={`bg-white/60 p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between transition-all opacity-75 hover:opacity-100 hover:shadow-md ${isReordering ? 'cursor-grab active:cursor-grabbing select-none touch-none' : 'cursor-pointer'}`}
      onClick={onClick}
      {...(isReordering ? { ...attributes, ...listeners } : {})}
    >
      <div className="flex items-center space-x-4">
        {isReordering && (
          <div className="mr-2 text-gray-400">
            <Icons.GripVertical size={20} />
          </div>
        )}
        <div 
          className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-inner grayscale flex-shrink-0"
          style={{ backgroundColor: account.color }}
        >
          <IconComponent size={24} />
        </div>
        <div>
          <h4 className="font-bold text-gray-900">{account.name}</h4>
          <div className="flex items-center space-x-1.5 mt-0.5">
            <span className="text-xs text-gray-500">{typeLabels[account.type] || account.type}</span>
            <span className={`text-[10px] px-1 py-0.2 rounded border font-medium leading-none ${fundInfo.colorClass}`}>
              {fundInfo.label}
            </span>
          </div>
        </div>
      </div>
      <div className="text-right">
        <p className={`font-bold text-lg ${account.balance < 0 ? 'text-red-500' : 'text-gray-900'}`}>
          ¥{account.balance.toFixed(2)}
        </p>
      </div>
    </div>
  );
}

export default function Accounts() {
  const { accounts, transactions, categories, reorderAccount, reorderAccountsList } = useStore();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [isAddGoalOpen, setIsAddGoalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<SavingGoal | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDonationOpen, setIsDonationOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = accounts.findIndex((acc) => acc.id === active.id);
      const newIndex = accounts.findIndex((acc) => acc.id === over.id);
      
      const newAccounts = arrayMove(accounts, oldIndex, newIndex);
      reorderAccountsList(newAccounts);
    }
  };

  const { totalBalance, totalAssets, totalLiabilities, workingFunds, investmentFunds, unavailableFunds } = useMemo(() => {
    let balance = 0;
    let assets = 0;
    let liabilities = 0;
    let working = 0;
    let investment = 0;
    let unavailable = 0;
    accounts.forEach(a => {
      balance += a.balance;
      if (a.balance > 0) {
        assets += a.balance;
        const fType = a.fundType || 'working';
        if (fType === 'working') working += a.balance;
        else if (fType === 'investment') investment += a.balance;
        else if (fType === 'unavailable') unavailable += a.balance;
      } else if (a.balance < 0) {
        liabilities += Math.abs(a.balance);
      }
    });
    return { 
      totalBalance: balance, 
      totalAssets: assets, 
      totalLiabilities: liabilities,
      workingFunds: working,
      investmentFunds: investment,
      unavailableFunds: unavailable
    };
  }, [accounts]);

  const exportToCSV = async (filename: string, rows: string[][]) => {
    const csvContent = rows.map(e => e.join(",")).join("\n");
    const content = "\uFEFF" + csvContent;

    if (Capacitor.isNativePlatform()) {
      try {
        const result = await Filesystem.writeFile({
          path: filename,
          data: content,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
        });
        
        await Share.share({
          title: '导出数据',
          text: '这是您的记账数据导出文件',
          url: result.uri,
          dialogTitle: '分享或保存CSV文件',
        });
      } catch (e) {
        console.error('Export failed', e);
        alert('导出失败: ' + (e as Error).message + '\n文件可能已保存到Documents文件夹。');
      }
    } else {
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const escapeCSV = (str: string | undefined) => `"${String(str || '').replace(/"/g, '""')}"`;

  const handleExportTransactions = () => {
    const headers = ['交易ID', '类型', '金额', '日期', '分类', '付款账户', '收款账户', '备注', '标签'];
    const rows = transactions.map(t => {
      const category = categories.find(c => c.id === t.categoryId)?.name || '';
      const fromAcc = accounts.find(a => a.id === t.fromAccountId)?.name || '';
      const toAcc = accounts.find(a => a.id === t.toAccountId)?.name || '';
      return [
        escapeCSV(t.id),
        escapeCSV(t.type === 'expense' ? '支出' : t.type === 'income' ? '收入' : '转账'),
        escapeCSV(t.amount.toString()),
        escapeCSV(format(parseISO(t.date), 'yyyy-MM-dd HH:mm:ss')),
        escapeCSV(category),
        escapeCSV(fromAcc),
        escapeCSV(toAcc),
        escapeCSV(t.note),
        escapeCSV(t.tags ? t.tags.join(', ') : '')
      ];
    });
    exportToCSV(`transactions_${format(new Date(), 'yyyyMMdd')}.csv`, [headers, ...rows]);
  };

  const handleExportAccounts = () => {
    const headers = ['账户ID', '账户名称', '类型', '当前余额'];
    const rows = accounts.map(a => [
      escapeCSV(a.id),
      escapeCSV(a.name),
      escapeCSV(a.type === 'cash' ? '现金' : a.type === 'bank' ? '银行卡' : a.type === 'alipay' ? '支付宝' : a.type === 'wechat' ? '微信' : '信用卡'),
      escapeCSV(a.balance.toString())
    ]);
    exportToCSV(`accounts_${format(new Date(), 'yyyyMMdd')}.csv`, [headers, ...rows]);
  };

  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [restoreData, setRestoreData] = useState<any>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showClearConfirm2, setShowClearConfirm2] = useState(false);

  const handleBackup = async () => {
    const includeImages = window.confirm("备份数据时是否包含账单凭证图片？\n\n- 选择【确定】：包含图片（备份文件较大，适合完整迁移）\n- 选择【取消】：不含图片（备份文件极小，适合日常快速备份）");
    
    const transactionsToBackup = includeImages 
      ? transactions 
      : transactions.map(t => {
          if (t.image) {
            const { image, ...rest } = t;
            return rest;
          }
          return t;
        });

    const data = {
      accounts,
      transactions: transactionsToBackup,
      categories,
      version: 1,
      timestamp: new Date().toISOString()
    };
    const content = JSON.stringify(data, null, 2);
    const filename = `money_tracker_backup_${format(new Date(), 'yyyyMMdd_HHmmss')}.json`;

    if (Capacitor.isNativePlatform()) {
      try {
        const result = await Filesystem.writeFile({
          path: filename,
          data: content,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
        });
        
        await Share.share({
          title: '备份数据',
          text: '这是您的记账数据备份文件',
          url: result.uri,
          dialogTitle: '分享或保存备份文件',
        });
      } catch (e) {
        console.error('Backup failed', e);
        alert('备份失败: ' + (e as Error).message + '\n文件可能已保存到Documents文件夹。');
      }
    } else {
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.accounts && data.transactions && data.categories) {
          setRestoreData(data);
          setShowRestoreConfirm(true);
        } else {
          alert('无效的备份文件格式。');
        }
      } catch (error) {
        alert('读取备份文件失败，请确保文件格式正确。');
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  const confirmRestore = async () => {
    if (!restoreData) return;
    try {
      await useStore.getState().restoreData(restoreData);
      alert('数据恢复成功！');
    } catch (err: any) {
      console.error('Restore failed:', err);
      alert(`数据恢复失败: ${err.message}`);
    } finally {
      setShowRestoreConfirm(false);
      setRestoreData(null);
    }
  };

  const handleClearAll = () => {
    setShowClearConfirm(true);
  };

  const confirmClearStep1 = () => {
    setShowClearConfirm(false);
    setShowClearConfirm2(true);
  };

  const confirmClearStep2 = async () => {
    try {
      await useStore.getState().clearAllData();
      alert('所有数据已清空。');
    } catch (err: any) {
      console.error('Clear failed:', err);
      alert(`清空数据失败: ${err.message}`);
    } finally {
      setShowClearConfirm2(false);
    }
  };

  return (
    <div className="p-4 space-y-6 max-w-md mx-auto">
      {/* Header */}
      <header className="pt-4 pb-2 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">资产管理</h1>
        <button 
          onClick={() => setIsAddOpen(true)}
          className="p-2 bg-emerald-100 text-emerald-600 rounded-full hover:bg-emerald-200 transition-colors"
        >
          <Plus size={20} />
        </button>
      </header>

      {/* Net Worth Card */}
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 rounded-3xl shadow-lg text-white">
        <p className="text-emerald-100 text-sm font-medium mb-1">净资产 (CNY)</p>
        <h2 className="text-4xl font-bold mb-4">¥{totalBalance.toFixed(2)}</h2>
        
        <div className="grid grid-cols-2 gap-4 py-4 border-t border-emerald-400/30">
          <div className="text-left">
            <p className="text-emerald-100 text-xs font-medium mb-1">总资产</p>
            <p className="text-lg font-bold">¥{totalAssets.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-emerald-100 text-xs font-medium mb-1">总负债</p>
            <p className="text-lg font-bold">¥{totalLiabilities.toFixed(2)}</p>
          </div>
        </div>

        <div className="pt-4 border-t border-emerald-400/30 grid grid-cols-3 gap-2">
          <div className="text-left">
            <p className="text-emerald-100 text-[10px] font-medium mb-0.5">流动资金</p>
            <p className="text-sm font-semibold">¥{workingFunds.toFixed(0)}</p>
          </div>
          <div className="text-center">
            <p className="text-emerald-100 text-[10px] font-medium mb-0.5">投资资金</p>
            <p className="text-sm font-semibold">¥{investmentFunds.toFixed(0)}</p>
          </div>
          <div className="text-right">
            <p className="text-emerald-100 text-[10px] font-medium mb-0.5">不可用资金</p>
            <p className="text-sm font-semibold">¥{unavailableFunds.toFixed(0)}</p>
          </div>
        </div>
      </div>

      {/* Accounts List */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-900">我的账户</h3>
          <button 
            onClick={() => setIsReordering(!isReordering)}
            className={`text-sm font-medium px-3 py-1 rounded-full transition-colors ${isReordering ? 'bg-emerald-100 text-emerald-700' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            {isReordering ? '完成排序' : '排序'}
          </button>
        </div>
        
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 gap-3">
            <SortableContext 
              items={accounts.filter(a => !a.isHidden).map(a => a.id)}
              strategy={verticalListSortingStrategy}
            >
              {accounts.filter(a => !a.isHidden).map((account, index, arr) => (
                <SortableAccountItem 
                  key={account.id}
                  account={account}
                  isReordering={isReordering}
                  onClick={() => !isReordering && setSelectedAccount(account)}
                  index={index}
                  total={arr.length}
                />
              ))}
            </SortableContext>
          </div>

          {accounts.some(a => a.isHidden) && (
            <div className="pt-2">
              <details className="group">
                <summary className="flex items-center justify-between cursor-pointer list-none text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors py-2">
                  <span>折叠的账户 ({accounts.filter(a => a.isHidden).length})</span>
                  <Icons.ChevronDown size={16} className="transition-transform group-open:-rotate-180" />
                </summary>
                <div className="grid grid-cols-1 gap-3 mt-3 p-1">
                  <SortableContext 
                    items={accounts.filter(a => a.isHidden).map(a => a.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {accounts.filter(a => a.isHidden).map((account, index, arr) => (
                      <SortableHiddenAccountItem 
                        key={account.id}
                        account={account}
                        isReordering={isReordering}
                        onClick={() => !isReordering && setSelectedAccount(account)}
                        index={index}
                        total={arr.length}
                      />
                    ))}
                  </SortableContext>
                </div>
              </details>
            </div>
          )}
        </DndContext>
      </div>

      {/* Goals List */}
      <div className="space-y-4 pt-2">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-900">存钱目标</h3>
          <button 
            onClick={() => setIsAddGoalOpen(true)}
            className="text-sm text-emerald-600 font-medium hover:text-emerald-700 transition-colors"
          >
            添加目标
          </button>
        </div>
        
        {useStore(state => state.goals || []).length === 0 ? (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
            <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <Icons.Target size={24} className="text-emerald-500" />
            </div>
            <p className="text-gray-500 text-sm">还没有存钱目标，定个小目标吧！</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {useStore(state => state.goals || []).map((goal, index) => {
              const IconComponent = (Icons as any)[goal.icon] || Icons.Target;
              const linkedAccount = goal.accountId ? accounts.find(a => a.id === goal.accountId) : null;
              const currentAmount = linkedAccount ? linkedAccount.balance : goal.currentAmount;
              const percent = Math.min(100, Math.max(0, (currentAmount / goal.targetAmount) * 100));
              
              return (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.02, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)' }}
                  whileTap={{ scale: 0.98 }}
                  key={goal.id} 
                  className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 cursor-pointer transition-all"
                  onClick={() => setSelectedGoal(goal)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-inner"
                        style={{ backgroundColor: goal.color }}
                      >
                        <IconComponent size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900">{goal.name}</h4>
                        {goal.deadline && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            目标日期: {goal.deadline.split('T')[0]}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">¥{currentAmount.toFixed(2)}</p>
                      <p className="text-xs text-gray-500 mt-0.5">/ ¥{goal.targetAmount.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${percent}%` }}
                      transition={{ duration: 1, delay: 0.2 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: goal.color }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Data Management */}
      <div className="space-y-4 pt-4">
        <h3 className="text-lg font-bold text-gray-900">系统设置</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <motion.button 
            whileHover={{ y: -2, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)' }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsCategoryOpen(true)}
            className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center space-y-2 transition-all text-gray-700"
          >
            <Icons.Tags size={24} className="text-purple-500" />
            <span className="text-sm font-medium">分类管理</span>
          </motion.button>
          <motion.button 
            whileHover={{ y: -2, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)' }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              const { templates, deleteTemplate } = useStore.getState();
              if (templates && templates.length > 0) {
                const templateNames = templates.map((t, i) => `${i + 1}. ${t.name}`).join('\n');
                const idToDelete = prompt(`当前有以下模板：\n${templateNames}\n\n请输入要删除的模板编号 (1-${templates.length})，或点击取消：`);
                if (idToDelete) {
                  const index = parseInt(idToDelete) - 1;
                  if (index >= 0 && index < templates.length) {
                    deleteTemplate(templates[index].id);
                    alert('模板已删除');
                  } else {
                    alert('无效的编号');
                  }
                }
              } else {
                alert('暂无快捷记账模板');
              }
            }}
            className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center space-y-2 transition-all text-gray-700"
          >
            <Icons.Zap size={24} className="text-yellow-500" />
            <span className="text-sm font-medium">模板管理</span>
          </motion.button>
          <motion.button 
            whileHover={{ y: -2, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)' }}
            whileTap={{ scale: 0.95 }}
            onClick={handleExportTransactions}
            className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center space-y-2 transition-all text-gray-700"
          >
            <Download size={24} className="text-emerald-500" />
            <span className="text-sm font-medium">导出账单</span>
          </motion.button>
          <motion.button 
            whileHover={{ y: -2, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)' }}
            whileTap={{ scale: 0.95 }}
            onClick={handleExportAccounts}
            className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center space-y-2 transition-all text-gray-700"
          >
            <Download size={24} className="text-blue-500" />
            <span className="text-sm font-medium">导出资产</span>
          </motion.button>
          <motion.button 
            whileHover={{ y: -2, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)' }}
            whileTap={{ scale: 0.95 }}
            onClick={handleBackup}
            className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center space-y-2 transition-all text-gray-700"
          >
            <Icons.Save size={24} className="text-indigo-500" />
            <span className="text-sm font-medium">备份数据</span>
          </motion.button>
          <div className="relative">
            <input 
              type="file" 
              accept=".json" 
              onChange={handleRestore} 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
              title="恢复数据"
            />
            <motion.div 
              whileHover={{ y: -2, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)' }}
              whileTap={{ scale: 0.95 }}
              className="bg-white h-full p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center space-y-2 transition-all text-gray-700"
            >
              <Icons.Upload size={24} className="text-orange-500" />
              <span className="text-sm font-medium">恢复数据</span>
            </motion.div>
          </div>
          <motion.button 
            whileHover={{ y: -2, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)' }}
            whileTap={{ scale: 0.95 }}
            onClick={handleClearAll}
            className="bg-white p-4 rounded-2xl shadow-sm border border-red-100 flex flex-col items-center justify-center space-y-2 transition-all text-red-600 hover:bg-red-50"
          >
            <Icons.Trash2 size={24} className="text-red-500" />
            <span className="text-sm font-medium">清空数据</span>
          </motion.button>
          <motion.button 
            whileHover={{ y: -2, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)' }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsGuideOpen(true)}
            className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-100 flex flex-col items-center justify-center space-y-2 transition-all text-emerald-600 hover:bg-emerald-50"
          >
            <Icons.BookOpen size={24} className="text-emerald-500" />
            <span className="text-sm font-medium">使用说明</span>
          </motion.button>
          <motion.button 
            whileHover={{ y: -2, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)' }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsSettingsOpen(true)}
            className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center space-y-2 transition-all text-gray-700"
          >
            <Icons.Settings size={24} className="text-slate-500" />
            <span className="text-sm font-medium">同步设置</span>
          </motion.button>
          <motion.button 
            whileHover={{ y: -2, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)' }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsDonationOpen(true)}
            className="bg-white p-4 rounded-2xl shadow-sm border border-pink-100 flex flex-col items-center justify-center space-y-2 transition-all text-pink-600 hover:bg-pink-50"
          >
            <Icons.Heart size={24} className="text-pink-500" />
            <span className="text-sm font-medium">赞赏支持</span>
          </motion.button>
          {auth.currentUser ? (
            <motion.button 
              whileHover={{ y: -2, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)' }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                import('../firebase').then(({ logout }) => {
                  logout();
                  useStore.getState().setIsGuestMode(true);
                });
              }}
              className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center space-y-2 transition-all text-gray-700 hover:bg-gray-50"
            >
              <Icons.LogOut size={24} className="text-gray-500" />
              <span className="text-sm font-medium">退出登录</span>
            </motion.button>
          ) : (
            <motion.button 
              whileHover={{ y: -2, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)' }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                import('../firebase').then(({ loginWithGoogle }) => loginWithGoogle());
              }}
              className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-100 flex flex-col items-center justify-center space-y-2 transition-all text-emerald-600 hover:bg-emerald-50"
            >
              <Icons.LogIn size={24} className="text-emerald-500" />
              <span className="text-sm font-medium">登录同步</span>
            </motion.button>
          )}
        </div>
      </div>

      {isAddOpen && <AddAccountModal onClose={() => setIsAddOpen(false)} />}
      {isCategoryOpen && <CategoryManagementModal onClose={() => setIsCategoryOpen(false)} />}
      {selectedAccount && <EditAccountModal account={selectedAccount} onClose={() => setSelectedAccount(null)} />}
      <GoalModal isOpen={isAddGoalOpen} onClose={() => setIsAddGoalOpen(false)} />
      <GoalModal isOpen={!!selectedGoal} onClose={() => setSelectedGoal(null)} goal={selectedGoal} />
      {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
      {isDonationOpen && <DonationModal onClose={() => setIsDonationOpen(false)} />}
      {isGuideOpen && <GuideModal onClose={() => setIsGuideOpen(false)} />}

      {/* Restore Confirm Modal */}
      {showRestoreConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
          >
            <h3 className="text-xl font-bold text-gray-900 mb-2">确认恢复数据</h3>
            <p className="text-gray-500 mb-6">恢复数据将覆盖当前所有数据，确定要继续吗？</p>
            <div className="flex space-x-3">
              <button 
                onClick={() => {
                  setShowRestoreConfirm(false);
                  setRestoreData(null);
                }}
                className="flex-1 py-3 rounded-xl font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button 
                onClick={confirmRestore}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-orange-500 hover:bg-orange-600 transition-colors"
              >
                确定恢复
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Clear Confirm Modal 1 */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
          >
            <h3 className="text-xl font-bold text-red-600 mb-2">警告：清空数据</h3>
            <p className="text-gray-500 mb-6">此操作将清空所有账户、账单和分类数据，且不可恢复！确定要继续吗？</p>
            <div className="flex space-x-3">
              <button 
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-3 rounded-xl font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button 
                onClick={confirmClearStep1}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 transition-colors"
              >
                继续
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Clear Confirm Modal 2 */}
      {showClearConfirm2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border-2 border-red-500"
          >
            <h3 className="text-xl font-bold text-red-600 mb-2">最后确认</h3>
            <p className="text-gray-700 font-medium mb-6">再次确认：您真的要清空所有数据吗？</p>
            <div className="flex space-x-3">
              <button 
                onClick={() => setShowClearConfirm2(false)}
                className="flex-1 py-3 rounded-xl font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button 
                onClick={confirmClearStep2}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors"
              >
                确定清空
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
