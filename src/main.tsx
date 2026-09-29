import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error('[App error]', error.message); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, color: '#F5F5FA', fontFamily: 'sans-serif' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>حدث خطأ غير متوقع</h1>
          <p style={{ color: '#9CA3AF', marginTop: 8 }}>{this.state.error.message}</p>
          <button
            onClick={() => { this.setState({ error: null }); location.hash = '#/'; location.reload(); }}
            style={{ marginTop: 16, padding: '12px 20px', borderRadius: 16, border: 0, color: '#fff', background: 'linear-gradient(135deg,#7C3AED,#06B6D4)' }}
          >
            إعادة التشغيل
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

window.addEventListener('unhandledrejection', (e) => console.error('[unhandled]', e.reason));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
