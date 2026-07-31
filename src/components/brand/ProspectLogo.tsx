interface ProspectLogoProps {
  compact?: boolean;
}

export function ProspectLogo({ compact = false }: ProspectLogoProps) {
  return (
    <div className={`brand ${compact ? "brand--compact" : ""}`} aria-label="PROSPECT Football Management">
      <span className="brand__badge" aria-hidden="true">P</span>
      <span className="brand__copy">
        <strong>PROSPECT</strong>
        {!compact && <small>FOOTBALL MANAGEMENT</small>}
      </span>
    </div>
  );
}
