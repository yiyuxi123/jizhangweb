import React, { useState } from 'react';
import { Icons } from '../utils/icons';
import { useStore } from '../store/useStore';

type SettingsTab = 'sync' | 'api' | 'notifications' | 'appearance';

const ALERT_TYPE_LABELS: Record<string, string> = {
  network_offline: '网络离线提示',
  auth_timeout: '登录超时提示',
  sync_error: '同步失败提示',
};

const ALERT_TYPE_DESCRIPTIONS: Record<string, string> = {
  network_offline: '当检测到无法连接云端服务时，自动提示并切换到离线模式',
  auth_timeout: '当 Firebase 登录认证超时时，提示并自动切换到离线模式',
  sync_error: '当数据同步到云端失败时，在账单明细页顶部显示错误信息',
};

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const {
    syncSettings,
    setSyncSettings,
    syncToCloudNow,
    pullFromCloud,
    deepseekApiKey,
    setDeepseekApiKey,
    qwenApiKey,
    setQwenApiKey,
    dismissedAlertTypes,
    resetDismissedAlertType,
    theme,
    setTheme: storeSetTheme,
  } = useStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>('sync');
  const [showConfirmSwitch, setShowConfirmSwitch] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // AI Key States
  const [dsKey, setDsKey] = useState(deepseekApiKey);
  const [qwKey, setQwKey] = useState(qwenApiKey);
  const [showDsKey, setShowDsKey] = useState(false);
  const [showQwKey, setShowQwKey] = useState(false);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setSyncMessage({ type, text });
    setTimeout(() => setSyncMessage(null), 3000);
  };

  const handleManualPush = async () => {
    setIsSyncing(true);
    try {
      await syncToCloudNow();
      showMessage('success', '成功推送到云端！');
    } catch (e) {
      showMessage('error', '推送到云端失败，请检查网络。');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleManualPull = async () => {
    setIsSyncing(true);
    try {
      await pullFromCloud();
      showMessage('success', '成功从云端拉取！');
    } catch (e) {
      showMessage('error', '从云端拉取失败，请检查网络。');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSwitchToCloud = () => {
    if (syncSettings.storageMode === 'local') {
      setShowConfirmSwitch(true);
    } else {
      setSyncSettings({ storageMode: 'cloud' });
    }
  };

  const confirmSwitchToCloud = () => {
    setSyncSettings({ storageMode: 'cloud' });
    setShowConfirmSwitch(false);
  };

  const handleDsKeyChange = (val: string) => {
    setDsKey(val);
  };

  const handleQwKeyChange = (val: string) => {
    setQwKey(val);
  };

  const handleDsBlur = () => {
    if (dsKey !== deepseekApiKey) {
      setDeepseekApiKey(dsKey);
    }
  };

  const handleQwBlur = () => {
    if (qwKey !== qwenApiKey) {
      setQwenApiKey(qwKey);
    }
  };

  const handleClose = () => {
    if (dsKey !== deepseekApiKey) setDeepseekApiKey(dsKey);
    if (qwKey !== qwenApiKey) setQwenApiKey(qwKey);
    onClose();
  };

  const tabs: { key: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { key: 'sync', label: '同步设置', icon: <Icons.RefreshCw size={16} /> },
    { key: 'api', label: 'API 密钥', icon: <Icons.Key size={16} /> },
    { key: 'notifications', label: '通知设置', icon: <Icons.Bell size={16} /> },
    { key: 'appearance', label: '外观', icon: <Icons.Sun size={16} /> },
  ];

  const allKnownAlertTypes = ['network_offline', 'auth_timeout', 'sync_error'];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/40 backdrop-blur-sm transition-opacity">
      <div role="dialog" aria-modal="true" aria-labelledby="settings-title" className="bg-white dark:bg-gray-800 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-10 duration-300 max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <h2 id="settings-title" className="text-xl font-bold text-gray-900 dark:text-gray-100">设置</h2>
          <button onClick={handleClose} className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
            <Icons.X size={24} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-100 shrink-0">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center space-x-1.5 py-3 text-sm font-medium transition-colors relative ${
                activeTab === tab.key
                  ? 'text-emerald-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-emerald-500 rounded-full" />
              )}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-6 overflow-y-auto relative flex-1">
          {/* Sync Message Toast */}
          {syncMessage && (
            <div className={`absolute top-0 left-0 right-0 mx-6 mt-2 p-3 rounded-xl flex items-center justify-center space-x-2 text-sm font-medium animate-in fade-in slide-in-from-top-4 z-10 ${
              syncMessage.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
            }`}>
              {syncMessage.type === 'success' ? <Icons.CheckCircle2 size={18} /> : <Icons.AlertCircle size={18} />}
              <span>{syncMessage.text}</span>
            </div>
          )}

          {/* ===== SYNC TAB ===== */}
          {activeTab === 'sync' && (
            <>
              {/* Storage Mode */}
              <div className="space-y-3">
                <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">数据存储位置</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleSwitchToCloud}
                    className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center space-y-2 transition-all ${
                      syncSettings.storageMode === 'cloud'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-gray-100 bg-white text-gray-500 hover:border-emerald-200'
                    }`}
                  >
                    <Icons.Cloud size={28} />
                    <span className="font-medium text-xs">云端同步 (Firestore)</span>
                  </button>
                  <button
                    onClick={() => setSyncSettings({ storageMode: 'local' })}
                    className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center space-y-2 transition-all ${
                      syncSettings.storageMode === 'local'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-100 bg-white text-gray-500 hover:border-blue-200'
                    }`}
                  >
                    <Icons.HardDrive size={28} />
                    <span className="font-medium text-xs">仅本地 (Localhost)</span>
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 leading-normal">
                  {syncSettings.storageMode === 'cloud'
                    ? '数据将安全地保存在云端，支持多设备同步。'
                    : '数据仅保存在当前设备，卸载应用或清空缓存会导致数据丢失。'}
                </p>
              </div>

              {/* Sync Frequency */}
              {syncSettings.storageMode === 'cloud' && (
                <div className="space-y-3">
                  <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">同步频率</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setSyncSettings({ syncFrequency: 'realtime' })}
                      className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center space-y-2 transition-all ${
                        syncSettings.syncFrequency === 'realtime'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-gray-100 bg-white text-gray-500 hover:border-emerald-200'
                      }`}
                    >
                      <Icons.RefreshCw size={28} />
                      <span className="font-medium text-xs">实时同步</span>
                    </button>
                    <button
                      onClick={() => setSyncSettings({ syncFrequency: 'daily' })}
                      className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center space-y-2 transition-all ${
                        syncSettings.syncFrequency === 'daily'
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-100 bg-white text-gray-500 hover:border-orange-200'
                      }`}
                    >
                      <Icons.Clock size={28} />
                      <span className="font-medium text-xs">手动/每日同步</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-normal">
                    {syncSettings.syncFrequency === 'realtime'
                      ? '任何修改都会立即同步到云端。'
                      : '修改将暂存本地，您可以手动点击下方按钮同步。'}
                  </p>
                </div>
              )}

              {/* Manual Sync Buttons */}
              {(syncSettings.storageMode === 'local' || syncSettings.syncFrequency === 'daily') && (
                <div className="space-y-3">
                  <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">手动云端同步</h3>
                  <div className="flex space-x-3">
                    <button
                      onClick={handleManualPull}
                      disabled={isSyncing}
                      className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-bold shadow-md hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center justify-center space-x-2 text-sm"
                    >
                      <Icons.Cloud size={18} />
                      <span>{isSyncing ? '同步中...' : '从云端拉取'}</span>
                    </button>
                    <button
                      onClick={handleManualPush}
                      disabled={isSyncing}
                      className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold shadow-md hover:bg-emerald-600 disabled:opacity-50 transition-colors flex items-center justify-center space-x-2 text-sm"
                    >
                      <Icons.RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
                      <span>{isSyncing ? '同步中...' : '推送到云端'}</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ===== API TAB ===== */}
          {activeTab === 'api' && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Icons.Sparkles size={18} className="text-violet-600 animate-pulse" />
                <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">AI 智能助理密钥设置</h3>
              </div>
              <p className="text-[10px] text-gray-400 leading-normal">
                密钥仅保存在当前设备本地 (IndexedDB)。<strong>不会同步到云端</strong>，不会上传至任何第三方服务。BYOK（自带密钥）模式保障数据隐私。
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1">DeepSeek API Key (智能记账与理财助手)</label>
                  <div className="relative flex items-center">
                    <input
                      type={showDsKey ? 'text' : 'password'}
                      value={dsKey}
                      onChange={e => handleDsKeyChange(e.target.value)}
                      onBlur={handleDsBlur}
                      placeholder="sk-..."
                      className="w-full pl-3 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none text-sm font-medium text-gray-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDsKey(!showDsKey)}
                      className="absolute right-3 text-gray-400 hover:text-gray-600"
                    >
                      {showDsKey ? <Icons.EyeOff size={16} /> : <Icons.Eye size={16} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1.5 flex items-center justify-between">
                    <span>没有密钥？点此去</span>
                    <a href="https://platform.deepseek.com/" target="_blank" rel="noopener noreferrer" className="text-violet-600 font-bold hover:underline">DeepSeek 开放平台注册获取 ➔</a>
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1">Qwen API Key (账单小票/截图视觉识别)</label>
                  <div className="relative flex items-center">
                    <input
                      type={showQwKey ? 'text' : 'password'}
                      value={qwKey}
                      onChange={e => handleQwKeyChange(e.target.value)}
                      onBlur={handleQwBlur}
                      placeholder="sk-..."
                      className="w-full pl-3 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none text-sm font-medium text-gray-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowQwKey(!showQwKey)}
                      className="absolute right-3 text-gray-400 hover:text-gray-600"
                    >
                      {showQwKey ? <Icons.EyeOff size={16} /> : <Icons.Eye size={16} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1.5 flex items-center justify-between">
                    <span>没有密钥？点此去</span>
                    <a href="https://bailian.aliyun.com/" target="_blank" rel="noopener noreferrer" className="text-violet-600 font-bold hover:underline">阿里云百炼平台注册获取 ➔</a>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ===== NOTIFICATIONS TAB ===== */}
          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Icons.BellOff size={18} className="text-gray-500" />
                <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">已关闭的提示消息</h3>
              </div>
              <p className="text-[10px] text-gray-400 leading-normal">
                当您在某条提示中选择"不再显示此类提示"后，该类提示将被永久关闭。您可以在此重新开启。
              </p>

              {allKnownAlertTypes.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Icons.Bell size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs">没有可管理的提示类型</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {allKnownAlertTypes.map(alertType => {
                    const isDismissed = dismissedAlertTypes.includes(alertType);
                    return (
                      <div
                        key={alertType}
                        className={`p-4 rounded-2xl border-2 transition-all ${
                          isDismissed
                            ? 'border-gray-200 bg-gray-50'
                            : 'border-emerald-200 bg-emerald-50/30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              {isDismissed ? (
                                <Icons.BellOff size={16} className="text-gray-400 shrink-0" />
                              ) : (
                                <Icons.Bell size={16} className="text-emerald-500 shrink-0" />
                              )}
                              <span className={`text-sm font-bold ${isDismissed ? 'text-gray-500' : 'text-gray-900'}`}>
                                {ALERT_TYPE_LABELS[alertType] || alertType}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1 ml-6">
                              {ALERT_TYPE_DESCRIPTIONS[alertType] || ''}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              if (isDismissed) {
                                resetDismissedAlertType(alertType);
                              }
                            }}
                            disabled={!isDismissed}
                            className={`ml-3 shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                              isDismissed
                                ? 'bg-emerald-500 text-white hover:bg-emerald-600 active:scale-95 shadow-sm'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            {isDismissed ? '重新开启' : '已开启'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {dismissedAlertTypes.length === 0 && (
                <div className="text-center py-6">
                  <Icons.CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-300" />
                  <p className="text-xs text-gray-400">所有提示消息均已开启</p>
                </div>
              )}
            </div>
          )}

          {/* ===== APPEARANCE TAB ===== */}
          {activeTab === 'appearance' && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Icons.Sun size={18} className="text-amber-500" />
                <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">外观设置</h3>
              </div>

              <div className="space-y-2">
                {([
                  { value: 'light' as const, label: '浅色模式', icon: <Icons.Sun size={20} />, desc: '始终使用浅色主题' },
                  { value: 'dark' as const, label: '深色模式', icon: <Icons.Moon size={20} />, desc: '始终使用深色主题' },
                  { value: 'system' as const, label: '跟随系统', icon: <Icons.Monitor size={20} />, desc: '根据系统设置自动切换' },
                ] as const).map(({ value, label, icon, desc }) => (
                  <button
                    key={value}
                    onClick={() => storeSetTheme(value)}
                    className={`w-full p-4 rounded-2xl border-2 flex items-center space-x-3 transition-all ${
                      theme === value
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-900/30 dark:text-emerald-300'
                        : 'border-gray-100 bg-white text-gray-500 hover:border-emerald-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                  >
                    <div className={`shrink-0 ${theme === value ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-400'}`}>
                      {icon}
                    </div>
                    <div className="text-left flex-1">
                      <div className="font-medium text-sm">{label}</div>
                      <div className="text-[10px] opacity-60">{desc}</div>
                    </div>
                    {theme === value && (
                      <Icons.CheckCircle2 size={18} className="shrink-0 text-emerald-500 dark:text-emerald-400" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmSwitch && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-orange-100 text-orange-500 mb-4 mx-auto">
              <Icons.AlertCircle size={24} />
            </div>
            <h3 className="text-lg font-bold text-center text-gray-900 mb-2">切换到云端同步</h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              切换到云端同步可能会覆盖您在本地未同步的数据。建议您先进行数据备份。是否继续切换？
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowConfirmSwitch(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmSwitchToCloud}
                className="flex-1 py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-colors"
              >
                确认切换
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
