import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button, Screen } from './ui'

interface State {
  error: Error | null
}

/**
 * Last line of defense: a render error anywhere below shows a plain screen with a way back to
 * the entrance instead of a blank page. Saves and the walk in progress are kept in storage, so
 * a reload usually picks up where things were.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error('Render error', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    const base = import.meta.env.BASE_URL
    return (
      <Screen
        center
        footer={
          <Button onClick={() => window.location.assign(base)} arrow>
            Back to the entrance
          </Button>
        }
      >
        <div className="spacer" />
        <h1 className="t-headline" style={{ fontSize: 28 }}>
          Something went wrong on this wall.
        </h1>
        <div className="gap-10" />
        <p className="t-small">
          The page hit an error it could not recover from. Your saved paintings are safe. Reload,
          or head back to the entrance and start again.
        </p>
        <div className="gap-16" />
        <button type="button" className="t-link" onClick={() => window.location.reload()}>
          Reload this page
        </button>
        <div className="spacer" />
      </Screen>
    )
  }
}
