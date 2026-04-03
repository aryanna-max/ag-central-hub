import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Settings, Check, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SystemSetting {
  key: string;
  value: string;
}

export default function SystemSettings() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  async function fetchSettings() {
    setLoading(true);
    const { data, error } = await supabase
      .from("system_settings")
      .select("*")
      .order("key");

    if (error) {
      toast({ title: "Erro ao carregar configurações", description: error.message, variant: "destructive" });
    } else {
      setSettings(data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchSettings();
  }, []);

  function startEditing(setting: SystemSetting) {
    setEditingKey(setting.key);
    setEditValue(setting.value);
  }

  function cancelEditing() {
    setEditingKey(null);
    setEditValue("");
  }

  async function saveValue(key: string) {
    setSaving(true);
    const { error } = await supabase
      .from("system_settings")
      .update({ value: editValue })
      .eq("key", key);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      setSettings((prev) =>
        prev.map((s) => (s.key === key ? { ...s, value: editValue } : s))
      );
      toast({ title: "Configuração salva" });
    }
    setEditingKey(null);
    setEditValue("");
    setSaving(false);
  }

  function handleKeyDown(e: React.KeyboardEvent, key: string) {
    if (e.key === "Enter") {
      saveValue(key);
    } else if (e.key === "Escape") {
      cancelEditing();
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" />
          Configurações do Sistema
        </h1>
        <p className="text-muted-foreground text-sm">
          Parâmetros gerais do sistema. Clique no valor para editar.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Parâmetros</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : settings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhuma configuração encontrada.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Chave</TableHead>
                    <TableHead>Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settings.map((setting) => (
                    <TableRow key={setting.key}>
                      <TableCell className="font-mono text-sm">{setting.key}</TableCell>
                      <TableCell>
                        {editingKey === setting.key ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, setting.key)}
                              autoFocus
                              disabled={saving}
                              className="h-8"
                            />
                            <button
                              onClick={() => saveValue(setting.key)}
                              disabled={saving}
                              className="text-green-600 hover:text-green-800 p-1"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelEditing}
                              disabled={saving}
                              className="text-red-600 hover:text-red-800 p-1"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span
                            onClick={() => startEditing(setting)}
                            className="cursor-pointer hover:bg-muted px-2 py-1 rounded text-sm inline-block min-w-[100px]"
                            title="Clique para editar"
                          >
                            {setting.value || <span className="text-muted-foreground italic">(vazio)</span>}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
