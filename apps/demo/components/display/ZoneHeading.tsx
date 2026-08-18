export function ZoneHeading({
  note,
  label,
  count,
  total,
  className = '',
}: {
  note?: string;
  label: string;
  count: number;
  total?: number;
  className?: string;
}) {
  return (
    <div className={`zone-heading ${note ? '' : 'is-note-free'} ${className}`}>
      <div>{note ? <span className="zone-note">{note}</span> : null}<h2>{label}</h2></div>
      <span className="zone-count">{count}{total ? <small>/ {total}</small> : null}</span>
    </div>
  );
}
