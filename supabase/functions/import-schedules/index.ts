import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { text, month, year } = await req.json();
    if (!text || !month || !year) {
      return new Response(JSON.stringify({ error: "text, month, year required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load reference data
    const { data: employees } = await supabase.from("employees").select("id, name, role");
    const { data: obras } = await supabase.from("obras").select("id, name, client, location");
    const { data: vehicles } = await supabase.from("vehicles").select("id, model, plate");

    // Build name maps
    const empMap = buildEmployeeMap(employees || []);
    const obraMap = buildObraMap(obras || []);
    const vehicleMap = buildVehicleMap(vehicles || []);

    // Parse pages from text
    const pages = text.split(/## Page \d+/).filter((p: string) => p.trim());
    
    const results: any[] = [];
    const errors: string[] = [];

    for (const page of pages) {
      try {
        const parsed = parsePage(page, month, year);
        if (!parsed) continue;
        
        // Skip pages with wrong year (some pages are from 2025)
        if (parsed.year !== year) continue;
        
        // Skip weekends for "diárias" pages or non-schedule pages
        if (!parsed.assignments.length) continue;

        const dateStr = `${parsed.year}-${String(parsed.month).padStart(2, "0")}-${String(parsed.day).padStart(2, "0")}`;

        // Check if schedule already exists for this date
        const { data: existing } = await supabase
          .from("daily_schedules")
          .select("id")
          .eq("schedule_date", dateStr)
          .maybeSingle();

        let scheduleId: string;
        if (existing) {
          scheduleId = existing.id;
          // Delete existing assignments and entries
          const { data: existingAssignments } = await supabase
            .from("daily_team_assignments")
            .select("id")
            .eq("daily_schedule_id", scheduleId);
          
          if (existingAssignments?.length) {
            await supabase
              .from("daily_schedule_entries")
              .delete()
              .eq("daily_schedule_id", scheduleId);
            await supabase
              .from("daily_team_assignments")
              .delete()
              .eq("daily_schedule_id", scheduleId);
          }
        } else {
          const { data: newSchedule, error: schedErr } = await supabase
            .from("daily_schedules")
            .insert({ schedule_date: dateStr, is_closed: true, closed_at: new Date().toISOString() })
            .select()
            .single();
          if (schedErr) { errors.push(`Schedule ${dateStr}: ${schedErr.message}`); continue; }
          scheduleId = newSchedule.id;
        }

        // Process assignments
        for (const assign of parsed.assignments) {
          const topografoId = findEmployee(assign.topografo, empMap);
          const obraId = findObra(assign.project, obraMap);
          const vehicleId = findVehicle(assign.vehicle, assign.plate, vehicleMap);

          // Use a pseudo team_id based on the topographer
          // We'll create a simple assignment without strict team matching
          const teamId = await findOrCreateTeamForTopografo(supabase, topografoId, assign.topografo);
          
          if (!teamId) {
            errors.push(`${dateStr} #${assign.num}: No team for ${assign.topografo}`);
            continue;
          }

          const { data: assignment, error: assignErr } = await supabase
            .from("daily_team_assignments")
            .insert({
              daily_schedule_id: scheduleId,
              team_id: teamId,
              obra_id: obraId || null,
              vehicle_id: vehicleId || null,
              notes: assign.notes || null,
            })
            .select()
            .single();

          if (assignErr) {
            errors.push(`${dateStr} #${assign.num}: ${assignErr.message}`);
            continue;
          }

          // Create entries for topografo and auxiliares
          const allMembers = [
            { empId: topografoId, name: assign.topografo },
            ...assign.auxiliares.map((aux: string) => ({
              empId: findEmployee(aux, empMap),
              name: aux,
            })),
          ];

          for (const member of allMembers) {
            if (!member.empId) {
              errors.push(`${dateStr}: Employee not found: ${member.name}`);
              continue;
            }
            await supabase.from("daily_schedule_entries").insert({
              daily_schedule_id: scheduleId,
              employee_id: member.empId,
              team_id: teamId,
              obra_id: obraId || null,
              vehicle_id: vehicleId || null,
              daily_team_assignment_id: assignment.id,
              attendance: "presente",
            });
          }
        }

        // Process absences/AG entries
        if (parsed.absences) {
          for (const absence of parsed.absences) {
            const empId = findEmployee(absence.name, empMap);
            if (!empId) continue;
            
            if (absence.type === "AG") {
              // Find "Escritório / AG" obra
              const agObraId = findObra("Escritório / AG", obraMap);
              if (agObraId) {
                await supabase.from("daily_schedule_entries").insert({
                  daily_schedule_id: scheduleId,
                  employee_id: empId,
                  obra_id: agObraId,
                  attendance: "presente",
                  notes: "Escritório / AG",
                });
              }
            }
          }
        }

        results.push({ date: dateStr, assignments: parsed.assignments.length });
      } catch (e) {
        errors.push(`Page parse error: ${e.message}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, imported: results.length, results, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Team cache
const teamCache: Record<string, string> = {};

async function findOrCreateTeamForTopografo(supabase: any, topografoId: string | null, topografoName: string): Promise<string | null> {
  if (!topografoId) return null;
  
  const cacheKey = topografoId;
  if (teamCache[cacheKey]) return teamCache[cacheKey];

  // Check if there's an existing team with this employee as leader
  const { data: existingTeams } = await supabase
    .from("teams")
    .select("id")
    .eq("leader_id", topografoId)
    .eq("is_active", true)
    .limit(1);

  if (existingTeams?.length) {
    teamCache[cacheKey] = existingTeams[0].id;
    return existingTeams[0].id;
  }

  // Check team_members
  const { data: memberTeams } = await supabase
    .from("team_members")
    .select("team_id, role")
    .eq("employee_id", topografoId)
    .eq("role", "topografo");

  if (memberTeams?.length) {
    teamCache[cacheKey] = memberTeams[0].team_id;
    return memberTeams[0].team_id;
  }

  // Create a new team
  const firstName = topografoName.split(" ")[0];
  const { data: newTeam, error } = await supabase
    .from("teams")
    .insert({ name: `Equipe ${firstName}`, leader_id: topografoId, is_active: true })
    .select()
    .single();

  if (error) return null;

  // Add topografo as team member
  await supabase.from("team_members").insert({
    team_id: newTeam.id,
    employee_id: topografoId,
    role: "topografo",
  });

  teamCache[cacheKey] = newTeam.id;
  return newTeam.id;
}

function parsePage(text: string, expectedMonth: number, expectedYear: number): any | null {
  // Find date pattern like "1/5/26" or "2/3/26"
  const dateMatch = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!dateMatch) return null;

  let pageMonth = parseInt(dateMatch[1]);
  let pageDay = parseInt(dateMatch[2]);
  let pageYear = parseInt(dateMatch[3]);
  
  // Fix 2-digit year
  if (pageYear < 100) pageYear += 2000;
  
  // Skip if not matching expected year
  if (pageYear !== expectedYear) return null;
  // Skip if not matching expected month  
  if (pageMonth !== expectedMonth) return null;

  // Check if this is a "DIÁRIAS" or "RELAÇÃO" page (not a schedule)
  if (text.includes("RELAÇÃO DE DIÁRIAS") || text.includes("DIARISTA")) return null;

  const lines = text.split("\n").filter((l: string) => l.trim());
  const assignments: any[] = [];
  const absences: any[] = [];

  let i = 0;
  let parsingTeams = false;
  let parsingAbsences = false;

  while (i < lines.length) {
    const line = lines[i];
    const cells = line.split("|").map((c: string) => c.trim());

    // Detect team section start
    if (line.includes("TOPÓGRAFO")) {
      parsingTeams = true;
      parsingAbsences = false;
      i++;
      continue;
    }

    // Detect absences section
    if (line.includes("ATESTADO") || line.includes("INTEGRAÇÃO") || line.includes("FOLGA|FÉRIAS")) {
      parsingTeams = false;
      parsingAbsences = true;
      i++;
      continue;
    }

    if (parsingTeams) {
      // Team assignment line: |NUM|TOPOGRAFO|AUX1|PROJECT|VEHICLE|NOTES|
      const num = cells[1];
      if (num && /^\d+$/.test(num)) {
        const topografo = cells[2] || "";
        const aux1 = cells[3] || "";
        const project = cells[4] || "";
        const vehicle = cells[5] || "";
        const notes = cells[6] || "";

        if (topografo) {
          const auxiliares: string[] = [];
          if (aux1 && !isProjectName(aux1)) auxiliares.push(aux1);

          // Check next line for additional aux/location
          if (i + 1 < lines.length) {
            const nextLine = lines[i + 1];
            const nextCells = nextLine.split("|").map((c: string) => c.trim());
            // Next line pattern: |||AUX2|LOCATION|PLATE||
            if (!nextCells[1] && !nextCells[2] && nextCells[3]) {
              // This is a continuation line
              auxiliares.push(nextCells[3]);
              i++;
            } else if (nextCells[1] === "" && nextCells[2] === "" && nextCells[3] === "") {
              // Empty separator line
            }
          }

          // Also check if aux1 is actually part of project name
          let finalProject = project;
          let finalAux1 = aux1;
          
          // Extract plate from vehicle field or next line
          let plate = "";
          if (vehicle) {
            // Sometimes plate is in the next line's vehicle column
          }

          assignments.push({
            num: parseInt(num),
            topografo: topografo,
            auxiliares: auxiliares.filter(a => a && a !== topografo),
            project: finalProject,
            vehicle: vehicle,
            plate: plate,
            notes: notes,
          });
        }
      } else if (!num && cells[3]) {
        // Continuation line - add aux to previous assignment
        if (assignments.length > 0) {
          const lastAssign = assignments[assignments.length - 1];
          if (cells[3] && !isProjectName(cells[3])) {
            lastAssign.auxiliares.push(cells[3]);
          }
          // Capture plate if present
          if (cells[5]) lastAssign.plate = cells[5];
          // Capture notes
          if (cells[6] && !lastAssign.notes) lastAssign.notes = cells[6];
          else if (cells[6]) lastAssign.notes += " " + cells[6];
        }
      }
    }

    if (parsingAbsences) {
      // Parse absence entries: ||TYPE|NAME|RETURN_DATE|...|
      const cols = cells.filter(c => c);
      if (cols.length > 0) {
        // AG column entries
        const agIdx = findColumnIndex(lines, i, "AG");
        if (agIdx >= 0 && cells[agIdx]) {
          absences.push({ name: cells[agIdx], type: "AG" });
        }
      }
    }

    i++;
  }

  return { month: pageMonth, day: pageDay, year: pageYear, assignments, absences };
}

function findColumnIndex(lines: string[], currentLine: number, header: string): number {
  // Look backwards for the header row
  for (let i = currentLine; i >= Math.max(0, currentLine - 3); i--) {
    const cells = lines[i].split("|").map((c: string) => c.trim());
    const idx = cells.findIndex(c => c === header);
    if (idx >= 0) return idx;
  }
  return -1;
}

function isProjectName(s: string): boolean {
  const projects = ["BRK", "ENGEKO", "PERNAMBUCO", "HBR", "GRUPO", "FLAMBOYANT", "COLORADO", "POLIMIX", "HOSPITAL", "AGUARDANDO", "DIRECIONAL", "MAX", "ENCAR", "COLGRAVATA", "JME", "VIANA", "SIMPROJA", "HUGREEN", "SHOPPING", "ANGELICA", "NOGUEIRA", "AUREA", "COBEM", "PC ENGENHARIA", "PETRINBU", "ALEXSANDRA", "SANDRA", "AGUSTO", "PLANOA", "2MS", "RANCHO", "LEO DOURADO", "RAFAELA", "COLARRIO", "ARQ"];
  const upper = s.toUpperCase();
  return projects.some(p => upper.startsWith(p));
}

function buildEmployeeMap(employees: any[]): Record<string, string> {
  const map: Record<string, string> = {};
  
  // Direct name mappings (nickname -> id)
  const nicknames: Record<string, string> = {};
  
  for (const emp of employees) {
    const name = emp.name.toUpperCase();
    const firstName = name.split(" ")[0];
    
    // Store by full name
    map[name] = emp.id;
    // Store by first name
    if (!map[firstName]) map[firstName] = emp.id;
  }

  // Manual overrides for known nicknames/abbreviations
  const overrides: [string, string][] = [
    ["ADEMIR", "Ademir Agostinho"],
    ["ADIRSON", "Adirson Aleixo"],
    ["AGLAILSON", "Aglailson Barbosa"],
    ["ALBERICO", "Alberico Macedo"],
    ["ALBÉRICO", "Alberico Macedo"],
    ["ALBERTO", "Alberto Serafim"],
    ["ALEX JORGE", "Alex Jorge"],
    ["ALEX", "Alex Paulo"],
    ["ANDRE GUSTAVO", "Andre Gustavo"],
    ["ANDRE", "Andre Gustavo"],
    ["ARIOSVALDO", "Ariosvaldo José"],
    ["ARNOUD", "Jose Arnoudo"],
    ["JOSE ARNOUD", "Jose Arnoudo"],
    ["JOSE ARNOUDO", "Jose Arnoudo"],
    ["BRIAN", "Brian Richard"],
    ["BRYAN", "Brian Richard"],
    ["BRUNO", "Bruno de Lima"],
    ["DANIEL", "Daniel Alves"],
    ["DANIEL ALVES", "Daniel Alves"],
    ["DIEGO", "Diego Ramos"],
    ["DJALMA", "Djalma Luiz"],
    ["EDUARDO", "Eduardo de Franca"],
    ["NOBERTO", "Eduardo Noberto"],
    ["EWERTHON", "Ewerthon Moreira"],
    ["FABIO ANTONIO", "Fabio Antonio"],
    ["FERNANDO", "Fernando Silvestre"],
    ["GIOVANNI", "Giovanni Mariotto"],
    ["IVANILDO", "Ivanildo Roberto"],
    ["JEFFERSON", "Jefferson Gomes"],
    ["JOÃO PEDRO", "João Pedro"],
    ["JOAO PEDRO", "João Pedro"],
    ["JOSE HENRIQUE", "Jose Henrique"],
    ["JOSE RAFAEL", "Jose Rafael"],
    ["LEANDRO", "Leandro"],
    ["LUIZ ANDRE", "Luiz Andre"],
    ["LUIZ CARLOS", "Luiz Carlos"],
    ["LUIS CARLOS", "Luiz Carlos"],
    ["MARCELO", "Marcelo Lisias"],
    ["MATHEUS", "Matheus Lima"],
    ["NIEL", "Niel"],
    ["PAULO MENDES", "Paulo Victor"],
    ["RANIEL", "Raniell Mendes"],
    ["RANIELL", "Raniell Mendes"],
    ["RICARDO", "Ricardo Francisco"],
    ["RICHARD", "Richard Thiago"],
    ["RIVALDO", "Rivaldo"],
    ["RODRIGO", "Rodrigo Cassiano"],
    ["RODRIGO ANUNCIAÇÃO", "Rodrigo Anunciação"],
    ["RUBENS", "Rubens Chelton"],
    ["SAMIO", "Samio Cesar"],
    ["TARCISIO", "Tarcisio Pereira"],
    ["THIAGO LIMA", "Thiago Lima"],
    ["TONE JOSE", "Tone Jose"],
    ["TONE", "Tone Jose"],
    ["VANDO", "Vando"],
    ["VICTOR HENRIQUE", "Victor Henrique"],
    ["WHANDERSON", "Whanderson"],
    ["ZADSON", "Zadson Souza"],
    ["JONAS", "Jonas"],
    ["RAFAEL", "Rafael"],
    ["BETINHO", "Betinho"],
    ["ALEX PAULO", "Alex Paulo"],
  ];

  for (const [nick, partial] of overrides) {
    const emp = employees.find((e: any) => e.name.toUpperCase().startsWith(partial.toUpperCase()));
    if (emp) map[nick] = emp.id;
  }

  return map;
}

function buildObraMap(obras: any[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const o of obras) {
    map[o.name.toUpperCase()] = o.id;
    if (o.client) map[o.client.toUpperCase()] = o.id;
  }
  
  // Aliases
  const aliases: [string, string][] = [
    ["BRK OBRAS", "BRK Obras"],
    ["BRK\nOBRAS", "BRK Obras"],
    ["BRK", "BRK Obras"],
    ["BRK PROJETOS", "BRK Projetos"],
    ["ENGEKO - BRK", "Engeko - BRK"],
    ["ENGEKO", "Engeko - BRK"],
    ["PERNAMBUCO CONSTRUTORA", "Pernambuco Construtora"],
    ["FLAMBOYANT EMPREEDIMENTOS", "Flamboyant Empreendimentos"],
    ["FLAMBOYANT", "Flamboyant Empreendimentos"],
    ["LOTEAMENTO FLAMBOYANT", "Flamboyant Empreendimentos"],
    ["HBR TABAIARES", "HBR Tabaiares"],
    ["HBR - FOTOINHA", "HBR - Fotoinha"],
    ["HBR - FONTANHINHA", "HBR - Fotoinha"],
    ["HBR - FONTAINHA", "HBR - Fotoinha"],
    ["HBR - SANTA CLARA 1 E2", "HBR - Santa Clara 1 e 2"],
    ["HBR - SANTA CLARA 1 E 2", "HBR - Santa Clara 1 e 2"],
    ["HOSPITAL MARIA LUCINDA", "Hospital Maria Lucinda"],
    ["HOSP. MARIA LUCINDA", "Hospital Maria Lucinda"],
    ["GRUPO PETRIBU", "Grupo Petribu"],
    ["ENCAR - ARENA PERNAMBUCO", "ENCAR - Arena Pernambuco"],
    ["ENCAR - ARENA", "ENCAR - Arena Pernambuco"],
    ["POLIMIX - MCZ", "Polimix - MCZ"],
    ["POLIMIX MCZ", "Polimix - MCZ"],
    ["POLIMIX - JAB", "Polimix - JAB"],
    ["POLIMIX - JABOATÃO", "Polimix - JAB"],
    ["POLIMIX", "Polimix"],
    ["COLGRAVATA", "Colarcoverde"],
    ["COLGRAVATA - DIÁRIA", "Colarcoverde"],
    ["COLARCOVERDE", "Colarcoverde"],
    ["DIRECIONAL 788", "Direcional 788"],
    ["DIRECIONAL 788-C", "Direcional 788"],
    ["DIRECIONAL 747", "Direcional 747"],
    ["DIRECIONAL 747 - PETRIBU", "Direcional 747"],
    ["DIRECIONAL 652C", "Direcional 652C"],
    ["DIRECIONAL 652C -", "Direcional 652C"],
    ["DIRECIONAL 652 -C", "Direcional 652C"],
    ["DIRECIONAL - VARZEA", "Direcional - Varzea"],
    ["COLORADO - LOTES", "Colorado - Lotes"],
    ["COLORADO - GRAVATA", "Colorado - Gravata"],
    ["COLORADO - RICARDO ROCHA", "Colorado - Ricardo Rocha"],
    ["COLORADO - CADASTRO HIDRO", "Colorado - Cadastro Hidro"],
    ["COLORADO - PARQUE DA CIDADE", "Colorado - Parque da Cidade"],
    ["COLORADO - LOTES - ALAGOAS", "Colorado - Alagoas"],
    ["COLORADO - ALAGOAS", "Colorado - Alagoas"],
    ["JME - ALPEK", "JME - ALPEK"],
    ["JME - ALPEX", "JME - ALPEK"],
    ["JME - ALPEK / POLIMIX", "JME - ALPEK"],
    ["MAX", "MAX"],
    ["VIANA & MOURA", "Viana & Moura"],
    ["VIANA MOURA", "Viana & Moura"],
    ["VIANA MOURA / COLORADO", "Viana & Moura"],
    ["MARCOS E ALEXANDRE", "Marcos e Alexandre"],
    ["AGUARDANDO SERVIÇO", "Aguardando Serviço"],
    ["AGUARDANDO", "Aguardando Serviço"],
    ["ESCRITÓRIO / AG", "Escritório / AG"],
    ["AG", "Escritório / AG"],
    ["AG COM DIEGO", "Escritório / AG"],
    ["SIMPROJA", "Simproja"],
    ["SIMPROJA -", "Simproja"],
    ["SIMPROJA - ASSOCIAÇÃO", "Simproja"],
    ["JOSELITA", "Joselita"],
    ["JOSELITA / HOSP. MARIA LUCINDA", "Joselita"],
    ["HUGREEN INTELIGENCIA ENERGETICA", "Hugreen Inteligencia Energetica"],
    ["HUGREEN", "Hugreen Inteligencia Energetica"],
    ["SHOPPING PLAZA", "Shopping Plaza"],
    ["ANGELICA VILLANOVA", "Angelica Villanova"],
    ["NOGUEIRA - CASTRO LIMA", "Nogueira - Castro Lima"],
    ["ARQ. FERNADA DURÕES", "Arq. Fernanda Durões"],
    ["ARQ. FERNANDA DURÕES", "Arq. Fernanda Durões"],
    ["AUREA - IMIP", "Aurea - IMIP"],
    ["COBEM PARTICIPAÇÕES", "Cobem Participações"],
    ["PC ENGENHARIA", "PC Engenharia"],
    ["GRUPO AMARANTE - EMISSÁRIO", "Grupo Amarante - Emissário"],
    ["GRUPO AMARANTE", "Grupo Amarante"],
    ["PETRINBU EMPREENDIMENTOS", "Petrinbu Empreendimentos"],
    ["LEO DOURADO", "Leo Dourado"],
    ["RAFAELA - PORTAL GRAVATA", "Rafaela - Portal Gravata"],
    ["SANDRA", "Sandra"],
    ["ALEXSANDRA", "Alexsandra"],
    ["AGUSTO", "Agusto"],
    ["PLANOA GESTÃO ARQUITETURA", "Planoa Gestão Arquitetura"],
    ["PLANOA", "Planoa Gestão Arquitetura"],
    ["2MS ENGENHARIA", "2MS Engenharia"],
    ["2MS ENGENHARIA -RAFAEL GUE", "2MS Engenharia"],
    ["COLARRIO", "Colarrio"],
    ["COLARRIO 1,2,3, E 4", "Colarrio"],
    ["POLIMIX - JAB", "Polimix - JAB"],
    ["POLIMIX - AREA LAGOA", "Polimix"],
    ["HBR", "HBR Tabaiares"],
    ["HBR - PIEDADE", "HBR - Piedade"],
    ["ENCAR", "ENCAR"],
    ["DIRECIONAL 788 - CERAMICA", "Direcional 788"],
    ["RAFAELA", "Rafaela - Portal Gravata"],
    ["AGUARDA LOCAL", "Aguardando Serviço"],
  ];

  for (const [alias, obraName] of aliases) {
    const obra = obras.find((o: any) => o.name.toUpperCase() === obraName.toUpperCase());
    if (obra) map[alias] = obra.id;
  }

  return map;
}

function buildVehicleMap(vehicles: any[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const v of vehicles) {
    map[v.model.toUpperCase()] = v.id;
    map[v.plate.toUpperCase()] = v.id;
    // Normalize plate
    const normalizedPlate = v.plate.replace(/[\s-]/g, "").toUpperCase();
    map[normalizedPlate] = v.id;
  }
  
  // Aliases
  const aliases: Record<string, string> = {
    "CLASIC": "CLASSIC",
    "VERSA": "VERZA",
    "PEUGEOT": "PEUGEOT",
    "PEUGEOUT": "PEUGEOT",
  };

  for (const [alias, model] of Object.entries(aliases)) {
    const v = vehicles.find((v: any) => v.model.toUpperCase() === model.toUpperCase());
    if (v) map[alias] = v.id;
  }

  return map;
}

function findEmployee(name: string, map: Record<string, string>): string | null {
  if (!name) return null;
  const upper = name.toUpperCase().trim();
  
  // Direct match
  if (map[upper]) return map[upper];
  
  // Try removing special chars
  const cleaned = upper.replace(/[()]/g, "").trim();
  if (map[cleaned]) return map[cleaned];
  
  // Try first part before "/"
  const parts = upper.split("/");
  if (parts.length > 1 && map[parts[0].trim()]) return map[parts[0].trim()];
  
  return null;
}

function findObra(name: string, map: Record<string, string>): string | null {
  if (!name) return null;
  const upper = name.toUpperCase().trim();
  
  if (map[upper]) return map[upper];
  
  // Try partial matches
  for (const [key, id] of Object.entries(map)) {
    if (upper.startsWith(key) || key.startsWith(upper)) return id;
  }
  
  // Detect BRK Obras vs BRK Projetos based on location
  if (upper.includes("BRK")) {
    // Check if location line says "PROJETOS"
    // This is handled by the parser checking the location field
    return map["BRK"] || null;
  }

  return null;
}

function findVehicle(model: string, plate: string, map: Record<string, string>): string | null {
  if (!model && !plate) return null;
  
  if (plate) {
    const upperPlate = plate.toUpperCase().replace(/[\s-]/g, "");
    if (map[upperPlate]) return map[upperPlate];
  }
  
  if (model) {
    const upperModel = model.toUpperCase().trim();
    if (map[upperModel]) return map[upperModel];
  }
  
  return null;
}
