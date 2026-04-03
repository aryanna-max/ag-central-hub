/** Canonical list of field (campo) roles used throughout the system */
export const FIELD_ROLES = [
  "Topógrafo",
  "Topógrafo I",
  "Topógrafo II",
  "Topógrafo III",
  "Topógrafo III A",
  "Topógrafo IV",
  "Ajudante de Topografia",
] as const;

const fieldRolesLower = new Set(FIELD_ROLES.map((r) => r.toLowerCase()));

/** Returns true if the given role is a field (campo) role */
export function isFieldRole(role?: string | null): boolean {
  if (!role) return false;
  return fieldRolesLower.has(role.toLowerCase());
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

/** Canonical list of commercial directors (name fragments, lowercase) */
export const COMMERCIAL_DIRECTORS = ["sérgio", "sergio", "ciro"] as const;

/** Returns true if the given name matches a known commercial director */
export function isCommercialDirector(name: string | null | undefined): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  return COMMERCIAL_DIRECTORS.some(d => lower.includes(d));
}
