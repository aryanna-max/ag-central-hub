import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Home, Briefcase, MapPin, DollarSign, Menu } from "lucide-react";
import MobileMenuSheet from "./MobileMenuSheet";
import { cn } from "@/lib/utils";

const items = [
  { icon: Home, label: "Início", path: "/" },
  { icon: Briefcase, label: "Negócios", path: "/comercial" },
  { icon: MapPin, label: "Campo", path: "/operacional" },
  { icon: DollarSign, label: "Faturamento", path: "/financeiro" },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex justify-around items-center"
        style={{
          height: 64,
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderTop: "1px solid rgba(45, 106, 142, 0.1)",
          boxShadow: "0 -2px 10px rgba(0,0,0,0.05)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {items.map((item) => {
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center gap-0.5 py-1.5 px-3 transition-colors",
                active ? "text-[#2D6A8E]" : "text-[#636569] opacity-60"
              )}
            >
              <item.icon className={cn("h-5.5 w-5.5", active && "stroke-[2.5]")} />
              <span className={cn("text-[10px]", active && "font-semibold")}>{item.label}</span>
            </button>
          );
        })}
        <button
          onClick={() => setMenuOpen(true)}
          className="flex flex-col items-center gap-0.5 py-1.5 px-3 text-[#636569] opacity-60"
        >
          <Menu className="h-5.5 w-5.5" />
          <span className="text-[10px]">Menu</span>
        </button>
      </nav>

      <MobileMenuSheet open={menuOpen} onOpenChange={setMenuOpen} />
    </>
  );
}
