import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useEmployees } from "@/hooks/useEmployees";
import { useTeams } from "@/hooks/useTeams";
import { useVehicles } from "@/hooks/useVehicles";
import { useClients } from "@/hooks/useClients";
import { useProjects } from "@/hooks/useProjects";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Shield, Users, Building2, Car, FolderKanban, Truck,
  ExternalLink, Eye,
} from "lucide-react";

interface AdminCard {
  title: string;
  description: string;
  icon: React.ElementType;
  count: number;
  path: string;
  editable: boolean;
}

export default function CadastrosBase() {
  const navigate = useNavigate();
  const { data: employees } = useEmployees();
  const { data: teams } = useTeams();
  const { data: vehicles } = useVehicles();
  const { data: clients } = useClients();
  const { data: projects } = useProjects();

  const cards: AdminCard[] = useMemo(() => [
    {
      title: "Funcionários",
      description: "Cadastro completo de funcionários, cargos e status",
      icon: Users,
      count: (employees || []).length,
      path: "/rh/funcionarios",
      editable: true,
    },
    {
      title: "Clientes",
      description: "Cadastro de clientes, CNPJ/CPF e código de 3 letras",
      icon: Building2,
      count: (clients || []).length,
      path: "/comercial/clientes",
      editable: true,
    },
    {
      title: "Projetos",
      description: "Projetos ativos, valor de contrato e empresa faturadora",
      icon: FolderKanban,
      count: (projects || []).length,
      path: "/projetos",
      editable: true,
    },
    {
      title: "Veículos",
      description: "Frota, diárias, motorista responsável e status",
      icon: Car,
      count: (vehicles || []).length,
      path: "/operacional/veiculos",
      editable: true,
    },
    {
      title: "Equipes",
      description: "Composição de equipes, veículo e projeto padrão",
      icon: Truck,
      count: (teams || []).length,
      path: "/operacional/equipes",
      editable: false,
    },
  ], [employees, clients, projects, vehicles, teams]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" />
          Administração — Cadastros
        </h1>
        <p className="text-muted-foreground text-sm">
          Atalhos para os cadastros do sistema. Edições aqui atualizam todos os módulos automaticamente.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.path} className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => navigate(card.path)}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="w-5 h-5 text-primary" />
                  {card.title}
                  <Badge variant="outline" className="ml-auto">{card.count}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{card.description}</p>
                <Button
                  variant={card.editable ? "default" : "outline"}
                  size="sm"
                  className="gap-2 w-full"
                >
                  {card.editable ? (
                    <>
                      <ExternalLink className="w-3.5 h-3.5" />
                      Abrir cadastro
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      Visualizar
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
