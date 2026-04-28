/**
 * Marco Zero: dados operacionais anteriores a esta data são legado.
 * Queries operacionais filtram is_legacy = false ou date >= MARCO_ZERO.
 */
export const MARCO_ZERO = "2026-03-31";

/** Roles que podem ver dados financeiros (valores, billing_type, etc.) */
export const FINANCIAL_ROLES = ["master", "diretor", "financeiro"] as const;

/** Verifica se o role pode ver dados financeiros */
export function canSeeFinancials(role: string | null): boolean {
  return (FINANCIAL_ROLES as readonly string[]).includes(role ?? "");
}
