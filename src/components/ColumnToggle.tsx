import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { SlidersHorizontal } from "lucide-react";

export interface ColumnDef {
  key: string;
  label: string;
  defaultVisible?: boolean;
}

interface Props {
  columns: ColumnDef[];
  visibleColumns: Set<string>;
  onToggle: (key: string) => void;
}

export function useColumnVisibility(columns: ColumnDef[]) {
  const [visible, setVisible] = useState<Set<string>>(
    new Set(columns.filter((c) => c.defaultVisible !== false).map((c) => c.key))
  );
  const toggle = (key: string) =>
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const isVisible = (key: string) => visible.has(key);
  return { visibleColumns: visible, toggle, isVisible };
}

export default function ColumnToggle({ columns, visibleColumns, onToggle }: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5">
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">Colunas</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-2">
        <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">Colunas visíveis</p>
        {columns.map((col) => (
          <label
            key={col.key}
            className="flex items-center gap-2 px-1 py-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm"
          >
            <Checkbox
              checked={visibleColumns.has(col.key)}
              onCheckedChange={() => onToggle(col.key)}
            />
            {col.label}
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}
