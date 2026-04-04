interface Props {
  teams: number;
  employees: number;
  vehicles: number;
  projects: number;
}

export default function ScheduleStats({ teams, employees, vehicles, projects }: Props) {
  const stats = [
    { emoji: "👥", label: `${teams} equipes` },
    { emoji: "👤", label: `${employees} funcionários` },
    { emoji: "🚗", label: `${vehicles} veículos` },
    { emoji: "📋", label: `${projects} projetos` },
  ];

  return (
    <div className="flex gap-2 px-4 overflow-x-auto scrollbar-hide">
      {stats.map((s) => (
        <div
          key={s.label}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap shrink-0"
          style={{ background: "hsl(var(--primary) / 0.08)" }}
        >
          <span>{s.emoji}</span>
          <span className="text-foreground">{s.label}</span>
        </div>
      ))}
    </div>
  );
}
