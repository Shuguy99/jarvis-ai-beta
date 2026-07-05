import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Toaster } from './components/ui/toaster';
import './app/globals.css';

class GlobalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[JARVIS] Fatal UI error:', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0f] text-[#00d4ff] font-mono p-8">
          <div className="text-6xl mb-6 opacity-30">⚠</div>
          <h1 className="text-2xl font-bold mb-2 tracking-widest">SYSTEM FAILURE</h1>
          <p className="text-sm text-[#00d4ff]/60 mb-2 max-w-lg text-center">
            Критическая ошибка интерфейса JARVIS
          </p>
          <p className="text-xs text-[#00d4ff]/40 mb-8 max-w-lg text-center font-mono break-all">
            {this.state.error?.message}
          </p>
          <button
            onClick={this.handleRetry}
            className="px-6 py-2 border border-[#00d4ff]/30 rounded text-sm hover:bg-[#00d4ff]/10 transition-colors cursor-pointer"
          >
            Перезагрузить систему
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <App />
      <Toaster />
    </GlobalErrorBoundary>
  </React.StrictMode>
);