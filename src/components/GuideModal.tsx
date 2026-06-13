import React from 'react';
import { X, BookOpen, ShieldCheck, Zap, AlertTriangle } from '../utils/icons';
import { motion } from 'motion/react';

export default function GuideModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white w-full max-w-md max-h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50 shrink-0">
          <div className="flex items-center space-x-2 text-gray-800">
            <BookOpen className="text-emerald-500" size={24} />
            <h2 className="text-xl font-bold">使用说明</h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 bg-white rounded-full shadow-sm transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-8">
          {/* 功能介绍 */}
          <section>
            <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center"><Zap className="mr-2 text-amber-500" size={20}/> 核心功能</h3>
            <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100/50">
                <strong className="text-emerald-700 block mb-1 text-base">💼 报销追踪</strong>
                记账时勾选“可报销”，该笔支出将<span className="font-bold text-emerald-600">不会计入</span>您的个人总支出。当公司打款后，点击添加一笔收入，分类选择为“报销款”，系统会提示您勾选需要被报销的支出账单，即可完成平账。
              </div>
              <div className="bg-violet-50 p-4 rounded-2xl border border-violet-100/50">
                <strong className="text-violet-700 block mb-1 text-base">🤖 AI 智能辅助</strong>
                支持一句话记账与截图小票识别。请在<b>系统设置</b>中配置您个人的 <b>DeepSeek Key</b> (用于解析一句话和理财助手) 和 <b>Qwen Key</b> (用于小票截图识别) 开启 AI 功能。
              </div>
              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100/50">
                <strong className="text-blue-700 block mb-1 text-base">📅 自动入账</strong>
                在“资产”页面添加账户时，选择“自动入账”类型，并设置每月入账日和金额。系统会在每个月的这一天自动为您记一笔收入（适合固定工资、房租、公积金等）。
              </div>
            </div>
          </section>

          {/* 离线与同步 */}
          <section>
            <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center"><ShieldCheck className="mr-2 text-blue-500" size={20}/> 离线与同步</h3>
            <ul className="list-disc list-inside space-y-2 text-sm text-gray-600 bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <li>本应用默认采用 <strong>纯离线模式</strong>，您的所有账单数据均安全地保存在手机本地。</li>
              <li>无需注册、无需手机号即可使用全部功能。</li>
              <li>如果您需要多设备同步，可以在“资产”页面底部点击“登录同步”绑定 Google 账号（需科学网络环境）。</li>
            </ul>
          </section>

          {/* 注意事项 */}
          <section>
            <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center"><AlertTriangle className="mr-2 text-red-500" size={20}/> 注意事项</h3>
            <div className="bg-red-50 text-red-700 p-4 rounded-2xl text-sm leading-relaxed border border-red-100">
              <p className="font-bold mb-2 text-base">⚠️ 数据丢失风险警告</p>
              如果您处于“离线模式”（未登录云同步），您的数据仅存在于当前设备的本地缓存中。
              <br/><br/>
              <strong>在卸载应用、清除浏览器缓存、或更换手机前</strong>，请务必在“资产”页面点击“备份数据”将数据导出为文件（已支持完整备份您的资产账户、分类、交易流水、预算设置、快捷模板与存钱目标），否则您的数据将永久丢失！
            </div>
          </section>
        </div>
        
        <div className="p-4 border-t border-gray-100 bg-gray-50 shrink-0">
          <button 
            onClick={onClose}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-colors shadow-sm"
          >
            我已了解
          </button>
        </div>
      </motion.div>
    </div>
  );
}
