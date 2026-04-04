interface Segment {
  label: string;
  count: number;
  color: string;
}

interface Props {
  segments: Segment[];
}

export default function LeadFunnel({ segments }: Props) {
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);

  if (!total) return null;

  return (
    <div className="px-4">
      <div className="rounded-full overflow-hidden h-2 flex bg-muted">
        {segments.map((segment) => (
          <div
            key={segment.label}
            style={{
              width: `${(segment.count / total) * 100}%`,
              backgroundColor: segment.color,
            }}
          />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: segment.color }} />
            <span className="text-muted-foreground">{segment.label}</span>
            <span className="font-semibold text-foreground">({segment.count})</span>
          </div>
        ))}
      </div>
    </div>
  );
}
