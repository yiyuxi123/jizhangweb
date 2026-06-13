import React, { useState, useRef, useEffect } from 'react';
import { Icons } from '../utils/icons';
import { useStore } from '../store/useStore';
import { getAiFinancialAdvice } from '../services/aiService';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AiChatModal({ onClose }: { onClose: () => void }) {
  const { transactions, accounts, budgets, categories } = useStore();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '你好！我是你的 AI 财务分析助手。我可以帮你分析账单、诊断预算超支情况，并给你提供实用的省钱建议。你可以问我类似于“我本月餐饮花销超标了吗？”或“分析我最近的开销”之类的问题。'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestionChips = [
    '分析我本月的收支情况',
    '我本月哪些分类消费超支了？',
    '给我一些实用的省钱理财建议',
    '分析我最近10笔交易'
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const newMessages: Message[] = [...messages, { role: 'user', content: textToSend }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const reply = await getAiFinancialAdvice(
        newMessages,
        transactions,
        accounts,
        budgets,
        categories
      );
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err: any) {
      console.error(err);
      const errMsg = err.message === 'MISSING_API_KEY_DEEPSEEK'
        ? '未配置 DeepSeek API Key。请在「设置」->「AI 智能助理密钥设置」中配置您的 API Key。'
        : '服务响应超时，请检查您的网络连接或稍后再试。';
      setMessages(prev => [...prev, { role: 'assistant', content: errMsg }]);
    } finally {
      setLoading(false);
    }
  };

  // Basic custom renderer to handle bold text, lists, and simple tables from Markdown
  const renderMessageContent = (content: string) => {
    const lines = content.split('\n');
    let inTable = false;
    let tableHeaders: string[] = [];
    let tableRows: string[][] = [];

    return lines.map((line, idx) => {
      // 1. Handle Table rows
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        inTable = true;
        const cells = line.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
        
        // Skip separator line (e.g. |---|---|)
        if (cells.every(c => /^:-*|-*:$/g.test(c) || c.startsWith('-'))) {
          return null;
        }

        if (tableHeaders.length === 0) {
          tableHeaders = cells;
          return null;
        } else {
          tableRows.push(cells);
          
          // If it's the last line or next line is not table, render table
          const nextLine = lines[idx + 1];
          if (!nextLine || !nextLine.trim().startsWith('|')) {
            const headers = [...tableHeaders];
            const rows = [...tableRows];
            tableHeaders = [];
            tableRows = [];
            inTable = false;

            return (
              <div key={`table-${idx}`} className="overflow-x-auto my-3 border border-gray-200 rounded-xl">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {headers.map((h, i) => (
                        <th key={i} className="px-3 py-2 text-left font-bold text-gray-700">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200 text-gray-600">
                    {rows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="px-3 py-2 whitespace-nowrap">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          return null;
        }
      }

      // If we were in a table but it ended
      if (inTable && (!line.trim().startsWith('|') || !line.trim().endsWith('|'))) {
        inTable = false;
        tableHeaders = [];
        tableRows = [];
      }

      // 2. Handle Lists
      const isListItem = line.trim().startsWith('- ') || line.trim().startsWith('* ');
      let lineText = isListItem ? line.trim().substring(2) : line;

      // 3. Handle Bold Formatting (**bold**)
      const parts = lineText.split('**');
      const formattedText = parts.map((part, i) => {
        if (i % 2 === 1) {
          return <strong key={i} className="font-extrabold text-gray-900 bg-emerald-50 px-0.5 rounded">{part}</strong>;
        }
        return part;
      });

      if (isListItem) {
        return (
          <li key={idx} className="ml-4 list-disc text-sm text-gray-800 my-1">
            {formattedText}
          </li>
        );
      }

      return (
        <p key={idx} className="text-sm text-gray-800 my-1.5 leading-relaxed">
          {formattedText}
        </p>
      );
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/40 backdrop-blur-sm">
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-gray-50 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden h-[85vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex justify-between items-center p-4 bg-white border-b border-gray-100 shrink-0">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white">
                <Icons.Sparkles size={16} className="text-yellow-300" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">AI 智能财务助手</h3>
                <span className="text-[10px] text-emerald-500 font-medium">DeepSeek-V3 引擎已连接</span>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
              <Icons.X size={20} />
            </button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, index) => {
              const isAssistant = msg.role === 'assistant';
              return (
                <div key={index} className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[85%] rounded-2xl p-3 shadow-sm border ${
                    isAssistant 
                      ? 'bg-white text-gray-800 border-gray-100 rounded-tl-none' 
                      : 'bg-emerald-500 text-white border-emerald-400 rounded-tr-none'
                  }`}>
                    {isAssistant ? (
                      <div>{renderMessageContent(msg.content)}</div>
                    ) : (
                      <p className="text-sm font-medium leading-relaxed">{msg.content}</p>
                    )}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white text-gray-400 border border-gray-100 rounded-2xl rounded-tl-none p-3 shadow-sm flex items-center space-x-2">
                  <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Prompt Suggestions */}
          {messages.length === 1 && !loading && (
            <div className="px-4 py-2 bg-gray-50 flex flex-wrap gap-2 border-t border-gray-100 shrink-0">
              {suggestionChips.map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(chip)}
                  className="px-2.5 py-1.5 bg-white hover:bg-gray-100 border border-gray-200 text-xs text-gray-600 font-medium rounded-full transition-colors shadow-sm"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {/* Input Panel */}
          <div className="p-4 bg-white border-t border-gray-100 shrink-0 flex items-center space-x-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend(input)}
              placeholder="向 AI 财务助手提问..."
              className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
            />
            <button
              onClick={() => handleSend(input)}
              disabled={!input.trim() || loading}
              className={`p-3 rounded-xl transition-colors shrink-0 ${
                input.trim() && !loading
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Icons.Send size={18} />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
