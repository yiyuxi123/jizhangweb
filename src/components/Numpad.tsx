import { Icons } from '../utils/icons';

interface NumpadProps {
  value: string;
  onChange: (value: string) => void;
  onComplete: () => void;
}

export default function Numpad({ value, onChange, onComplete }: NumpadProps) {
  const handleNumberClick = (num: string) => {
    if (num === '.' && value.includes('.')) return;
    if (value === '') {
      if (num === '.') {
        onChange('0.');
        return;
      }
      if (num === '00' || num === '0') {
        onChange('0');
        return;
      }
    }
    if (value === '0' && num !== '.') {
      onChange(num === '00' ? '0' : num);
    } else {
      if (value.includes('.')) {
        const [, decimal] = value.split('.');
        if (decimal && decimal.length >= 2) return;
        if (num === '00' && decimal && decimal.length === 1) {
          onChange(value + '0');
          return;
        }
      }
      onChange(value + num);
    }
  };

  const handleDelete = () => {
    onChange(value.slice(0, -1));
  };

  const handleClear = () => {
    onChange('');
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-4 shrink-0 animate-in slide-in-from-bottom-10">
      <div className="grid grid-cols-4 gap-2">
        <button type="button" onClick={() => handleNumberClick('1')} className="bg-white dark:bg-gray-800 text-xl font-bold text-gray-900 dark:text-gray-100 py-4 rounded-xl shadow-sm active:bg-gray-100 dark:active:bg-gray-700 transition-all active:scale-95 duration-100">1</button>
        <button type="button" onClick={() => handleNumberClick('2')} className="bg-white dark:bg-gray-800 text-xl font-bold text-gray-900 dark:text-gray-100 py-4 rounded-xl shadow-sm active:bg-gray-100 dark:active:bg-gray-700 transition-all active:scale-95 duration-100">2</button>
        <button type="button" onClick={() => handleNumberClick('3')} className="bg-white dark:bg-gray-800 text-xl font-bold text-gray-900 dark:text-gray-100 py-4 rounded-xl shadow-sm active:bg-gray-100 dark:active:bg-gray-700 transition-all active:scale-95 duration-100">3</button>
        <button type="button" onClick={handleDelete} className="bg-gray-200 dark:bg-gray-700 text-xl font-bold text-gray-900 dark:text-gray-100 py-4 rounded-xl shadow-sm active:bg-gray-300 dark:active:bg-gray-600 flex items-center justify-center transition-all active:scale-95 duration-100"><Icons.Delete size={24} /></button>
        
        <button type="button" onClick={() => handleNumberClick('4')} className="bg-white dark:bg-gray-800 text-xl font-bold text-gray-900 dark:text-gray-100 py-4 rounded-xl shadow-sm active:bg-gray-100 dark:active:bg-gray-700 transition-all active:scale-95 duration-100">4</button>
        <button type="button" onClick={() => handleNumberClick('5')} className="bg-white dark:bg-gray-800 text-xl font-bold text-gray-900 dark:text-gray-100 py-4 rounded-xl shadow-sm active:bg-gray-100 dark:active:bg-gray-700 transition-all active:scale-95 duration-100">5</button>
        <button type="button" onClick={() => handleNumberClick('6')} className="bg-white dark:bg-gray-800 text-xl font-bold text-gray-900 dark:text-gray-100 py-4 rounded-xl shadow-sm active:bg-gray-100 dark:active:bg-gray-700 transition-all active:scale-95 duration-100">6</button>
        <button type="button" onClick={handleClear} className="bg-gray-200 dark:bg-gray-700 text-xl font-bold text-gray-900 dark:text-gray-100 py-4 rounded-xl shadow-sm active:bg-gray-300 dark:active:bg-gray-600 transition-all active:scale-95 duration-100">C</button>
        
        <button type="button" onClick={() => handleNumberClick('7')} className="bg-white dark:bg-gray-800 text-xl font-bold text-gray-900 dark:text-gray-100 py-4 rounded-xl shadow-sm active:bg-gray-100 dark:active:bg-gray-700 transition-all active:scale-95 duration-100">7</button>
        <button type="button" onClick={() => handleNumberClick('8')} className="bg-white dark:bg-gray-800 text-xl font-bold text-gray-900 dark:text-gray-100 py-4 rounded-xl shadow-sm active:bg-gray-100 dark:active:bg-gray-700 transition-all active:scale-95 duration-100">8</button>
        <button type="button" onClick={() => handleNumberClick('9')} className="bg-white dark:bg-gray-800 text-xl font-bold text-gray-900 dark:text-gray-100 py-4 rounded-xl shadow-sm active:bg-gray-100 dark:active:bg-gray-700 transition-all active:scale-95 duration-100">9</button>
        <button type="button" onClick={onComplete} className="row-span-2 bg-emerald-500 text-white text-xl font-bold rounded-xl shadow-sm active:bg-emerald-600 dark:active:bg-emerald-400 flex items-center justify-center transition-all active:scale-95 duration-100">完成</button>
        
        <button type="button" onClick={() => handleNumberClick('.')} className="bg-white dark:bg-gray-800 text-xl font-bold text-gray-900 dark:text-gray-100 py-4 rounded-xl shadow-sm active:bg-gray-100 dark:active:bg-gray-700 transition-all active:scale-95 duration-100">.</button>
        <button type="button" onClick={() => handleNumberClick('0')} className="bg-white dark:bg-gray-800 text-xl font-bold text-gray-900 dark:text-gray-100 py-4 rounded-xl shadow-sm active:bg-gray-100 dark:active:bg-gray-700 transition-all active:scale-95 duration-100">0</button>
        <button type="button" onClick={() => handleNumberClick('00')} className="bg-white dark:bg-gray-800 text-xl font-bold text-gray-900 dark:text-gray-100 py-4 rounded-xl shadow-sm active:bg-gray-100 dark:active:bg-gray-700 transition-all active:scale-95 duration-100">00</button>
      </div>
    </div>
  );
}
