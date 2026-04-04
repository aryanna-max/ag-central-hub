import { useState } from "react";
import { ChevronDown, ChevronUp, Car } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import MemberRow from "./MemberRow";

interface Member {
  id: string;
  name: string;
  role: string;
  attendance: string | null;
}

interface Props {
  teamName: string;
  projectName: string | null;
  vehicleName: string | null;
  members: Member[];
  isClosed: boolean;
  onAttendanceChange?: (entryId: string, status: string) => void;
}

const teamColors: Record<string, string> = {
  topografia: "hsl(var(--primary))",
  levantamento: "hsl(var(--accent))",
  marcacao: "hsl(var(--secondary))",
};

export default function TeamCard({ teamName, projectName, vehicleName, members, isClosed, onAttendanceChange }: Props) {
  const [expanded, setExpanded] = useState(false);

  const barColor = teamColors[teamName.toLowerCase().split(" ")[0]] || "hsl(var(--primary))";

  return (
    <div
      className="mx-4 mb-3 rounded-2xl border border-border/40 overflow-hidden transition-all"
      style={{
        background: "hsl(var(--card) / 0.92)",
        backdropFilter: "blur(10px)",
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 p-4 text-left"
      >
        <div className="w-1 self-stretch rounded-full shrink-0" style={{ background: barColor }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-base text-foreground truncate">{teamName}</span>
            {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
          </div>
          {projectName && (
            <p className="text-sm text-muted-foreground truncate">{projectName}</p>
          )}
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span>{members.length} membros</span>
            {vehicleName && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Car className="w-3 h-3" />
                  {vehicleName}
                </span>
              </>
            )}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-border/30 pt-3">
          {members.map((m) => (
            <MemberRow
              key={m.id}
              {...m}
              isClosed={isClosed}
              onAttendanceChange={onAttendanceChange}
            />
          ))}
          {members.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">Nenhum membro alocado</p>
          )}
        </div>
      )}
    </div>
  );
}
