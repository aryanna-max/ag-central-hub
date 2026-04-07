/**
 * Exporta dados para CSV com BOM UTF-8 para compatibilidade com Excel.
 */
export function exportCsv(headers: string[], rows: string[][], filename: string) {
  const escape = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const csv = [
    headers.map(escape).join(","),
    ...rows.map((r) => r.map(escape).join(",")),
  ].join("\n");
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
