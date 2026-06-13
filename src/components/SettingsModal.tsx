import React, { useState } from 'react';
import { Icons } from '../utils/icons';
import { useStore } from '../store/useStore';

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { 
    syncSettings, 
    setSyncSettings, 
    syncToCloudNow, 
    pullFromCloud,
    deepseekApiKey,
    setDeepseekApiKey,
    qwenApiKey,
    setQwenApiKey
  } = useStore();
  
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
    setDeepseekApiKey(val);
  };

  const handleQwKeyChange = (val: string) => {
    setQwKey(val);
    setQwenApiKey(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/40 backdrop-blur-sm transition-opacity">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-10 duration-300 max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-gray-100 shrink-0">
          <h2 className="text-xl font-bold text-gray-900">同步与 AI 设置</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
            <Icons.X size={24} />
          </button>
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

          {/* AI Settings Section */}
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <div className="flex items-center space-x-2">
              <Icons.Sparkles size={18} className="text-violet-600 animate-pulse" />
              <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">AI 智能助理密钥设置</h3>
            </div>
            <p className="text-[10px] text-gray-400 leading-normal">
              密钥仅安全地保存在当前设备本地缓存 (IndexedDB) 中，不会在云端存储，也不会明文上传到第三方。
            </p>
            
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1">DeepSeek API Key (智能记账与理财助手)</label>
                <div className="relative flex items-center">
                  <input
                    type={showDsKey ? 'text' : 'password'}
                    value={dsKey}
                    onChange={e => handleDsKeyChange(e.target.value)}
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
