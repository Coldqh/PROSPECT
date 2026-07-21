interface LoadingScreenProps {
  label: string;
}

export function LoadingScreen({ label }: LoadingScreenProps) {
  return (
    <main className="loading-screen" aria-live="polite">
      <span className="loading-screen__mark">P</span>
      <span>{label}</span>
    </main>
  );
}
