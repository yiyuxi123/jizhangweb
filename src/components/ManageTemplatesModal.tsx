import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { X, Plus, Edit2, Zap } from 'lucide-react';
import * as Icons from 'lucide-react';
import { TransactionTemplate } from '../types';
import TemplateModal from './TemplateModal';
import { motion } from 'motion/react';

export default function ManageTemplatesModal({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { templates, categories } = useStore();
  const [selectedTemplate, setSelectedTemplate] = useState<TransactionTemplate | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden h-[75vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-100 shrink-0">
          <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full">
            <X size={20} />
          </button>
          <h3 className="font-bold text-gray-900 text-sm flex items-center space-x-1">
            <Zap size={16} className="text-yellow-500 fill-yellow-500" />
            <span>管理快捷记账模板</span>
          </h3>
          <button
            type="button"
            onClick={() => {
              setSelectedTemplate(null);
              setIsEditorOpen(true);
            }}
            className="p-2 text-emerald-600 hover:text-emerald-700 rounded-full"
            title="添加新模板"
          >
            <Plus size={20} />
          </button>
        </div>

        {/* Templates List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {templates.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-gray-400">
              <Zap size={48} className="text-gray-300 mb-2" />
              <p className="text-sm">暂无快捷模板，点击右上角 “+” 添加一个吧！</p>
            </div>
          ) : (
            templates.map(tpl => {
              const category = categories.find(c => c.id === tpl.categoryId);
              const IconComponent = category ? (Icons as any)[category.icon] : Icons.ArrowRightLeft;
              
              return (
                <div
                  key={tpl.id}
                  className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0"
                      style={{ backgroundColor: tpl.type === 'transfer' ? '#6b7280' : category?.color || '#9ca3af' }}
                    >
                      {IconComponent && <IconComponent size={20} />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-gray-900 truncate">{tpl.name}</p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">
                        {tpl.type === 'expense' ? '支出' : tpl.type === 'income' ? '收入' : '转账'}
                        {tpl.amount ? ` · 预设金额 ¥${tpl.amount}` : ' · 每次输入金额'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTemplate(tpl);
                      setIsEditorOpen(true);
                    }}
                    className="p-2 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <Edit2 size={16} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Editor Modal */}
        {isEditorOpen && (
          <TemplateModal
            isOpen={isEditorOpen}
            onClose={() => setIsEditorOpen(false)}
            templateToEdit={selectedTemplate}
          />
        )}
      </motion.div>
    </div>
  );
}
