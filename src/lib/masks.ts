/** Utility functions for formatting Brazilian document numbers, phone, and CEP */

/** Remove all non-digit characters */
export function extractDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Format CPF: 123.456.789-00 */
export function formatCpf(value: string): string {
  const digits = extractDigits(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/** Format CNPJ: 12.345.678/0001-00 */
export function formatCnpj(value: string): string {
  const digits = extractDigits(value).slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

/** Auto-detect CPF or CNPJ by digit count and format accordingly */
export function formatDoc(value: string): string {
  const digits = extractDigits(value);
  if (digits.length <= 11) return formatCpf(value);
  return formatCnpj(value);
}

/** Format phone: (81) 99999-0000 or (81) 9999-0000 */
export function formatPhone(value: string): string {
  const digits = extractDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** Format CEP: 50000-000 */
export function formatCep(value: string): string {
  const digits = extractDigits(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}
