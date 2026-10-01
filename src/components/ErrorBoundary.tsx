import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/** Shows a readable error instead of a blank screen if rendering crashes. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Quest crashed:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div role="alert" style={{ padding: 24, fontFamily: 'system-ui, sans-serif', color: '#f6f5f1', background: '#0a0a0b', minHeight: '100dvh' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Something went wrong</h1>
        <p style={{ marginTop: 8, color: '#a6a6ad' }}>Your data is safe. Copy the message below if you need help.</p>
        <pre style={{ marginTop: 16, padding: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#1f1f23', fontSize: 13 }}>
          {error.name}: {error.message}
          {'\n'}
          {error.stack?.split('\n').slice(0, 6).join('\n')}
          {'\n\n'}
          {navigator.userAgent}
        </pre>
        <button
          onClick={() => window.location.reload()}
          style={{ marginTop: 16, padding: '12px 20px', background: '#e5172c', color: '#fff', fontWeight: 700, border: 0 }}
        >
          Reload
        </button>
      </div>
    )
  }
}
