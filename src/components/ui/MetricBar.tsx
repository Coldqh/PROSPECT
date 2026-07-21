interface MetricBarProps {
  label: string;
  value: number;
  detail?: string;
  compact?: boolean;
}

export function MetricBar({ label, value, detail, compact = false }: MetricBarProps) {
  const bounded = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={compact ? "metric-bar metric-bar--compact" : "metric-bar"}>
      <div className="metric-bar__head">
        <span>{label}</span>
        <strong>{detail ?? bounded}</strong>
      </div>
      <div className="metric-bar__track"><i style={{ width: `${bounded}%` }} /></div>
    </div>
  );
}
