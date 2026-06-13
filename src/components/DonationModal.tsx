import React from 'react';
import { X, Heart, Coffee } from '../utils/icons';
import { motion } from 'motion/react';

export default function DonationModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="relative h-32 bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0">
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-black/10 hover:bg-black/20 rounded-full backdrop-blur-md transition-colors"
          >
            <X size={20} />
          </button>
          <div className="text-center text-white">
            <Heart size={48} className="mx-auto mb-2 text-pink-300 drop-shadow-md" fill="currentColor" />
            <h2 className="text-xl font-bold drop-shadow-sm">感谢您的支持</h2>
          </div>
        </div>

        <div className="p-6 flex-1 overflow-y-auto text-center space-y-6">
          <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
            这个应用是我利用业余时间独立开发的。如果您觉得它好用，帮到了您，可以请我喝杯咖啡 ☕️
            您的支持是我持续更新和维护的最大动力！
          </p>

          <div className="flex justify-center space-x-4">
            <div className="space-y-2">
              <div className="w-32 h-32 bg-gray-50 dark:bg-gray-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center p-2 overflow-hidden">
                <img src="/wechat-pay.jpg" alt="微信收款码" className="w-full h-full object-cover rounded-xl" />
              </div>
              <p className="text-xs font-medium text-emerald-600">微信支付</p>
            </div>
            
            <div className="space-y-2">
              <div className="w-32 h-32 bg-gray-50 dark:bg-gray-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center p-2 overflow-hidden">
                <img src="/alipay.jpg" alt="支付宝收款码" className="w-full h-full object-cover rounded-xl" />
              </div>
              <p className="text-xs font-medium text-blue-500">支付宝</p>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <button 
              onClick={onClose}
              className="w-full py-3 bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 text-gray-700 dark:text-gray-200 font-medium rounded-xl transition-colors"
            >
              下次一定
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
