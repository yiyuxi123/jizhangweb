import React, { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, getDocs, writeBatch, doc } from 'firebase/firestore';
import { auth, db, loginWithGoogle } from '../firebase';
import { useStore } from '../store/useStore';
import { Wallet } from '../utils/icons';
import { v4 as uuidv4 } from 'uuid';

const initialCategories = [
  { name: '餐饮', type: 'expense', icon: 'Utensils', color: '#f59e0b' },
  { name: '交通', type: 'expense', icon: 'Bus', color: '#3b82f6' },
  { name: '购物', type: 'expense', icon: 'ShoppingBag', color: '#ec4899' },
  { name: '居住', type: 'expense', icon: 'Home', color: '#10b981' },
  { name: '工资', type: 'income', icon: 'Wallet', color: '#10b981' },
  { name: '理财', type: 'income', icon: 'TrendingUp', color: '#8b5cf6' },
  { name: '报销款', type: 'income', icon: 'Receipt', color: '#f59e0b' },
];

const initialAccounts = [
  { name: '现金', type: 'cash', balance: 1000, color: '#10b981', icon: 'Banknote' },
  { name: '支付宝', type: 'alipay', balance: 5000, color: '#3b82f6', icon: 'Smartphone' },
  { name: '微信', type: 'wechat', balance: 3000, color: '#22c55e', icon: 'MessageCircle' },
  { name: '招商银行', type: 'bank', balance: 20000, color: '#ef4444', icon: 'CreditCard' },
];

