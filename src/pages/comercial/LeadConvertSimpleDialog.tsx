import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClients } from "@/hooks/useClients";
import { useUpdateLead, type Lead } from "@/hooks/useLeads";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  onConverted?: () => void;
  onSwitchToFullMode?: () => void;
}

export default function LeadConvertSimpleDialog({
  open,
  onOpenChange,
  lead,
  onConverted,
  onSwitchToFullMode,
}: Props) {
  const { data: clients = [] } = useClients();
  const updateLead = useUpdateLead();

  const [clientId, setClientId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [comboOpen, setComboOpen] = useState(false);

  useEffect(() => {
    if (!open || !lead) return;
    setClientId(lead.client_id ?? null);
    setNotes("");
  }, [open, lead]);

  const sortedClients = useMemo(() => {
    return [...clients]
      .filter((c) => c.is_active !== false)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [clients]);

  const selectedClient = useMemo(
    () => sortedClients.find((c) => c.id === clientId) || null,
    [sortedClients, clientId]
  );

  async function handleConvert() {
    if (!lead || !clientId) {
      toast.error("Selecione um cliente para converter o lead");
      return;
    }
    try {
      const trimmedNotes = notes.trim();
      const finalNotes = trimmedNotes
        ? `${lead.notes ? `${lead.notes}\n\n` : ""}[CONVERSÃO] ${trimmedNotes}`
        : lead.notes;
      await updateLead.mutateAsync({
        id: lead.id,
        status: "convertido",
        client_id: clientId,
        notes: finalNotes,
      });
      toast.success("Lead convertido. Crie o projeto em /projetos quando estiver pronto.");
      onOpenChange(false);
      onConverted?.();
    } catch {
      toast.error("Erro ao converter lead");
    }
  }

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Converter lead</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Cliente *</Label>
            <Popover open={comboOpen} onOpenChange={setComboOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={comboOpen}
                  className="w-full justify-between font-normal"
                >
                  <span className="truncate">
                    {selectedClient
                      ? `${selectedClient.codigo ? `${selectedClient.codigo} — ` : ""}${selectedClient.name}`
                      : "Selecione um cliente..."}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar cliente..." />
                  <CommandList>
                    <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                    <CommandGroup>
                      {sortedClients.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={`${c.codigo || ""} ${c.name}`}
                          onSelect={() => {
                            setClientId(c.id);
                            setComboOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              clientId === c.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="truncate">
                            {c.codigo ? `${c.codigo} — ${c.name}` : c.name}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label>Observações da conversão</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional — contexto da conversão (ex: cliente já contratou serviço similar em 2024)"
              rows={3}
            />
          </div>

          {onSwitchToFullMode && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs text-muted-foreground"
              onClick={() => {
                onOpenChange(false);
                onSwitchToFullMode();
              }}
            >
              <UserPlus className="w-3.5 h-3.5 mr-2" />
              Cliente novo? Criar agora e gerar projeto na hora...
            </Button>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConvert} disabled={updateLead.isPending || !clientId}>
            {updateLead.isPending ? "Convertendo..." : "Converter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
