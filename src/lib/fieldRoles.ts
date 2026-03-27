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