let isInitializing = false;

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [user, setUser] = useState(auth.currentUser);

  const { isGuestMode, setIsGuestMode, wasLoggedIn, setWasLoggedIn, setAccounts, setCategories, setTransactions, setBudgets, setTemplates, setGoals, syncSettings, syncToCloudNow } = useStore();

  const [isCheckingNetwork, setIsCheckingNetwork] = useState(false);

  useEffect(() => {
    if (!isAuthReady || user || isGuestMode) return;

    const checkNetwork = async () => {
      setIsCheckingNetwork(true);
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        // Try to fetch a small Google asset to check connectivity
        await fetch('https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg', { 
          mode: 'no-cors', 
          signal: controller.signal 
        });
        clearTimeout(timeoutId);
      } catch (error) {
        console.log("Network check failed, auto-enabling offline mode");
        setIsGuestMode(true);
        alert("检测到无法连接云端数据库（可能需要科学网络），已自动为您开启离线模式。您的数据将安全地保存在本地。");
      } finally {
        setIsCheckingNetwork(false);
      }
    };

    checkNetwork();
  }, [isAuthReady, user, isGuestMode, setIsGuestMode]);

  useEffect(() => {
    if (user && syncSettings.storageMode === 'cloud' && syncSettings.syncFrequency === 'daily') {
      const now = Date.now();
      const lastSync = syncSettings.lastSyncTime || 0;
      const oneDay = 24 * 60 * 60 * 1000;
      if (now - lastSync > oneDay) {
        syncToCloudNow().catch(console.error);
      }
    }
  }, [user, syncSettings.storageMode, syncSettings.syncFrequency, syncSettings.lastSyncTime, syncToCloudNow]);

  useEffect(() => {
    let authResolved = false;

    // Fallback timeout: If Firebase Auth takes too long to initialize (e.g. blocked by firewall)
    const authTimeoutId = setTimeout(() => {
      if (!authResolved) {
        console.log("Firebase Auth timeout, auto-enabling offline mode");
        const wasGuest = useStore.getState().isGuestMode;
        setIsAuthReady(true);
        useStore.getState().setIsGuestMode(true);
        if (!wasGuest) {
          alert("连接云端服务超时（可能需要科学网络），已自动为您开启离线模式。您的数据将安全地保存在本地。");
        }
      }
    }, 3000);

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      authResolved = true;
      clearTimeout(authTimeoutId);

      setUser(currentUser);
      
      if (currentUser) {
        useStore.getState().setIsGuestMode(false);
        useStore.getState().setWasLoggedIn(true);
      } else {
        useStore.getState().setWasLoggedIn(false);
      }

      if (currentUser && syncSettings.storageMode === 'cloud') {
        // Check if new user and bootstrap
        const userId = currentUser.uid;
        if (!isInitializing) {
          isInitializing = true;
          try {
            const categoriesSnap = await getDocs(collection(db, `users/${userId}/categories`));
            if (categoriesSnap.empty) {
              const localCategories = useStore.getState().categories;
              const localAccounts = useStore.getState().accounts;
              const hasBootstrapped = useStore.getState().hasBootstrapped;
              
              if (localCategories.length > 0 || localAccounts.length > 0) {
                // If user already has local data but cloud is empty, push local data to cloud
                await useStore.getState().syncToCloudNow();
              } else if (!hasBootstrapped) {
                // Bootstrap default data
                const batch = writeBatch(db);
                initialCategories.forEach((cat, index) => {
                  const id = uuidv4();
                  batch.set(doc(db, `users/${userId}/categories`, id), { ...cat, id, userId, order: index });
                });
                initialAccounts.forEach((acc, index) => {
                  const id = uuidv4();
                  batch.set(doc(db, `users/${userId}/accounts`, id), { ...acc, id, userId, order: index });
                });
                batch.set(doc(db, `users/${userId}/budgets`, uuidv4()), { amount: 5000, period: 'monthly', userId });
                await batch.commit();
                useStore.getState().setHasBootstrapped(true);
              }
            } else {
              // Cloud has data!
              // If local has no transactions, we clear local defaults and sync from cloud to prevent duplicates
              const localTransactions = useStore.getState().transactions;
              if (localTransactions.length === 0) {
                console.log("Local has no transactions. Clearing defaults and pulling clean cloud data via syncAllData.");
                useStore.setState({
                  accounts: [],
                  categories: [],
                  budgets: [],
                  templates: [],
                  goals: []
                });
                await useStore.getState().syncAllData();
              } else {
                // If local has transactions, we do a bidirectional sync
                console.log("Local has transactions. Performing bidirectional sync.");
                await useStore.getState().syncAllData();
              }
            }
          } catch (error) {
            console.error("Error during initialization:", error);
          } finally {
            setIsAuthReady(true);
            setTimeout(() => { isInitializing = false; }, 2000);
          }
        } else {
          setIsAuthReady(true);
        }
      } else {
        setIsAuthReady(true);
      }
    });
    return () => unsubscribe();
  }, [syncSettings.storageMode]);

  useEffect(() => {
    if (!isAuthReady || !user) return;
    if (syncSettings.storageMode === 'local') return;

    // Listen to network status changes to online
    const handleOnline = () => {
      console.log("Device status changed to online. Starting bidirectional sync.");
      useStore.getState().syncAllData();
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [isAuthReady, user, syncSettings.storageMode]);

  const isUserAuthenticated = user || (wasLoggedIn && !isAuthReady);
  const canBypassSpinner = isGuestMode || wasLoggedIn;

  if (!isAuthReady && !canBypassSpinner) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin text-emerald-500">
          <Wallet size={48} />
        </div>
      </div>
    );
  }

  if (!isUserAuthenticated && !isGuestMode) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-inner">
          <Wallet size={40} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">欢迎使用记账本</h1>
        <p className="text-gray-500 mb-8 text-center max-w-sm">
          记录点滴，理清财务。请登录以同步您的账单数据。
        </p>
        
        {isCheckingNetwork ? (
          <div className="flex flex-col items-center space-y-4 my-8">
            <div className="animate-spin text-emerald-500">
              <Wallet size={32} />
            </div>
            <p className="text-sm text-gray-500">正在检测网络环境...</p>
          </div>
        ) : (
          <div className="space-y-4 w-full max-w-xs">
            <button
              onClick={loginWithGoogle}
              className="w-full px-8 py-4 bg-white border border-gray-200 rounded-xl shadow-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center space-x-3"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
              <span>使用 Google 账号登录</span>
            </button>
            
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink-0 mx-4 text-gray-400 text-sm">或者</span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>

            <button
              onClick={() => setIsGuestMode(true)}
              className="w-full px-8 py-4 bg-emerald-50 border border-emerald-100 rounded-xl shadow-sm font-bold text-emerald-600 hover:bg-emerald-100 transition-colors flex items-center justify-center"
            >
              <span>跳过登录 (离线模式)</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return <>{children}</>;
};
