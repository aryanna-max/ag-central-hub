import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useClients, type Client } from "@/hooks/useClients";
import { useCreateProject } from "@/hooks/useProjects";
import { useCepAutofill } from "@/hooks/useCepAutofill";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCnpj, formatCep } from "@/lib/masks";

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
}

export default function ProjectFormDialog({ open, onOpenChange }: Props) {
  const { data: clients = [] } = useClients();
  const createProject = useCreateProject();

  const [clientId, setClientId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [cnpjTomador, setCnpjTomador] = useState("");
  const [contractValue, setContractValue] = useState<number | null>(null);
  const [empresaFaturadora, setEmpresaFaturadora] = useState("ag_topografia");
  const [billingType, setBillingType] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);

  // Address fields
  const [cep, setCep] = useState("");
  const [rua, setRua] = useState("");
  const [bairro, setBairro] = useState("");
  const [numero, setNumero] = useState("");
  const [cidade, setCidade] = useState("Recife");
  const [estado, setEstado] = useState("PE");

  const cepData = useCepAutofill(cep);

  useEffect(() => {
    if (cepData.rua) setRua(cepData.rua);
    if (cepData.bairro) setBairro(cepData.bairro);
    if (cepData.cidade) setCidade(cepData.cidade);
    if (cepData.estado) setEstado(cepData.estado);
  }, [cepData.rua, cepData.bairro, cepData.cidade, cepData.estado]);

  const selectedClient = clients.find((c) => c.id === clientId);
  const clientMissingCode = selectedClient && !selectedClient.codigo;

  useEffect(() => {
    if (!open) {
      setClientId(""); setProjectName(""); setCnpjTomador("");
      setContractValue(null); setEmpresaFaturadora("ag_topografia"); setBillingType("");
      setProjectCode(""); setCep(""); setRua(""); setBairro("");
      setNumero(""); setCidade("Recife"); setEstado("PE");
    }
  }, [open]);

  useEffect(() => {
    if (!selectedClient?.codigo) { setProjectCode(""); return; }
    setCodeLoading(true);
    generateProjectCode(selectedClient.codigo)
      .then(setProjectCode)
      .catch(() => setProjectCode(""))
      .finally(() => setCodeLoading(false));
    setCnpjTomador(selectedClient.cnpj || "");
    // Auto-suggest project name if empty
    if (!projectName && selectedClient.name) {
      const loc = cidade && cidade !== "Recife" ? ` — ${cidade}` : "";
      setProjectName(`${selectedClient.name}${loc}`);
    }
  }, [selectedClient]);

  const handleSubmit = async () => {
    if (!clientId) { toast.error("Selecione um cliente"); return; }
    if (clientMissingCode) { toast.error("O cliente selecionado não possui código"); return; }
    if (!projectName.trim()) { toast.error("Nome do projeto é obrigatório"); return; }
    if (!billingType) { toast.error("Tipo de faturamento é obrigatório"); return; }

    setIsPending(true);
    try {
      await createProject.mutateAsync({
        name: projectName,
        client_id: clientId,
        client: selectedClient?.name || null,
        client_cnpj: cnpjTomador || null,
        contract_value: contractValue,
        empresa_faturadora: empresaFaturadora,
        billing_type: billingType,
        status: "planejamento",
        start_date: new Date().toISOString().split("T")[0],
        is_active: true,
        client_codigo: selectedClient!.codigo!,
        cep: cep || null,
        rua: rua || null,
        bairro: bairro || null,
        numero: numero || null,
        cidade: cidade || null,
        estado: estado || null,
      } as any);
      toast.success(`Projeto ${projectCode} criado`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao criar projeto");
    } finally {
      setIsPending(false);
    }
  };

  const clientLabel = (c: Client) =>
    c.codigo ? `${c.codigo} — ${c.name}` : c.name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Projeto</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Cliente *</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
              <SelectContent>
                {clients.filter((c) => c.is_active).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{clientLabel(c)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {clientMissingCode && (
              <div className="flex items-center gap-2 text-amber-600 text-xs mt-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                O cliente <strong>{selectedClient?.name}</strong> não possui código de 3 letras. Defina-o em Comercial → Clientes.
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label>Nome do projeto *</Label>
            <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Nome do projeto" />
          </div>

          <div className="space-y-1">
            <Label>CNPJ Tomador</Label>
            <Input value={cnpjTomador} onChange={(e) => setCnpjTomador(formatCnpj(e.target.value))} placeholder="00.000.000/0000-00" maxLength={18} />
            <p className="text-xs text-muted-foreground">Pode ser diferente do CNPJ do cliente</p>
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
            <Label>Tipo de Faturamento *</Label>
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

          {/* Endereço da obra */}
          <div className="space-y-1">
            <Label className="text-sm font-medium text-muted-foreground">Endereço da obra</Label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">CEP</Label>
              <div className="relative">
                <Input value={cep} onChange={(e) => setCep(formatCep(e.target.value))} placeholder="00000-000" maxLength={9} className="h-9" />
                {cepData.loading && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />}
              </div>
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Rua</Label>
              <Input value={rua} onChange={(e) => setRua(e.target.value)} className="h-9" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nº</Label>
              <Input value={numero} onChange={(e) => setNumero(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Bairro</Label>
              <Input value={bairro} onChange={(e) => setBairro(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cidade</Label>
              <Input value={cidade} onChange={(e) => setCidade(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">UF</Label>
              <Input value={estado} onChange={(e) => setEstado(e.target.value)} maxLength={2} className="h-9" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Código do projeto</Label>
              <Input
                value={codeLoading ? "Gerando..." : projectCode || "—"}
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
          <Button onClick={handleSubmit} disabled={isPending || codeLoading || !!clientMissingCode}>
            {isPending ? "Criando..." : "Criar Projeto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
