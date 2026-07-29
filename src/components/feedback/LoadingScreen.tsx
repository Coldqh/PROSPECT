interface LoadingScreenProps {
  label: string;
}

export function LoadingScreen({ label }: LoadingScreenProps) {
  return (
    <main className="loading-screen loading-screen--prospect" aria-live="polite" aria-busy="true">
      <section className="prospect-loader">
        <header>
          <span>CAREER SIMULATION</span>
          <strong>PROSPECT</strong>
          <small>BUILD YOUR NAME</small>
        </header>

        <div className="prospect-loader__field" aria-hidden="true">
          <i className="prospect-loader__line prospect-loader__line--one" />
          <i className="prospect-loader__line prospect-loader__line--two" />
          <i className="prospect-loader__line prospect-loader__line--three" />
          <b>50</b>
          <span className="prospect-loader__ball" />
        </div>

        <footer>
          <div><i /></div>
          <span>{label}</span>
        </footer>
      </section>
    </main>
  );
}
