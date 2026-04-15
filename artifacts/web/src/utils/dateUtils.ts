export function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} hora${h !== 1 ? "s" : ""}`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `há ${d} dia${d !== 1 ? "s" : ""}`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
