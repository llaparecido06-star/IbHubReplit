import React, { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { supabase } from "@/lib/supabase";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";
const TABS = ["Todos", "Próximos", "Passados"];

interface AppEvent {
  id: string;
  title: string;
  description: string | null;
  date: string;
  location: string | null;
  image_url: string | null;
  created_at: string;
  user_id: string;
  price_cents?: number | null;
  is_online?: boolean;
}

function formatDate(d: string) {
  try { return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }); } catch { return d; }
}

export default function AdminEventos() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allEvents, setAllEvents] = useState<AppEvent[]>([]);
  const [totalAttendances, setTotalAttendances] = useState(0);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("Todos");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [eventsRes, attendRes] = await Promise.all([
        supabase.from("events").select("*").order("date", { ascending: false }),
        supabase.from("event_attendances").select("id", { count: "exact", head: true }).eq("status", "confirmed"),
      ]);
      setAllEvents((eventsRes.data ?? []) as AppEvent[]);
      setTotalAttendances(attendRes.count ?? 0);
    } catch (e) {
      console.error("AdminEventos load:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const now = new Date();
  const filtered = allEvents.filter((e) => {
    const matchesSearch =
      !search.trim() ||
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      (e.location ?? "").toLowerCase().includes(search.toLowerCase());
    const eventDate = new Date(e.date);
    const matchesTab =
      tab === "Todos" ||
      (tab === "Próximos" && eventDate >= now) ||
      (tab === "Passados" && eventDate < now);
    return matchesSearch && matchesTab;
  });

  const upcoming = allEvents.filter((e) => new Date(e.date) >= now).length;
  const past = allEvents.filter((e) => new Date(e.date) < now).length;

  const kpiItems = [
    { icon: "📅", iconBg: "#ede9fe", label: "Total de Eventos", value: allEvents.length },
    { icon: "🔜", iconBg: "#d1fae5", label: "Próximos",          value: upcoming },
    { icon: "✓",  iconBg: "#f3f4f6", label: "Passados",          value: past },
    { icon: "👥", iconBg: "#fef9ee", label: "Confirmados",       value: totalAttendances },
  ];

  return (
    <AdminShell>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, margin: "0 0 4px" }}>Eventos</h1>
            <p style={{ fontSize: 14, color: "#8a93a2", margin: 0 }}>Gerenciamento de eventos da plataforma</p>
          </div>
          <button onClick={() => { setRefreshing(true); load().finally(() => setRefreshing(false)); }} style={{ padding: "8px 16px", backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: NAVY }}>
            {refreshing ? "..." : "↻ Atualizar"}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
          {kpiItems.map((k) => (
            <div key={k.label} style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 18 }}>
              <div style={{ width: 42, height: 42, backgroundColor: k.iconBg, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, marginBottom: 10 }}>{k.icon}</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: NAVY }}>{loading ? "..." : k.value}</div>
              <div style={{ fontSize: 12, color: "#8a93a2", marginTop: 2 }}>{k.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#aaa" }}>🔍</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar eventos..." style={{ width: "100%", padding: "10px 12px 10px 36px", border: "1px solid #e8eaed", borderRadius: 10, fontSize: 14, outline: "none", backgroundColor: "#fff", boxSizing: "border-box" }} />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {TABS.map((t) => (
              <button key={t} onClick={() => setTab(t)} style={{ padding: "10px 16px", border: "1px solid #e8eaed", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: tab === t ? 700 : 400, backgroundColor: tab === t ? NAVY : "#fff", color: tab === t ? "#fff" : "#555" }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 80 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <p style={{ color: "#aaa" }}>Carregando eventos...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, backgroundColor: "#fff", borderRadius: 14, border: "1px solid #e8eaed" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
            <p style={{ color: "#aaa" }}>Nenhum evento encontrado.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filtered.map((event) => {
              const isPast = new Date(event.date) < now;
              return (
                <div key={event.id} style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 18, display: "flex", gap: 16, alignItems: "flex-start" }}>
                  {event.image_url ? (
                    <img src={event.image_url} alt="" style={{ width: 72, height: 72, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 72, height: 72, borderRadius: 10, backgroundColor: `${GOLD}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0 }}>📅</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>{event.title}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, backgroundColor: isPast ? "#f3f4f6" : "#d1fae5", color: isPast ? "#6b7280" : "#059669", padding: "2px 7px", borderRadius: 5 }}>
                        {isPast ? "Passado" : "Próximo"}
                      </span>
                    </div>
                    {event.description && <p style={{ fontSize: 13, color: "#555", margin: "0 0 8px", lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{event.description}</p>}
                    <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#8a93a2" }}>
                      <span>📅 {formatDate(event.date)}</span>
                      {event.location && <span>📍 {event.location}</span>}
                      {event.price_cents != null && <span>💰 {event.price_cents === 0 ? "Gratuito" : `R$ ${(event.price_cents / 100).toFixed(2)}`}</span>}
                      {event.is_online && <span>🌐 Online</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
