import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Comercial from "./pages/Comercial";
import Projetos from "./pages/Projetos";
import ProjetosDashboard from "./pages/projetos/ProjetosDashboard";
import Operacional from "./pages/Operacional";
import SalaTecnica from "./pages/SalaTecnica";
import Financeiro from "./pages/Financeiro";
import RH from "./pages/RH";
import NotFound from "./pages/NotFound";
import Login from "./pages/auth/Login";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import ChangePassword from "./pages/auth/ChangePassword";
import UserManagement from "./pages/admin/UserManagement";
import CadastrosBase from "./pages/admin/CadastrosBase";
import AdminClientes from "./pages/admin/Clientes";
import ClienteHistorico from "./pages/admin/ClienteHistorico";
import SystemSettings from "./pages/admin/SystemSettings";
import ProjetoHistorico from "./pages/projetos/ProjetoHistorico";
import AprovacaoExterna from "./pages/AprovacaoExterna";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, profile } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (profile?.must_change_password) return <Navigate to="/change-password" replace />;
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, profile } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  if (user && !profile?.must_change_password) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function ChangePasswordRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, profile } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!profile?.must_change_password) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public auth routes */}
      <Route path="/login" element={<AuthRoute><Login /></AuthRoute>} />
      <Route path="/forgot-password" element={<AuthRoute><ForgotPassword /></AuthRoute>} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/aprovacao/:token" element={<AprovacaoExterna />} />
      <Route path="/change-password" element={<ChangePasswordRoute><ChangePassword /></ChangePasswordRoute>} />

      {/* Protected routes */}
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/comercial/*" element={<Comercial />} />
        <Route path="/projetos/kanban" element={<Projetos />} />
        <Route path="/projetos/dashboard" element={<ProjetosDashboard />} />
        <Route path="/projetos/:projectId" element={<ProjetoHistorico />} />
        <Route path="/operacional/*" element={<Operacional />} />
        <Route path="/sala-tecnica/*" element={<SalaTecnica />} />
        <Route path="/financeiro/*" element={<Financeiro />} />
        <Route path="/rh/*" element={<RH />} />
        <Route path="/admin/usuarios" element={<UserManagement />} />
        <Route path="/admin/cadastros" element={<CadastrosBase />} />
        <Route path="/admin/clientes" element={<AdminClientes />} />
        <Route path="/admin/configuracoes" element={<SystemSettings />} />
        <Route path="/base/clientes/:clientId" element={<ClienteHistorico />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
