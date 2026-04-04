import * as React from "react";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

export type SortDir = "asc" | "desc" | null;

interface SortableTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortKey?: string;
  currentSort?: string | null;
  currentDir?: SortDir;
  onSort?: (key: string) => void;
}

const SortableTableHead = React.forwardRef<HTMLTableCellElement, SortableTableHeadProps>(
  ({ className, children, sortKey, currentSort, currentDir, onSort, ...props }, ref) => {
    const isActive = sortKey && currentSort === sortKey;
    const handleClick = () => {
      if (sortKey && onSort) onSort(sortKey);
    };

    return (
      <th
        ref={ref}
        className={cn(
          "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
          sortKey && onSort && "cursor-pointer select-none hover:text-foreground transition-colors",
          className,
        )}
        onClick={sortKey && onSort ? handleClick : undefined}
        {...props}
      >
        <span className="inline-flex items-center gap-1">
          {children}
          {sortKey && onSort && (
            isActive ? (
              currentDir === "asc" ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />
            ) : (
              <ArrowUpDown className="w-3 h-3 opacity-40" />
            )
          )}
        </span>
      </th>
    );
  },
);
SortableTableHead.displayName = "SortableTableHead";

export function useSortableTable<T>(data: T[], defaultKey?: string, defaultDir: SortDir = null) {
  const [sortKey, setSortKey] = React.useState<string | null>(defaultKey || null);
  const [sortDir, setSortDir] = React.useState<SortDir>(defaultDir);

  const handleSort = React.useCallback((key: string) => {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else if (sortDir === "desc") { setSortKey(null); setSortDir(null); }
      else setSortDir("asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }, [sortKey, sortDir]);

  const sorted = React.useMemo(() => {
    if (!sortKey || !sortDir) return data;
    return [...data].sort((a: any, b: any) => {
      let va = a[sortKey];
      let vb = b[sortKey];
      // Handle nested objects (e.g. clients.name)
      if (sortKey.includes(".")) {
        const parts = sortKey.split(".");
        va = parts.reduce((o: any, k) => o?.[k], a);
        vb = parts.reduce((o: any, k) => o?.[k], b);
      }
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortDir]);

  return { sorted, sortKey, sortDir, handleSort };
}

export { SortableTableHead };
