interface ProspectLogoProps {
  compact?: boolean;
}

export function ProspectLogo({ compact = false }: ProspectLogoProps) {
  return (
    <div className="brand" aria-label="PROSPECT">
      <span className="brand__mark" aria-hidden="true">
        P
      </span>
      {!compact && (
        <span className="brand__copy">
          <strong>PROSPECT</strong>
          <small>Build the career. Live the life.</small>
        </span>
      )}
    </div>
  );
}
