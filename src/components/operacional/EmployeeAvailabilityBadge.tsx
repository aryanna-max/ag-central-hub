import { Badge } from "@/components/ui/badge";

type Availability = "disponivel" | "ferias" | "licenca" | "afastado" | "em_obra";

const config: Record<Availability, { label: string; className: string }> = {
  disponivel: { label: "Disponível", className: "bg-green-600 text-white hover:bg-green-700" },
  ferias: { label: "Férias", className: "bg-amber-500 text-white hover:bg-amber-600" },
  licenca: { label: "Licença", className: "bg-orange-500 text-white hover:bg-orange-600" },
  afastado: { label: "Afastado", className: "bg-red-600 text-white hover:bg-red-700" },
  em_obra: { label: "Em outra obra", className: "bg-blue-600 text-white hover:bg-blue-700" },
};

export default function EmployeeAvailabilityBadge({ availability }: { availability: Availability }) {
  const { label, className } = config[availability] || config.disponivel;
  return <Badge className={className}>{label}</Badge>;
}
