import { Badge } from "@/components/ui/badge";

interface Props {
  id: string;
  name: string;
  role: string;
  attendance: string | null;
  isClosed: boolean;
  onAttendanceChange?: (entryId: string, status: string) => void;
}

const roleBadgeStyles: Record<string, string> = {
  topografo: "bg-primary text-primary-foreground",
  lider: "bg-primary text-primary-foreground",
  operador: "bg-accent text-accent-foreground",
  auxiliar: "bg-muted text-muted-foreground",
};

const attendanceCycle = ["presente", "falta", "justificado"];
const attendanceIcons: Record<string, string> = {
  presente: "✅",
  falta: "❌",
  justificado: "⏳",
};

export default function MemberRow({ id, name, role, attendance, isClosed, onAttendanceChange }: Props) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleCycleAttendance = () => {
    if (isClosed || !onAttendanceChange) return;
    const currentIndex = attendanceCycle.indexOf(attendance || "");
    const next = attendanceCycle[(currentIndex + 1) % attendanceCycle.length];
    onAttendanceChange(id, next);
  };

  const badgeClass = roleBadgeStyles[role.toLowerCase()] || roleBadgeStyles.auxiliar;

  return (
    <div className="flex items-center gap-3 py-1.5">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
        style={{
          background: "hsl(var(--primary) / 0.15)",
          color: "hsl(var(--primary))",
        }}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{name}</p>
        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${badgeClass}`}>
          {role}
        </Badge>
      </div>
      <button
        onClick={handleCycleAttendance}
        disabled={isClosed}
        className="text-lg shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted/50 transition-colors disabled:opacity-50"
      >
        {attendanceIcons[attendance || ""] || "⏳"}
      </button>
    </div>
  );
}
