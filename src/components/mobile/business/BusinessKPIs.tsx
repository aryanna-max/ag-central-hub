import type { ReactNode } from "react";

interface KPIItem {
  label: string;
  value: string | number;
  icon: ReactNode;
  subtitle?: string;
}

interface Props {
  items: KPIItem[];
}

export default function BusinessKPIs({ items }: Props) {
  return (
    <div className="flex gap-2 px-4 overflow-x-auto scrollbar-hide pb-1">
      {items.map((item) => (
        <div
          key={item.label}
          className="min-w-[152px] rounded-2xl border border-border/50 bg-card/90 backdrop-blur p-3.5 shadow-sm shrink-0"
        >
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <span className="text-primary">{item.icon}</span>
            <span>{item.label}</span>
          </div>
          <p className="text-lg font-bold text-foreground mt-2">{item.value}</p>
          {item.subtitle ? <p className="text-[11px] text-muted-foreground mt-1">{item.subtitle}</p> : null}
        </div>
      ))}
    </div>
  );
}
