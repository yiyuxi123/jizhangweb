import React, { useEffect, useState, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, getDocs, writeBatch, doc } from 'firebase/firestore';
import { auth, db, loginWithGoogle } from '../firebase';
import { useStore } from '../store/useStore';
import { Wallet, Icons } from '../utils/icons';
import { v4 as uuidv4 } from 'uuid';

// Alert type constants for dismiss tracking
const ALERT_NETWORK_OFFLINE = 'network_offline';
const ALERT_AUTH_TIMEOUT = 'auth_timeout';

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
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const { isGuestMode, setIsGuestMode, wasLoggedIn, setWasLoggedIn, setAccounts, setCategories, setTransactions, setBudgets, setTemplates, setGoals, syncSettings, syncToCloudNow, dismissedAlertTypes, dismissAlertType } = useStore();

  const [isCheckingNetwork, setIsCheckingNetwork] = useState(false);
  const [alertType, setAlertType] = useState<string | null>(null);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [alertCountdown, setAlertCountdown] = useState(8);
  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alertCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-dismiss alert after 8 seconds
  useEffect(() => {
    if (alertMessage) {
      setAlertCountdown(8);
      const countdownInterval = setInterval(() => {
        setAlertCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      alertCountdownRef.current = countdownInterval;

      alertTimerRef.current = setTimeout(() => {
        handleDismissAlert();
      }, 8000);

      return () => {
        clearInterval(countdownInterval);
        if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
      };
    }
  }, [alertMessage]);

  const handleDismissAlert = () => {
    if (dontShowAgain && alertType) {
      dismissAlertType(alertType);
    }
    if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    if (alertCountdownRef.current) clearInterval(alertCountdownRef.current);
    setAlertMessage(null);
    setAlertType(null);
    setDontShowAgain(false);
  };

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
        if (!dismissedAlertTypes.includes(ALERT_NETWORK_OFFLINE)) {
          setAlertType(ALERT_NETWORK_OFFLINE);
          setAlertMessage("检测到无法连接云端数据库（可能需要科学网络），已自动为您开启离线模式。您的数据将安全地保存在本地。");
        }
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
        if (!wasGuest && !useStore.getState().dismissedAlertTypes.includes(ALERT_AUTH_TIMEOUT)) {
          setAlertType(ALERT_AUTH_TIMEOUT);
          setAlertMessage("连接云端服务超时（可能需要科学网络），已自动为您开启离线模式。您的数据将安全地保存在本地。");
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

  // ---- Real-time Firestore listeners + app lifecycle sync ----
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstSnapRef = useRef<Set<string>>(new Set()); // track which coll has completed first snapshot

  useEffect(() => {
    if (!isAuthReady || !user) return;
    if (syncSettings.storageMode === 'local') return;

    const userId = user.uid;
    const unsubscribes: (() => void)[] = [];
    // Reset first-snapshot markers whenever user/mode changes
    firstSnapRef.current.clear();

    // Set up onSnapshot for each collection — remote changes arrive within seconds
    const collNames = ['accounts', 'categories', 'transactions', 'budgets', 'templates', 'goals'] as const;
    collNames.forEach(collName => {
      const collRef = collection(db, `users/${userId}/${collName}`);
      const unsub = onSnapshot(collRef, (snapshot) => {
        // Only act on server-committed changes (ignore our own pending writes)
        const remoteChanges = snapshot.docChanges().filter(c => !c.doc.metadata.hasPendingWrites);
        if (remoteChanges.length === 0) return;

        const isFirst = !firstSnapRef.current.has(collName);
        if (isFirst) firstSnapRef.current.add(collName);

        const store = useStore.getState();
        const localMap = new Map<string, any>((store as any)[collName].map((item: any) => [item.id, item]));
        let hasChanges = false;

        remoteChanges.forEach(change => {
          const remoteData: any = { id: change.doc.id, ...change.doc.data() };
          const local = localMap.get(change.doc.id);

          if (change.type === 'removed') {
            if (local) { localMap.delete(change.doc.id); hasChanges = true; }
          } else {
            // First snapshot: timestamp arbitration to avoid overwriting newer local data
            // Subsequent snapshots: always accept server data (clock skew would break comparisons)
            if (isFirst) {
              const remoteTime = remoteData.updatedAt || 0;
              const localTime = local?.updatedAt || 0;
              if (!local || remoteTime > localTime) {
                localMap.set(change.doc.id, { ...(local || {}), ...remoteData });
                hasChanges = true;
              }
            } else {
              // Incremental: accept unless local has unsynced pending changes (guarded by hasPendingWrites filter above)
              localMap.set(change.doc.id, { ...(local || {}), ...remoteData });
              hasChanges = true;
            }
          }
        });

        if (hasChanges) {
          const items = Array.from(localMap.values());
          const setterMap: Record<string, (items: any[]) => void> = {
            accounts: store.setAccounts,
            categories: store.setCategories,
            transactions: store.setTransactions,
            budgets: store.setBudgets,
            templates: store.setTemplates,
            goals: store.setGoals,
          };
          setterMap[collName]?.(items);
        }
      }, (err) => {
        console.error(`onSnapshot error for ${collName}:`, err);
      });
      unsubscribes.push(unsub);
    });

    // ---- App lifecycle: sync when returning to foreground ----
    const doBackgroundSync = () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      // Debounce: avoid syncing multiple times in quick succession
      syncTimerRef.current = setTimeout(() => {
        console.log("App foreground / online — running syncAllData");
        useStore.getState().syncAllData().catch(console.error);
      }, 500);
    };

    // Network recovery
    window.addEventListener('online', doBackgroundSync);

    // Page visibility (web + Capacitor WebView)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        doBackgroundSync();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      unsubscribes.forEach(fn => fn());
      window.removeEventListener('online', doBackgroundSync);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [isAuthReady, user, syncSettings.storageMode]);

  const isUserAuthenticated = user || (wasLoggedIn && !isAuthReady);
  const canBypassSpinner = isGuestMode || wasLoggedIn;

  let content;
  if (!isAuthReady && !canBypassSpinner) {
    content = (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin text-emerald-500">
          <Wallet size={48} />
        </div>
      </div>
    );
  } else if (!isUserAuthenticated && !isGuestMode) {
    content = (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-inner">
          <Wallet size={40} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">欢迎使用记账本</h1>
        <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-8 text-center max-w-sm">
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
              aria-label="使用 Google 账号登录"
              className="w-full px-8 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:bg-gray-900 transition-colors flex items-center justify-center space-x-3"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
              <span>使用 Google 账号登录</span>
            </button>
            
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink-0 mx-4 text-gray-400 dark:text-gray-500 text-sm">或者</span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>
 
            <button
              onClick={() => setIsGuestMode(true)}
              aria-label="跳过登录，进入离线模式"
              className="w-full px-8 py-4 bg-emerald-50 border border-emerald-100 rounded-xl shadow-sm font-bold text-emerald-600 hover:bg-emerald-100 transition-colors flex items-center justify-center"
            >
              <span>跳过登录 (离线模式)</span>
            </button>
          </div>
        )}
      </div>
    );
  } else {
    content = <>{children}</>;
  }

  return (
    <>
      {content}
      {alertMessage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-orange-100 text-orange-500 mb-4 mx-auto">
              <Icons.AlertCircle size={24} />
            </div>
            <h3 className="text-lg font-bold text-center text-gray-900 dark:text-gray-100 mb-2">网络及云同步提示</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 text-center mb-4 leading-relaxed">{alertMessage}</p>

            {/* Don't show again checkbox */}
            <label className="flex items-center justify-center space-x-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-4 h-4 text-emerald-500 border-gray-300 rounded focus:ring-emerald-500"
              />
              <span className="text-xs text-gray-500">不再显示此类提示</span>
            </label>

            <button
              onClick={handleDismissAlert}
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold transition-all shadow-md active:scale-95 text-sm"
            >
              我知道了{alertCountdown > 0 ? ` (${alertCountdown}s)` : ''}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
