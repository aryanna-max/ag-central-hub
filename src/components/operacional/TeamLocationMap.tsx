import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MapPin, Filter } from "lucide-react";

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const TEAM_COLORS = [
  "#0e7490", "#059669", "#7c9a1e", "#dc2626", "#6366f1",
  "#d97706", "#0284c7", "#be185d", "#4f46e5", "#15803d",
  "#a855f7", "#ea580c", "#0891b2", "#e11d48",
];

function createColoredIcon(color: string) {
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="background:${color};width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
}

interface Assignment {
  id: string;
  team_id: string;
  obra_id: string | null;
  vehicle_id: string | null;
  teams?: any;
  obras?: any;
  vehicles?: any;
}

interface TeamLocationMapProps {
  assignments: Assignment[];
  date: string;
}

export default function TeamLocationMap({ assignments, date }: TeamLocationMapProps) {
  const [filterClient, setFilterClient] = useState("all");
  const [filterTeam, setFilterTeam] = useState("all");
  const [searchText, setSearchText] = useState("");

  // Extract unique clients and teams
  const clients = useMemo(() => {
    const set = new Set<string>();
    assignments.forEach((a) => {
      if (a.obras?.client) set.add(a.obras.client);
    });
    return Array.from(set).sort();
  }, [assignments]);

  const teamNames = useMemo(() => {
    return assignments.map((a) => ({ id: a.team_id, name: a.teams?.name || "Equipe" }));
  }, [assignments]);

  // Markers with locations from obras
  const markers = useMemo(() => {
    return assignments
      .filter((a) => {
        if (!a.obras) return false;
        // Use obra coordinates or fallback to approximate (Recife area)
        const lat = a.obras.latitude || -8.05 + Math.random() * 0.1;
        const lng = a.obras.longitude || -34.87 + Math.random() * 0.1;
        if (filterClient !== "all" && a.obras.client !== filterClient) return false;
        if (filterTeam !== "all" && a.team_id !== filterTeam) return false;
        if (searchText) {
          const search = searchText.toLowerCase();
          const teamName = (a.teams?.name || "").toLowerCase();
          const obraName = (a.obras?.name || "").toLowerCase();
          const client = (a.obras?.client || "").toLowerCase();
          const members = (a.teams?.team_members || []).map((m: any) => (m.employees?.name || "").toLowerCase()).join(" ");
          const vehicle = `${a.vehicles?.model || ""} ${a.vehicles?.plate || ""}`.toLowerCase();
          if (!teamName.includes(search) && !obraName.includes(search) && !client.includes(search) && !members.includes(search) && !vehicle.includes(search)) return false;
        }
        return true;
      })
      .map((a, idx) => {
        const lat = a.obras?.latitude || -8.05 - idx * 0.015;
        const lng = a.obras?.longitude || -34.87 + idx * 0.012;
        const teamMembers = a.teams?.team_members || [];
        const topografo = teamMembers.find((m: any) => m.role === "topografo");
        const auxiliares = teamMembers.filter((m: any) => m.role !== "topografo");

        return {
          id: a.id,
          lat: Number(lat),
          lng: Number(lng),
          teamName: a.teams?.name || "Equipe",
          obraName: a.obras?.name || "—",
          client: a.obras?.client || "—",
          location: a.obras?.location || "—",
          vehicle: a.vehicles ? `${a.vehicles.model} - ${a.vehicles.plate}` : "—",
          topografo: topografo?.employees?.name || "—",
          auxiliares: auxiliares.map((aux: any) => aux.employees?.name || "—"),
          color: TEAM_COLORS[idx % TEAM_COLORS.length],
        };
      });
  }, [assignments, filterClient, filterTeam, searchText]);

  const center = markers.length > 0
    ? { lat: markers.reduce((s, m) => s + m.lat, 0) / markers.length, lng: markers.reduce((s, m) => s + m.lng, 0) / markers.length }
    : { lat: -8.05, lng: -34.87 };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            Mapa de Equipes
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar equipe, funcionário, projeto..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-52 h-8 text-xs"
            />
            <Select value={filterClient} onValueChange={setFilterClient}>
              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {clients.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterTeam} onValueChange={setFilterTeam}>
              <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Equipe" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as equipes</SelectItem>
                {teamNames.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-[400px] rounded-b-lg overflow-hidden">
          <MapContainer
            center={[center.lat, center.lng]}
            zoom={markers.length > 0 ? 10 : 6}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {markers.map((m) => (
              <Marker key={m.id} position={[m.lat, m.lng]} icon={createColoredIcon(m.color)}>
                <Popup>
                  <div className="min-w-[200px]">
                    <p className="font-bold text-sm">{m.teamName}</p>
                    <hr className="my-1" />
                    <p className="text-xs"><strong>Topógrafo:</strong> {m.topografo}</p>
                    <p className="text-xs"><strong>Auxiliares:</strong> {m.auxiliares.join(", ") || "—"}</p>
                    <p className="text-xs mt-1"><strong>Projeto:</strong> {m.obraName}</p>
                    <p className="text-xs"><strong>Cliente:</strong> {m.client}</p>
                    <p className="text-xs"><strong>Local:</strong> {m.location}</p>
                    <p className="text-xs"><strong>Veículo:</strong> {m.vehicle}</p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
        {markers.length === 0 && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            Nenhuma equipe escalada com localização para esta data.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
