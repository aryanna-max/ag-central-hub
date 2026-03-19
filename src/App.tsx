import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Comercial from "./pages/Comercial";
import Propostas from "./pages/Propostas";
import Projetos from "./pages/Projetos";
import ProjetosDashboard from "./pages/projetos/ProjetosDashboard";
import Operacional from "./pages/Operacional";
import SalaTecnica from "./pages/SalaTecnica";
import Financeiro from "./pages/Financeiro";
import RH from "./pages/RH";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/comercial/*" element={<Comercial />} />
            <Route path="/propostas" element={<Propostas />} />
            <Route path="/projetos/kanban" element={<Projetos />} />
            <Route path="/projetos/dashboard" element={<ProjetosDashboard />} />
            <Route path="/operacional/*" element={<Operacional />} />
            <Route path="/sala-tecnica/*" element={<SalaTecnica />} />
            <Route path="/financeiro/*" element={<Financeiro />} />
            <Route path="/rh/*" element={<RH />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
