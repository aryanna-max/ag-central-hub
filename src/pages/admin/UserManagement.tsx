import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UserPlus, Users, Shield, Copy, Check } from "lucide-react";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, string> = {
  master: "Master",
  diretor: "Diretor",
  operacional: "Operacional",
  sala_tecnica: "Sala Técnica",
  comercial: "Comercial",
  financeiro: "Financeiro",
};

const ROLE_COLORS: Record<string, string> = {
  master: "bg-destructive text-destructive-foreground",
  diretor: "bg-primary text-primary-foreground",
  operacional: "bg-secondary text-secondary-foreground",
  sala_tecnica: "bg-accent text-accent-foreground",
  comercial: "bg-primary/80 text-primary-foreground",
  financeiro: "bg-secondary/80 text-secondary-foreground",
};

export default function UserManagement() {
  const { isMaster } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<string>("operacional");
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("*");
      const { data: roles } = await supabase.from("user_roles").select("*");
      return (profiles || []).map((p: any) => ({
        ...p,
        role: roles?.find((r: any) => r.user_id === p.id)?.role || "sem_perfil",
      }));
    },
    enabled: isMaster,
  });

  const createUser = useMutation({
    mutationFn: async () => {
      const password = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("create-user", {
        body: { email, full_name: fullName, role, password },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      return { ...res.data, password };
    },
    onSuccess: (data) => {
      setGeneratedPassword(data.password);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setDialogOpen(false);
      setEmail("");
      setFullName("");
      setRole("operacional");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  if (!isMaster) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Acesso restrito ao administrador.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Gerenciar Usuários
          </h1>
          <p className="text-muted-foreground text-sm">Cadastre e gerencie os acessos ao sistema</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="w-4 h-4" /> Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar Novo Usuário</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createUser.mutate();
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Nome Completo</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Perfil de Acesso</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS).filter(([k]) => k !== "master").map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Uma senha aleatória será gerada e exibida após a criação. O usuário deverá alterá-la no primeiro login.
              </p>
              <Button type="submit" className="w-full" disabled={createUser.isPending}>
                {createUser.isPending ? "Criando..." : "Criar Usuário"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={!!generatedPassword} onOpenChange={(open) => { if (!open) setGeneratedPassword(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usuário criado com sucesso</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Copie a senha abaixo e envie ao usuário. Ela será solicitada apenas no primeiro login.
            </p>
            <div className="flex items-center gap-2">
              <Input readOnly value={generatedPassword || ""} className="font-mono text-lg" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  if (generatedPassword) {
                    navigator.clipboard.writeText(generatedPassword);
                    toast.success("Senha copiada!");
                  }
                }}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-amber-600">
              Esta senha não poderá ser visualizada novamente após fechar este diálogo.
            </p>
            <Button className="w-full" onClick={() => setGeneratedPassword(null)}>
              Entendi, já copiei a senha
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" /> Usuários Cadastrados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Badge className={ROLE_COLORS[u.role] || ""}>
                        {ROLE_LABELS[u.role] || u.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {u.must_change_password ? (
                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                          Aguardando 1º login
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-green-600 border-green-300">
                          Ativo
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
