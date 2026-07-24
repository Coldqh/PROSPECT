interface ProspectLogoProps {
  compact?: boolean;
}

export function ProspectLogo({ compact = false }: ProspectLogoProps) {
  return (
    <div className={`brand ${compact ? "brand--compact" : ""}`} aria-label="PROSPECT">
      <span className="brand__mark" aria-hidden="true">
        <span>PROSPECT</span>
        <span className="brand__slash">//</span>
      </span>
    </div>
  );
}
