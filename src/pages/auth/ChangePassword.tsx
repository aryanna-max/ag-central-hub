import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import loginBg from "@/assets/login-bg.jpg";
import logoAg from "@/assets/logo-ag.png";

export default function ChangePassword() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setError("");
    setLoading(true);

    const { error: pwErr } = await supabase.auth.updateUser({ password });
    if (pwErr) {
      setError("Erro ao alterar senha.");
      setLoading(false);
      return;
    }

    // Mark password as changed
    await supabase.from("profiles").update({ must_change_password: false }).eq("id", profile!.id);

    setLoading(false);
    navigate("/");
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <img src={loginBg} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(200,30%,12%)]/80 to-[hsl(199,65%,30%)]/60" />

      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-card/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 p-8 space-y-6">
          <div className="flex flex-col items-center gap-3">
            <img src={logoAg} alt="AG Topografia" className="h-20 w-auto" />
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-lg font-semibold text-foreground">Alterar Senha</h1>
            <p className="text-sm text-muted-foreground text-center">
              É seu primeiro acesso. Por segurança, defina uma nova senha.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="password">Nova Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar Senha</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Salvando..." : "Definir nova senha"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
