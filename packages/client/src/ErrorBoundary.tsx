import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

/**
 * Catches render errors so a single failing component (or an accidental render
 * loop) shows a recoverable message instead of blanking the whole app.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('App render error:', error, info)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <h2>⚠️ 화면을 표시하는 중 오류가 발생했습니다</h2>
          <pre>{this.state.error.message}</pre>
          <button onClick={() => this.setState({ error: null })}>다시 시도</button>
          <button onClick={() => location.reload()}>새로고침</button>
        </div>
      )
    }
    return this.props.children
  }
}
