import { useState } from "react";
import { useEmployees } from "@/hooks/useEmployees";
import { useTeams } from "@/hooks/useTeams";
import { useVehicles } from "@/hooks/useVehicles";
import { useClients } from "@/hooks/useClients";
import { useProjects } from "@/hooks/useProjects";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Database, Download, Upload, AlertTriangle, CheckCircle, Users, Car, Building2, FolderKanban, Truck } from "lucide-react";
import { toast } from "sonner";

function exportCSV(data: Record<string, any>[], filename: string) {
  if (!data.length) return toast.error("Nenhum dado para exportar");
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(";"),
    ...data.map(row => headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return "";
      const s = String(val).replace(/"/g, '""');
      return s.includes(";") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
    }).join(";"))
  ].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  toast.success(`${filename} exportado com sucesso!`);
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(";").map(h => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map(line => {
    const values = line.split(";").map(v => v.trim().replace(/^"|"$/g, ""));
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ""; });
    return obj;
  });
}

function DiagnosticCard({ title, icon: Icon, total, issues, ok }: {
  title: string; icon: React.ElementType; total: number; issues: string[]; ok: string[];
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="w-4 h-4 text-primary" /> {title}
          <Badge variant="outline" className="ml-auto">{total} registros</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {issues.map((i, idx) => (
          <div key={idx} className="flex items-start gap-2 text-sm text-amber-700">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {i}
          </div>
        ))}
        {ok.map((o, idx) => (
          <div key={idx} className="flex items-start gap-2 text-sm text-green-700">
            <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {o}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function CadastrosBase() {
  const qc = useQueryClient();
  const { data: employees } = useEmployees();
  const { data: teams } = useTeams();
  const { data: vehicles } = useVehicles();
  const { data: clients } = useClients();
  const { data: projects } = useProjects();
  const [importing, setImporting] = useState(false);

  const empWithoutCpf = (employees || []).filter(e => !e.cpf);
  const empNicknames = (employees || []).filter(e => !e.name.includes(" ") || e.name.length < 8);
  const emptyTeams = (teams || []).filter((t: any) => !t.team_members?.length);

  const handleExportEmployees = () => {
    const data = (employees || []).map(e => ({
      nome: e.name, cpf: e.cpf || "", cargo: e.role, telefone: e.phone || "",
      email: e.email || "", data_admissao: e.admission_date || "", status: e.status,
    }));
    exportCSV(data, "funcionarios_AG.csv");
  };

  const handleExportClients = () => {
    const data = (clients || []).map(c => ({
      nome: c.name, cnpj: c.cnpj || "", email: c.email || "", telefone: c.phone || "",
      endereco: c.address || "", cidade: c.city || "", estado: c.state || "",
      segmento: c.segmento || "", observacoes: c.notes || "",
    }));
    exportCSV(data, "clientes_AG.csv");
  };

  const handleExportTeams = () => {
    const rows: Record<string, string>[] = [];
    (teams || []).forEach((t: any) => {
      if (t.team_members?.length) {
        t.team_members.forEach((tm: any) => {
          rows.push({
            equipe: t.name,
            membro: tm.employees?.name || "",
            funcao: tm.role || "auxiliar",
            veiculo: t.vehicles?.plate || "",
          });
        });
      } else {
        rows.push({ equipe: t.name, membro: "", funcao: "", veiculo: "" });
      }
    });
    exportCSV(rows, "equipes_AG.csv");
  };

  const handleExportVehicles = () => {
    const data = (vehicles || []).map((v: any) => ({
      placa: v.plate, modelo: v.model, marca: v.brand || "", cor: v.color || "",
      ano: v.year || "", km: v.km_current || "", status: v.status,
      proprietario: v.owner_name || "", pernoite: v.home_address || "",
    }));
    exportCSV(data, "veiculos_AG.csv");
  };

  const handleExportProjects = () => {
    const data = (projects || []).map((p: any) => ({
      nome: p.name, cliente: p.client || "", cnpj: p.client_cnpj || "",
      servico: p.service || "", valor: p.contract_value || "",
      empresa: p.empresa_faturadora, tipo_doc: p.tipo_documento,
      inicio: p.start_date || "", fim: p.end_date || "", status: p.status,
    }));
    exportCSV(data, "projetos_AG.csv");
  };

  const handleImportClients = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (!rows.length) throw new Error("Arquivo vazio");
      
      let count = 0;
      for (const row of rows) {
        const name = row.nome || row.name || row["Nome/Razão Social*"] || row["Nome/Razão Social"];
        if (!name) continue;
        const { error } = await supabase.from("clients").insert({
          name,
          cnpj: row.cnpj || row.CNPJ || null,
          email: row.email || row.Email || null,
          phone: row.telefone || row.Telefone || null,
          address: row.endereco || row.Endereço || null,
          city: row.cidade || row.Cidade || null,
          state: row.estado || row.Estado || null,
          segmento: row.segmento || row.Segmento || null,
          notes: row.observacoes || row.Observações || null,
        });
        if (!error) count++;
      }
      toast.success(`${count} clientes importados!`);
      qc.invalidateQueries({ queryKey: ["clients"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const handleImportEmployees = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (!rows.length) throw new Error("Arquivo vazio");
      
      let count = 0;
      for (const row of rows) {
        const name = row.nome || row.name || row["Nome Completo*"] || row["Nome Completo"];
        if (!name) continue;
        const { error } = await supabase.from("employees").insert({
          name,
          cpf: row.cpf || row.CPF || null,
          role: row.cargo || row.Cargo || "Auxiliar",
          phone: row.telefone || row.Telefone || null,
          email: row.email || row.Email || null,
          admission_date: row.data_admissao || row["Data Admissão*"] || null,
          status: (row.status || "disponivel") as any,
        });
        if (!error) count++;
      }
      toast.success(`${count} funcionários importados!`);
      qc.invalidateQueries({ queryKey: ["employees"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Database className="w-6 h-6 text-primary" />
          Cadastros Base
        </h1>
        <p className="text-muted-foreground text-sm">
          Diagnóstico, exportação e importação dos dados fundamentais do sistema
        </p>
      </div>

      {/* Diagnóstico Rápido */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <DiagnosticCard
          title="Funcionários" icon={Users} total={(employees || []).length}
          issues={[
            ...(empWithoutCpf.length ? [`${empWithoutCpf.length} sem CPF cadastrado`] : []),
            ...(empNicknames.length ? [`${empNicknames.length} com apelido (sem nome completo)`] : []),
          ]}
          ok={[
            ...(empWithoutCpf.length === 0 ? ["Todos com CPF ✓"] : []),
            `${(employees || []).length} registros ativos`,
          ]}
        />
        <DiagnosticCard
          title="Equipes" icon={Truck} total={(teams || []).length}
          issues={[
            ...(emptyTeams.length ? [`${emptyTeams.length} equipes sem membros`] : []),
          ]}
          ok={[
            ...(emptyTeams.length === 0 ? ["Todas com membros ✓"] : []),
          ]}
        />
        <DiagnosticCard
          title="Clientes" icon={Building2} total={(clients || []).length}
          issues={[
            ...((clients || []).length < 5 ? ["Carteira quase vazia — importe seus clientes"] : []),
          ]}
          ok={[
            ...((clients || []).length >= 5 ? [`${(clients || []).length} clientes cadastrados`] : []),
          ]}
        />
        <DiagnosticCard
          title="Veículos" icon={Car} total={(vehicles || []).length}
          issues={[]}
          ok={[`${(vehicles || []).length} veículos cadastrados`]}
        />
        <DiagnosticCard
          title="Projetos" icon={FolderKanban} total={(projects || []).length}
          issues={[]}
          ok={[`${(projects || []).length} projetos cadastrados`]}
        />
      </div>

      {/* Exportar / Importar */}
      <Tabs defaultValue="funcionarios">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="funcionarios">Funcionários</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="equipes">Equipes</TabsTrigger>
          <TabsTrigger value="veiculos">Veículos</TabsTrigger>
          <TabsTrigger value="projetos">Projetos</TabsTrigger>
        </TabsList>

        <TabsContent value="funcionarios" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Exportar / Importar Funcionários</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button onClick={handleExportEmployees} variant="outline" className="gap-2">
                <Download className="w-4 h-4" /> Exportar CSV
              </Button>
              <label>
                <Button variant="secondary" className="gap-2 cursor-pointer" asChild disabled={importing}>
                  <span><Upload className="w-4 h-4" /> Importar CSV</span>
                </Button>
                <input type="file" accept=".csv" className="hidden" onChange={handleImportEmployees} />
              </label>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0">
              <div className="max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(employees || []).slice(0, 50).map(e => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">{e.name}</TableCell>
                        <TableCell>
                          {e.cpf || <span className="text-amber-600 text-xs">⚠ sem CPF</span>}
                        </TableCell>
                        <TableCell>{e.role}</TableCell>
                        <TableCell>{e.phone || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={e.status === "disponivel" ? "default" : "secondary"}>
                            {e.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clientes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Exportar / Importar Clientes</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button onClick={handleExportClients} variant="outline" className="gap-2">
                <Download className="w-4 h-4" /> Exportar CSV
              </Button>
              <label>
                <Button variant="secondary" className="gap-2 cursor-pointer" asChild disabled={importing}>
                  <span><Upload className="w-4 h-4" /> Importar CSV</span>
                </Button>
                <input type="file" accept=".csv" className="hidden" onChange={handleImportClients} />
              </label>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0">
              <div className="max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Segmento</TableHead>
                      <TableHead>Cidade/UF</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(clients || []).map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{c.cnpj || "—"}</TableCell>
                        <TableCell>{c.segmento || "—"}</TableCell>
                        <TableCell>{[c.city, c.state].filter(Boolean).join("/") || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="equipes" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Exportar Equipes</CardTitle></CardHeader>
            <CardContent>
              <Button onClick={handleExportTeams} variant="outline" className="gap-2">
                <Download className="w-4 h-4" /> Exportar CSV
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="veiculos" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Exportar Veículos</CardTitle></CardHeader>
            <CardContent>
              <Button onClick={handleExportVehicles} variant="outline" className="gap-2">
                <Download className="w-4 h-4" /> Exportar CSV
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projetos" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Exportar Projetos</CardTitle></CardHeader>
            <CardContent>
              <Button onClick={handleExportProjects} variant="outline" className="gap-2">
                <Download className="w-4 h-4" /> Exportar CSV
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
