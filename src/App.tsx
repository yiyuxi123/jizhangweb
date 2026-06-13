import React, { useState, useEffect, Suspense } from 'react';
import { Home, List, PieChart, User, PlusCircle, Wallet } from './utils/icons';
import { motion, AnimatePresence } from 'motion/react';
import { FirebaseProvider } from './components/FirebaseProvider';
import { useStore } from './store/useStore';

// Route-based lazy loading — splits the 1.5MB bundle into per-page chunks
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Transactions = React.lazy(() => import('./pages/Transactions'));
const Statistics = React.lazy(() => import('./pages/Statistics'));
const Accounts = React.lazy(() => import('./pages/Accounts'));
const AddTransactionModal = React.lazy(() => import('./components/AddTransactionModal'));

const PageFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="animate-spin text-emerald-400">
      <Wallet size={32} />
    </div>
  </div>
);

function AppContent() {
  const [activeTab, setActiveTab] = useState('home');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const { accounts, transactions, addTransaction, categories, hasBootstrapped, setHasBootstrapped } = useStore();

  useEffect(() => {
    // Bootstrap local data if empty
    if (!hasBootstrapped && accounts.length === 0 && categories.length === 0) {
      const initialCategories = [
        { id: 'cat-1', name: '餐饮', type: 'expense', icon: 'Utensils', color: '#f59e0b', order: 0 },
        { id: 'cat-2', name: '交通', type: 'expense', icon: 'Bus', color: '#3b82f6', order: 1 },
        { id: 'cat-3', name: '购物', type: 'expense', icon: 'ShoppingBag', color: '#ec4899', order: 2 },
        { id: 'cat-4', name: '居住', type: 'expense', icon: 'Home', color: '#10b981', order: 3 },
        { id: 'cat-5', name: '工资', type: 'income', icon: 'Wallet', color: '#10b981', order: 4 },
        { id: 'cat-6', name: '理财', type: 'income', icon: 'TrendingUp', color: '#8b5cf6', order: 5 },
        { id: 'cat-7', name: '报销款', type: 'income', icon: 'Receipt', color: '#f59e0b', order: 6 },
      ];
      const initialAccounts = [
        { id: 'acc-1', name: '现金', type: 'cash', balance: 1000, color: '#10b981', icon: 'Banknote', order: 0 },
        { id: 'acc-2', name: '支付宝', type: 'alipay', balance: 5000, color: '#3b82f6', icon: 'Smartphone', order: 1 },
        { id: 'acc-3', name: '微信', type: 'wechat', balance: 3000, color: '#22c55e', icon: 'MessageCircle', order: 2 },
        { id: 'acc-4', name: '招商银行', type: 'bank', balance: 20000, color: '#ef4444', icon: 'CreditCard', order: 3 },
      ];
      useStore.getState().setCategories(initialCategories as any);
      useStore.getState().setAccounts(initialAccounts as any);
      useStore.getState().setBudgets([{ id: 'bud-1', amount: 5000, period: 'monthly' } as any]);
      setHasBootstrapped(true);
    }

    // Check for auto-deposits
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const currentDate = today.getDate();

    accounts.forEach(account => {
      if (account.type === 'auto_deposit' && account.autoDepositAmount && account.autoDepositDay) {
        if (currentDate >= account.autoDepositDay) {
          // Check if we already deposited this month
          const hasDepositedThisMonth = transactions.some(t => {
            if (t.toAccountId !== account.id) return false;
            const txDate = new Date(t.date);
            return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear && t.note === '自动入账';
          });

          if (!hasDepositedThisMonth) {
            // Find an income category for auto deposit, or just use the first income category
            const incomeCategory = categories.find(c => c.type === 'income' && c.name.includes('入账')) || categories.find(c => c.type === 'income');
            
            if (incomeCategory) {
              const depositDate = new Date(currentYear, currentMonth, account.autoDepositDay);
              addTransaction({
                type: 'income',
                amount: account.autoDepositAmount,
                categoryId: incomeCategory.id,
                toAccountId: account.id,
                date: depositDate.toISOString(),
                note: '自动入账',
                tags: ['自动']
              });
            }
          }
        }
      }
    });
  }, [accounts, transactions, addTransaction, categories]);

  const pageVariants = {
    initial: { opacity: 0, y: 10, scale: 0.98 },
    in: { opacity: 1, y: 0, scale: 1 },
    out: { opacity: 0, y: -10, scale: 0.98 }
  };

  const pageTransition = {
    type: 'tween',
    ease: 'anticipate',
    duration: 0.3
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 font-sans overflow-hidden">
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
            className="min-h-full pb-24"
          >
            <Suspense fallback={<PageFallback />}>
              {activeTab === 'home' && <Dashboard onNavigate={setActiveTab} />}
              {activeTab === 'transactions' && <Transactions />}
              {activeTab === 'statistics' && <Statistics />}
              {activeTab === 'accounts' && <Accounts />}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full bg-white/80 backdrop-blur-md border-t border-gray-200/50 px-6 py-3 flex justify-between items-center z-10 safe-area-pb shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
        <NavItem 
          icon={<Home size={24} />} 
          label="首页" 
          isActive={activeTab === 'home'} 
          onClick={() => setActiveTab('home')} 
        />
        <NavItem 
          icon={<List size={24} />} 
          label="明细" 
          isActive={activeTab === 'transactions'} 
          onClick={() => setActiveTab('transactions')} 
        />
        
        {/* Add Button */}
        <div className="relative -top-8">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsAddModalOpen(true)}
            aria-label="添加记账记录"
            className="bg-emerald-500 text-white p-4 rounded-full shadow-[0_8px_20px_rgba(16,185,129,0.3)] flex items-center justify-center"
          >
            <PlusCircle size={32} />
          </motion.button>
        </div>

        <NavItem 
          icon={<PieChart size={24} />} 
          label="统计" 
          isActive={activeTab === 'statistics'} 
          onClick={() => setActiveTab('statistics')} 
        />
        <NavItem 
          icon={<User size={24} />} 
          label="资产" 
          isActive={activeTab === 'accounts'} 
          onClick={() => setActiveTab('accounts')} 
        />
      </nav>

      {/* Add Transaction Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <AddTransactionModal 
            key="add-transaction-modal"
            isOpen={isAddModalOpen} 
            onClose={() => setIsAddModalOpen(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <FirebaseProvider>
        <AppContent />
      </FirebaseProvider>
    </ErrorBoundary>
  );
}

const NavItem = React.memo(function NavItem({ icon, label, isActive, onClick }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void }) {
  const ariaLabels: Record<string, string> = {
    '首页': '首页导航',
    '明细': '账单明细导航',
    '统计': '统计图表导航',
    '资产': '资产管理导航',
  };
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabels[label] || label}
      aria-current={isActive ? 'page' : undefined}
      className={`flex flex-col items-center justify-center space-y-1 w-16 transition-colors duration-200 ${isActive ? 'text-emerald-500' : 'text-gray-400 hover:text-gray-600'}`}
    >
      <motion.div
        animate={{ 
          y: isActive ? -2 : 0,
          scale: isActive ? 1.1 : 1
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        {icon}
      </motion.div>
      <span className={`text-[10px] font-medium transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-70'}`}>{label}</span>
    </button>
  );
});
