/** Canonical list of field (campo) roles used throughout the system */
export const FIELD_ROLES = [
  "Topógrafo",
  "Topógrafo I",
  "Topógrafo II",
  "Topógrafo III",
  "Topógrafo III A",
  "Topógrafo IV",
  "Ajudante de Topografia",
  "Auxiliar de Topografia",
] as const;

/** All employee roles — used in the RH form dropdown */
export const ALL_EMPLOYEE_ROLES = [
  // Campo
  "Topógrafo",
  "Topógrafo I",
  "Topógrafo II",
  "Topógrafo III",
  "Topógrafo III A",
  "Topógrafo IV",
  "Ajudante de Topografia",
  "Auxiliar de Topografia",
  // Sala Técnica
  "Desenhista",
  "Cadista",
  "Projetista",
  "Técnico em Geoprocessamento",
  "Estagiário",
  // Administrativo
  "Administrativo",
  "Financeiro",
  "Comercial",
  "RH",
  "Diretor",
  "Gerente Operacional",
  "Líder Sala Técnica",
  "Auxiliar",
  "Motorista",
] as const;

const fieldRolesLower = new Set(FIELD_ROLES.map((r) => r.toLowerCase()));

/** Keywords that identify a field role (case-insensitive partial match) */
const FIELD_KEYWORDS = ["topógrafo", "topografo", "ajudante", "auxiliar de topografia"];

/** Returns true if the given role is a field (campo) role */
export function isFieldRole(role?: string | null): boolean {
  if (!role) return false;
  const lower = role.toLowerCase();
  return fieldRolesLower.has(lower) || FIELD_KEYWORDS.some((kw) => lower.includes(kw));
}

/** Returns true if the role is a topógrafo variant */
export function isTopografo(role?: string | null): boolean {
  if (!role) return false;
  const lower = role.toLowerCase();
  return lower.includes("topógrafo") || lower.includes("topografo");
}

/** Canonical list of technical (Sala Técnica) roles used throughout the system */
export const TECH_ROLES = [
  "Cadista",
  "Cartógrafo - Prestador",
  "Técnico de Saneamento",
  "Técnica em Saneamento - Estagiária",
  "Técnica em Saneamento - Prestadora",
  "Técnico em Edificações",
] as const;

const techRolesLower = new Set(TECH_ROLES.map((r) => r.toLowerCase()));

/** Returns true if the given role is a technical (Sala Técnica) role */
export function isTechRole(role?: string | null): boolean {
  if (!role) return false;
  return techRolesLower.has(role.toLowerCase());
}

/** Returns true if the role is a director */
export function isDirector(role?: string | null): boolean {
  if (!role) return false;
  const lower = role.toLowerCase();
  return lower === "diretor" || lower === "diretor(a)";
}

/** Canonical list of commercial directors (name fragments, lowercase) */
export const COMMERCIAL_DIRECTORS = ["sérgio", "sergio", "ciro"] as const;

/** Returns true if the given name matches a known commercial director */
export function isCommercialDirector(name: string | null | undefined): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  return COMMERCIAL_DIRECTORS.some(d => lower.includes(d));
}
