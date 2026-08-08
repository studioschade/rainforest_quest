import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { controller } from '@/game/controller';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last-resort guard: a render exception anywhere in the game tree can never
 * blank the app — shows a jungle-styled panel with a one-click reset to title.
 */
export class GameErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[Rainforest Quest] render error:', error, info.componentStack);
  }

  private reloadToTitle = (): void => {
    this.setState({ error: null });
    controller.quitToTitle();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error) {
      return (
        <div className="relative w-screen h-screen bg-[#04140b] overflow-hidden flex items-center justify-center select-none">
          <div className="panel-jungle p-8 w-96 text-center" style={{ borderColor: '#a8433a' }}>
            <div className="text-4xl mb-2">🍃</div>
            <h2
              className="font-retro text-2xl mb-2"
              style={{ color: '#ff8a7a', textShadow: '0 0 12px rgba(255,80,60,0.5), 0 3px 0 #4a1512' }}
            >
              The jungle glitched!
            </h2>
            <p className="text-emerald-200/70 text-sm mb-4 break-words font-mono">
              {String(error.message ?? error)}
            </p>
            <button className="btn-jungle btn-gold w-full" onClick={this.reloadToTitle}>
              Reload to Title
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
