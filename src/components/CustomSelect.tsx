import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from '../utils/icons';
import { motion, AnimatePresence } from 'motion/react';

export interface SelectOption {
  value: string;
  label: string;
  desc?: string;
  icon?: string;
  color?: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: any) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = '请选择...',
  className = '',
  triggerClassName = '',
  disabled = false
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={triggerClassName || "w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl flex justify-between items-center text-left focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm font-medium transition-all duration-200 disabled:opacity-50 text-gray-900 dark:text-gray-100 cursor-pointer"}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-gray-400 dark:text-gray-500 shrink-0 ml-2"
        >
          <ChevronDown size={18} />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 left-0 right-0 mt-1.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-xl max-h-60 overflow-y-auto py-1.5 scrollbar-hide"
          >
            {options.length === 0 ? (
              <div className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 text-center">
                暂无选项
              </div>
            ) : (
              options.map(option => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={`w-full px-4 py-2.5 flex items-center justify-between text-left transition-colors duration-150 group cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 font-bold'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="text-sm truncate">{option.label}</div>
                      {option.desc && (
                        <div className={`text-[10px] mt-0.5 truncate font-normal ${
                          isSelected ? 'text-emerald-600/70 dark:text-emerald-400/70' : 'text-gray-400 dark:text-gray-500'
                        }`}>
                          {option.desc}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <Check size={16} className="text-emerald-500 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
