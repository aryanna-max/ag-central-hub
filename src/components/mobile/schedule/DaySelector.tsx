import { useState } from "react";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  selectedDate: Date;
  onSelect: (date: Date) => void;
  datesWithSchedule?: string[];
}

export default function DaySelector({ selectedDate, onSelect, datesWithSchedule = [] }: Props) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(selectedDate, { weekStartsOn: 1 }));

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dayLetters = ["S", "T", "Q", "Q", "S", "S", "D"];

  return (
    <div className="flex items-center gap-1 px-4">
      <button
        onClick={() => setWeekStart(addDays(weekStart, -7))}
        className="p-1.5 rounded-full text-muted-foreground hover:bg-muted/50 shrink-0"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div className="flex-1 flex justify-between gap-1 overflow-x-auto scroll-snap-x scrollbar-hide">
        {days.map((day, i) => {
          const isSelected = isSameDay(day, selectedDate);
          const hasSchedule = datesWithSchedule.includes(format(day, "yyyy-MM-dd"));
          const isToday = isSameDay(day, new Date());

          return (
            <button
              key={i}
              onClick={() => onSelect(day)}
              className="flex flex-col items-center gap-0.5 py-2 px-2.5 rounded-xl transition-colors min-w-[40px] scroll-snap-start"
              style={{
                background: isSelected ? "hsl(var(--primary))" : "transparent",
                color: isSelected ? "hsl(var(--primary-foreground))" : undefined,
              }}
            >
              <span className={`text-[10px] font-medium ${!isSelected ? "text-muted-foreground" : ""}`}>
                {dayLetters[i]}
              </span>
              <span className={`text-sm font-semibold ${isToday && !isSelected ? "text-primary" : ""}`}>
                {format(day, "d")}
              </span>
              {hasSchedule && !isSelected && (
                <div className="w-1.5 h-1.5 rounded-full bg-accent" />
              )}
              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => setWeekStart(addDays(weekStart, 7))}
        className="p-1.5 rounded-full text-muted-foreground hover:bg-muted/50 shrink-0"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
