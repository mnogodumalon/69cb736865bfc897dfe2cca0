import { Component, type ReactNode, type ErrorInfo } from 'react';
import { IconAlertTriangle, IconRefresh, IconTool } from '@tabler/icons-react';

const APPGROUP_ID = '69cb736865bfc897dfe2cca0';
const REPAIR_URL = '/claude/repair';

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, error: null, componentStack: '' };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? '' });
  }

  handleRepair = () => {
    const ctx = JSON.stringify({
      type: 'render_crash',
      message: this.state.error?.message ?? 'Unknown error',
      stack: (this.state.error?.stack ?? '').split('\n').slice(0, 5).join('\n'),
      componentStack: this.state.componentStack.split('\n').slice(0, 5).join('\n'),
      url: window.location.href,
    });
    window.open(
      `${REPAIR_URL}?appgroup_id=${APPGROUP_ID}&error=${encodeURIComponent(ctx)}`,
      '_blank',
    );
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8">
        <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <IconAlertTriangle size={22} className="text-destructive" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Etwas ist schiefgelaufen</h3>
          <p className="text-sm text-muted-foreground max-w-md">{this.state.error?.message}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
          >
            <IconRefresh size={14} />
            Neu laden
          </button>
          <button
            onClick={this.handleRepair}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <IconTool size={14} />
            Dashboard reparieren
          </button>
        </div>
      </div>
    );
  }
}
