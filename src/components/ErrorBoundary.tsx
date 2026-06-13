import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Icons } from '../utils/icons';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in application boundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    if (window.confirm('确定要清空所有本地缓存数据吗？此操作不可逆。')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-center select-none font-sans">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-gray-100 flex flex-col items-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6 text-red-500">
              <Icons.AlertTriangle size={36} />
            </div>
            
            <h1 className="text-xl font-bold text-gray-900 mb-2">抱歉，应用发生严重错误</h1>
            <p className="text-gray-500 text-sm mb-6 leading-relaxed">
              系统遇到一个无法自动恢复的运行时异常。请尝试重新加载，或在必要时重置本地缓存。
            </p>
            
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 w-full mb-6 max-h-32 overflow-y-auto text-left">
              <code className="text-xs text-red-700 font-mono break-all font-bold">
                {this.state.error?.name}: {this.state.error?.message}
              </code>
            </div>

            <div className="flex flex-col space-y-2.5 w-full">
              <button
                onClick={this.handleReload}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-md shadow-emerald-500/10 transition-colors flex items-center justify-center space-x-2 text-sm"
              >
                <Icons.RefreshCw size={16} />
                <span>重新加载应用</span>
              </button>
              
              <button
                onClick={this.handleReset}
                className="w-full py-3 bg-red-100 hover:bg-red-200 text-red-700 font-bold rounded-xl transition-colors text-sm"
              >
                清空缓存并重置数据
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.children;
  }
}
