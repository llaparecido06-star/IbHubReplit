import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { fetchEvents, type AppEvent } from "@/services/api";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const WHITE  = "#ffffff";
const BG     = "#f5f5f0";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";

type FilterKey = "todos" | "presencial" | "online" | "meus";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "todos",      label: "Todos" },
  { key: "presencial", label: "Presencial" },
  { key: "online",     label: "Online" },
  { key: "meus",       label: "Meus" },
];

export default function EventosPage() {
  const { profile } = useAuth();
  const [, setLocation] = useLocation();
  const [events, setEvents]   = useState<AppEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<FilterKey>("todos");

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchEvents(profile?.id ?? "")
      .then((data) => { if (active) setEvents(data); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [profile?.id]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (filter === "presencial") return e.location_type === "presencial";
      if (filter === "online")     return e.location_type === "online";
      if (filter === "meus")       return e.is_registered === true;
      return true;
    });
  }, [events, filter]);

  return (
    <AppShell>
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: NAVY, margin: "0 0 4px" }}>📅 Eventos</h1>
            <p style={{ color: MUTED, fontSize: 14, margin: 0 }}>Descubra degustações, masterclasses e eventos do setor.</p>
          </div>
          <button
            type="button"
            onClick={() => setLocation("/app/meus-eventos")}
            style={{
              backgroundColor: NAVY, color: GOLD, border: "none", borderRadius: 10,
              padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}
          >
            + Criar evento
          </button>
        </div>

        <div role="tablist" aria-label="Filtros de eventos" style={{ display: "flex", gap: 8, marginBottom: 18, overflowX: "auto", paddingBottom: 4 }}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(f.key)}
                style={{
                  padding: "8px 16px", borderRadius: 20,
                  border: `1px solid ${active ? NAVY : BORDER}`,
                  backgroundColor: active ? NAVY : WHITE,
                  color: active ? GOLD : NAVY,
                  fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0,
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <div style={{ backgroundColor: WHITE, borderRadius: 16, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 48, color: MUTED }}>Carregando eventos…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48 }}>
              <div style={{ fontSize: 40, marginBottom: 10 }} aria-hidden>📅</div>
              <p style={{ color: MUTED, fontWeight: 600, margin: "0 0 4px" }}>Nenhum evento encontrado</p>
              <p style={{ color: MUTED, fontSize: 13, margin: 0 }}>Tente outro filtro ou volte mais tarde.</p>
            </div>
          ) : (
            filtered.map((evt, idx) => {
              const isPast = new Date(evt.start_date) < new Date();
              const day = new Date(evt.start_date).getDate();
              const month = new Date(evt.start_date).toLocaleDateString("pt-BR", { month: "short" });
              const time = new Date(evt.start_date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
              return (
                <button
                  key={evt.id}
                  type="button"
                  onClick={() => setLocation(`/app/eventos/${evt.id}`)}
                  style={{
                    width: "100%", textAlign: "left",
                    padding: "16px 20px",
                    borderBottom: idx < filtered.length - 1 ? `1px solid ${BORDER}` : "none",
                    background: "none", border: "none", borderTop: "none", cursor: "pointer",
                    display: "flex", gap: 16, alignItems: "flex-start",
                  }}
                >
                  <div style={{
                    flexShrink: 0, backgroundColor: isPast ? BORDER : `${GOLD}20`,
                    borderRadius: 10, padding: "10px 14px", textAlign: "center", minWidth: 56,
                  }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: isPast ? MUTED : GOLD, lineHeight: 1 }}>
                      {day}
                    </div>
                    <div style={{ fontSize: 11, color: isPast ? MUTED : GOLD, textTransform: "uppercase", fontWeight: 700, marginTop: 2 }}>
                      {month}
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
                        backgroundColor: evt.location_type === "online" ? "#22c55e18" : `${NAVY}10`,
                        color: evt.location_type === "online" ? "#16a34a" : NAVY,
                      }}>
                        {evt.location_type === "online" ? "Online" : "Presencial"}
                      </span>
                      {evt.is_registered && (
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
                          backgroundColor: `${GOLD}25`, color: GOLD,
                        }}>
                          Confirmado
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 4, lineHeight: 1.4 }}>
                      {evt.title}
                    </div>
                    <div style={{ fontSize: 12, color: MUTED, display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <span>🕐 {time}</span>
                      {evt.location && <span>📍 {evt.location}</span>}
                      {typeof evt.attendees_count === "number" && (
                        <span>👥 {evt.attendees_count} confirmado(s)</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
}
