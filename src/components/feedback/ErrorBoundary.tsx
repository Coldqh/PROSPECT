import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("PROSPECT UI failure", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="fatal-screen">
          <div className="fatal-screen__panel">
            <span className="eyebrow">Ошибка интерфейса</span>
            <h1>PROSPECT не смог открыть экран</h1>
            <p>Перезагрузи приложение. Сохранения находятся в IndexedDB и не удаляются.</p>
            <button className="button button--primary" onClick={() => window.location.reload()}>
              Перезагрузить
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
