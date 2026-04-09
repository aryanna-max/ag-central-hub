import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle } from "lucide-react";
import { useClients, useCreateClient, type Client } from "@/hooks/useClients";
import { useCreateProject, useProjects } from "@/hooks/useProjects";
import { useUpdateLead, type Lead } from "@/hooks/useLeads";
import { useCreateAlerts, type AlertInsert } from "@/hooks/useAlerts";
import { useEmployees } from "@/hooks/useEmployees";
import { isDirector } from "@/lib/fieldRoles";
import { useCreateProjectContacts } from "@/hooks/useProjectContacts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function suggestCode(name: string): string {
  const stopWords = ["de", "do", "da", "dos", "das", "e", "o", "a", "os", "as", "em", "no", "na", "nos", "nas", "para", "por", "com", "sem", "sob", "sobre"];
  const words = name
    .replace(/[&\-–—.,/\\()]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0 && !stopWords.includes(w.toLowerCase()));
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].substring(0, 3).toUpperCase();
  if (words.length === 2) return (words[0][0] + words[1][0] + (words[1][1] || words[0][1] || "")).toUpperCase();
  return (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
}

async function generateProjectCode(clientCodigo: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `${year}-${clientCodigo}-`;
  const { data: existing } = await supabase
    .from("projects")
    .select("codigo")
    .like("codigo" as any, `${prefix}%`);
  const seq = (existing?.length || 0) + 1;
  return `${prefix}${String(seq).padStart(3, "0")}`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  onConverted?: () => void;
}

