import { Component, type ErrorInfo, type ReactNode } from 'react';

export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('PasteBin UI error', error.message, info.componentStack); }
  render() {
    if (this.state.failed) return <main className="flex min-h-screen items-center justify-center bg-dark-950 p-6 text-white"><section className="glass-card max-w-lg p-8 text-center"><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 font-mono text-red-300">!</div><h1 className="text-2xl font-bold">The interface hit an unexpected error</h1><p className="mt-2 text-sm leading-6 text-gray-400">Your saved pastes and local draft are safe. Reload the interface to recover.</p><button onClick={() => location.reload()} className="btn-primary mt-5">Reload PasteBin</button></section></main>;
    return this.props.children;
  }
}
