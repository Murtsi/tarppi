import { Component, type ReactNode, type ErrorInfo } from 'react'

type Props = { children: ReactNode }
type State = { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  componentDidUpdate(_: Props, prevState: State) {
    if (!prevState.hasError && this.state.hasError) {
      this.errorRef?.focus()
    }
  }

  private errorRef: HTMLDivElement | null = null

  render() {
    if (this.state.hasError) {
      return (
        <div
          ref={el => { this.errorRef = el }}
          role="alert"
          aria-live="assertive"
          tabIndex={-1}
          style={{
            padding: '2rem',
            maxWidth: '600px',
            margin: '4rem auto',
            textAlign: 'center',
            fontFamily: 'system-ui, sans-serif',
            color: '#e0e0e0',
          }}
        >
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Jotain meni pieleen</h1>
          <p style={{ color: '#999', marginBottom: '1.5rem' }}>
            {this.state.error?.message || 'Tapahtui odottamaton virhe'}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button
              onClick={() => this.setState({ hasError: false, error: undefined })}
              style={{
                padding: '0.6rem 1.5rem',
                background: '#4ade80',
                color: '#000',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Yritä uudelleen
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '0.6rem 1.5rem',
                background: 'transparent',
                color: '#999',
                border: '1px solid #444',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Lataa sivu uudelleen
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
