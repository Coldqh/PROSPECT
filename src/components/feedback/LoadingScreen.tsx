import { SkeletonCard } from "./ContentState";

interface LoadingScreenProps {
  label: string;
}

export function LoadingScreen({ label }: LoadingScreenProps) {
  return (
    <main className="loading-screen" aria-live="polite" aria-busy="true">
      <header className="loading-screen__header">
        <span className="loading-screen__mark">P</span>
        <div><strong>PROSPECT</strong><span>{label}</span></div>
      </header>
      <div className="loading-screen__grid">
        <SkeletonCard tall />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </main>
  );
}