export default function LeadConversionDialog({ open, onOpenChange, lead, onConverted }: Props) {
  const { data: clients = [] } = useClients();
  const { data: employees = [] } = useEmployees();
  const createClient = useCreateClient();
  const createProject = useCreateProject();
  const updateLead = useUpdateLead();
  const createAlerts = useCreateAlerts();
  const createContacts = useCreateProjectContacts();
  const directorId = employees.find((e) => e.status !== "desligado" && isDirector(e.role))?.id || null;

  const isExistingClient = lead?.origin === "cliente_recorrente" || lead?.origin === "contrato_ativo";

  // Client fields (for new clients)
  const [clientName, setClientName] = useState("");
  const [clientCnpj, setClientCnpj] = useState("");
  const [clientCodigo, setClientCodigo] = useState("");
  const [clientType, setClientType] = useState("pj");
  const [codigoError, setCodigoError] = useState("");

  // Project fields
  const [projectName, setProjectName] = useState("");
  const [cnpjTomador, setCnpjTomador] = useState("");
  const [contractValue, setContractValue] = useState<number | null>(null);
  const [empresaFaturadora, setEmpresaFaturadora] = useState("ag_topografia");
  const [billingType, setBillingType] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);

  // Blocking state
  const [missingClientCode, setMissingClientCode] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const existingClient = useMemo(() => {
    if (!lead?.client_id) return null;
    return clients.find((c) => c.id === lead.client_id) || null;
  }, [lead, clients]);

  // Initialize form when dialog opens
  useEffect(() => {
    if (!open || !lead) return;

    if (isExistingClient && existingClient) {
      if (!existingClient.codigo) {
        setMissingClientCode(true);
        return;
      }
      setMissingClientCode(false);
      setProjectName(`${existingClient.name} — ${lead.servico || "Novo serviço"}`);
      setCnpjTomador(existingClient.cnpj || "");
      setContractValue(lead.valor);
      setEmpresaFaturadora("ag_topografia");
      loadProjectCode(existingClient.codigo);
    } else {
      setMissingClientCode(false);
      setClientName(lead.company || lead.name || "");
      setClientCnpj(lead.cnpj || "");
      setClientType(lead.client_type || "pj");
      const suggested = suggestCode(lead.company || lead.name || "");
      setClientCodigo(suggested);
      setProjectName(`${lead.company || lead.name} — ${lead.servico || "Novo serviço"}`);
      setCnpjTomador(lead.cnpj || "");
      setContractValue(lead.valor);
      setEmpresaFaturadora("ag_topografia");
      if (suggested) loadProjectCode(suggested);
    }
  }, [open, lead, existingClient, isExistingClient]);

  const loadProjectCode = async (codigo: string) => {
    if (!codigo || codigo.length !== 3) {
      setProjectCode("");
      return;
    }
    setCodeLoading(true);
    try {
      const code = await generateProjectCode(codigo);
      setProjectCode(code);
    } catch {
      setProjectCode("");
    }
    setCodeLoading(false);
  };

  // Validate client code uniqueness
  useEffect(() => {
    if (!open || isExistingClient) return;
    if (clientCodigo.length === 3) {
      const existing = clients.find(
        (c) => c.codigo?.toUpperCase() === clientCodigo.toUpperCase()
      );
      if (existing) {
        setCodigoError(`Código já utilizado por ${existing.name}`);
      } else {
        setCodigoError("");
      }
      loadProjectCode(clientCodigo);
    } else {
      setCodigoError("");
      setProjectCode("");
    }
  }, [clientCodigo, open, isExistingClient, clients]);

  const handleConfirm = async () => {
    if (!lead) return;

    // Validations
    if (!isExistingClient) {
      if (!clientCodigo || clientCodigo.length !== 3) {
        toast.error("Código do cliente deve ter exatamente 3 caracteres");
        return;
      }
      if (codigoError) {
        toast.error(codigoError);
        return;
      }
      if (!clientName.trim()) {
        toast.error("Nome do cliente é obrigatório");
        return;
      }
    }
    if (!projectName.trim()) {
      toast.error("Nome do projeto é obrigatório");
      return;
    }
    if (!billingType) {
      toast.error("Tipo de faturamento é obrigatório");
      return;
    }

    setIsPending(true);
    try {
      let clientId = lead.client_id;

      // Step 1: Create client if new
      if (!isExistingClient) {
        const newClient = await createClient.mutateAsync({
          name: clientName,
          cnpj: clientCnpj || null,
          codigo: clientCodigo.toUpperCase(),
          tipo: clientType,
        });
        clientId = newClient.id;
      }

      // Step 2: Generate final project code
      const finalCode = projectCode || await generateProjectCode(
        isExistingClient ? existingClient!.codigo! : clientCodigo.toUpperCase()
      );

      // Step 3: Create project
      const project = await createProject.mutateAsync({
        name: projectName,
        client_id: clientId,
        client: isExistingClient ? existingClient?.name : clientName,
        client_cnpj: cnpjTomador || null,
        contract_value: contractValue,
        empresa_faturadora: empresaFaturadora,
        billing_type: billingType,
        status: "planejamento",
        execution_status: "aguardando_processamento",
        lead_id: lead.id,
        start_date: new Date().toISOString().split("T")[0],
        client_codigo: isExistingClient ? existingClient!.codigo! : clientCodigo.toUpperCase(),
        responsible_comercial_id: directorId,
      } as any);

      // Step 3b: Inherit contacts from client (only if not SPE)
      const sourceClient = isExistingClient ? existingClient : null;
      if (sourceClient) {
        const isSPE = cnpjTomador && sourceClient.cnpj && cnpjTomador !== sourceClient.cnpj;
        if (!isSPE) {
          const contactsToCreate: { project_id: string; tipo: "cliente" | "financeiro"; nome: string }[] = [];
          const clienteContact = (sourceClient as any).contato_cliente || sourceClient.contato_engenheiro;
          if (clienteContact) {
            contactsToCreate.push({ project_id: project.id, tipo: "cliente", nome: clienteContact });
          }
          if (sourceClient.contato_financeiro) {
            contactsToCreate.push({ project_id: project.id, tipo: "financeiro", nome: sourceClient.contato_financeiro });
          }
          if (contactsToCreate.length > 0) {
            await createContacts.mutateAsync(contactsToCreate);
          }
        }
      }

      // Step 4: Update lead
      await updateLead.mutateAsync({
        id: lead.id,
        status: "convertido" as any,
        converted_project_id: project.id,
        client_id: clientId,
      } as any);

      // Step 5: Create alerts
      const valorFormatted = contractValue
        ? `R$ ${contractValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
        : "Não informado";
      const displayName = isExistingClient ? existingClient?.name : clientName;

      const alerts: AlertInsert[] = [
        {
          alert_type: "novo_projeto",
          priority: "importante",
          recipient: "financeiro",
          title: `Novo projeto — ${displayName}`,
          message: `Projeto ${finalCode} criado. Cadastrar condições de faturamento.`,
          reference_type: "project",
          reference_id: project.id,
        },
        {
          alert_type: "novo_projeto",
          priority: "importante",
          recipient: "operacional",
          title: `Nova obra aprovada — ${displayName}`,
          message: `Projeto ${finalCode}. Iniciar planejamento de equipe e logística.`,
          reference_type: "project",
          reference_id: project.id,
        },
        {
          alert_type: "novo_projeto",
          priority: "informacao",
          recipient: "diretoria",
          title: `Projeto criado — ${displayName}`,
          message: `Código: ${finalCode}. Valor: ${valorFormatted}.`,
          reference_type: "project",
          reference_id: project.id,
        },
        {
          alert_type: "novo_projeto",
          priority: "importante",
          recipient: "sala_tecnica",
          title: `Novo projeto — ${displayName}`,
          message: `Projeto ${finalCode} criado. Preparar para recebimento.`,
          reference_type: "project",
          reference_id: project.id,
        },
      ];

      await createAlerts.mutateAsync(alerts);

      toast.success(`Projeto ${finalCode} criado com sucesso`);
      onOpenChange(false);
      onConverted?.();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao converter lead");
    } finally {
      setIsPending(false);
    }
  };

  if (!lead) return null;

  // Blocking: missing client code
  if (missingClientCode && existingClient) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Código do cliente necessário
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              O cliente <strong>{existingClient.name}</strong> não possui código de 3 letras.
              Defina um código antes de converter o lead.
            </p>
            <p className="text-sm text-muted-foreground">
              Acesse <strong>Comercial → Clientes</strong> e edite o cadastro para definir o código.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const clientLabel = existingClient
    ? `${existingClient.codigo} — ${existingClient.name}`
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Converter Lead em Projeto</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* ─── NEW CLIENT FIELDS ─── */}
          {!isExistingClient && (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Novo Cliente
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Tipo</Label>
                  <Select value={clientType} onValueChange={setClientType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pj">Empresa (PJ)</SelectItem>
                      <SelectItem value="pf">Pessoa Física (PF)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Código do cliente *</Label>
                  <Input
                    value={clientCodigo}
                    onChange={(e) => setClientCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3))}
                    placeholder="3 letras"
                    maxLength={3}
                    className="font-mono uppercase"
                  />
                  {codigoError && <p className="text-xs text-destructive">{codigoError}</p>}
                </div>
              </div>
              <div className="space-y-1">
                <Label>Nome do cliente *</Label>
                <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>{clientType === "pf" ? "CPF" : "CNPJ"}</Label>
                <Input value={clientCnpj} onChange={(e) => setClientCnpj(e.target.value)} />
              </div>
              <Separator />
            </>
          )}

          {/* ─── EXISTING CLIENT ─── */}
          {isExistingClient && existingClient && (
            <div className="space-y-1">
              <Label>Cliente</Label>
              <Input value={clientLabel} readOnly className="bg-muted font-medium" />
            </div>
          )}

          {/* ─── PROJECT FIELDS ─── */}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Projeto
          </p>

          <div className="space-y-1">
            <Label>Nome do projeto *</Label>
            <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>CNPJ Tomador</Label>
            <Input
              value={cnpjTomador}
              onChange={(e) => setCnpjTomador(e.target.value)}
              placeholder="CNPJ da SPE, filial ou unidade (se diferente)"
            />
            <p className="text-xs text-muted-foreground">
              Pode ser diferente do CNPJ do cliente (ex: SPE, filial)
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Valor do contrato (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={contractValue ?? ""}
                onChange={(e) => setContractValue(e.target.value ? Number(e.target.value) : null)}
              />
            </div>
            <div className="space-y-1">
              <Label>Empresa faturadora</Label>
              <Select value={empresaFaturadora} onValueChange={setEmpresaFaturadora}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ag_topografia">AG Topografia</SelectItem>
                  <SelectItem value="ag_cartografia">AG Cartografia</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Tipo de faturamento *</Label>
            <Select value={billingType} onValueChange={setBillingType}>
              <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="entrega_nf">NF na entrega</SelectItem>
                <SelectItem value="entrega_recibo">Recibo na entrega</SelectItem>
                <SelectItem value="medicao_mensal">Por medição mensal</SelectItem>
                <SelectItem value="misto">Misto</SelectItem>
                <SelectItem value="sem_documento">Sem documento</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Código do projeto</Label>
              <Input
                value={codeLoading ? "Gerando..." : projectCode}
                readOnly
                className="bg-muted font-mono font-bold text-primary"
              />
            </div>
            <div className="space-y-1">
              <Label>Status inicial</Label>
              <Input value="Planejamento" readOnly className="bg-muted" />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={isPending || codeLoading}>
            {isPending ? "Convertendo..." : "Confirmar Conversão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
