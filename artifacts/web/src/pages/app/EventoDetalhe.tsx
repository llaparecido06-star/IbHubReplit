import React, { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import {
  AppEvent,
  EventParticipant,
  fetchEventById,
  fetchEventParticipants,
  registerForEvent,
  unregisterFromEvent,
} from "@/services/api";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function EventoDetalhe() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/app/eventos/:id");
  const id = params?.id ?? "";

  const [event, setEvent] = useState<AppEvent | null>(null);
  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (!id || !user?.id) return;
    Promise.all([
      fetchEventById(id, user.id),
      fetchEventParticipants(id),
    ]).then(([ev, parts]) => {
      setEvent(ev);
      setParticipants(parts);
      setLoading(false);
    });
  }, [id, user?.id]);

  const handleToggle = async () => {
    if (!event || !user?.id) return;
    setToggling(true);
    const wasReg = !!event.is_registered;
    if (wasReg) {
      await unregisterFromEvent(event.id, user.id);
      setEvent((prev) => prev ? { ...prev, is_registered: false, attendees_count: Math.max((prev.attendees_count ?? 1) - 1, 0) } : prev);
      setParticipants((prev) => prev.filter((p) => p.user_id !== user.id));
    } else {
      await registerForEvent(event.id, user.id);
      setEvent((prev) => prev ? { ...prev, is_registered: true, attendees_count: (prev.attendees_count ?? 0) + 1 } : prev);
    }
    setToggling(false);
  };

  if (loading) {
    return (
      <AppShell>
        <div style={{ textAlign: "center", padding: 80 }}>
          <div style={{ fontSize: 32 }}>⏳</div>
          <p style={{ color: "#aaa" }}>Carregando...</p>
        </div>
      </AppShell>
    );
  }

  if (!event) {
    return (
      <AppShell>
        <div style={{ textAlign: "center", padding: 80 }}>
          <div style={{ fontSize: 48 }}>😕</div>
          <h2 style={{ color: NAVY }}>Evento não encontrado</h2>
          <button
            onClick={() => setLocation("/app/oportunidades")}
            style={{ color: GOLD, background: "none", border: "none", cursor: "pointer", fontSize: 15, fontWeight: 700 }}
          >← Voltar</button>
        </div>
      </AppShell>
    );
  }

  const isOnline = event.location_type === "online";
  const isFree = event.entry_type === "gratuito";
  const isPast = new Date(event.start_date).getTime() < Date.now();
  const isFull = event.max_attendees != null && (event.attendees_count ?? 0) >= event.max_attendees;

  return (
    <AppShell>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px" }}>
        <button
          onClick={() => setLocation("/app/oportunidades")}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#8a93a2", fontSize: 14, marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}
        >← Voltar para Oportunidades</button>

        {/* Cover image */}
        {event.cover_image_url && (
          <img
            src={event.cover_image_url}
            alt={event.title}
            style={{ width: "100%", height: 220, objectFit: "cover", borderRadius: 16, marginBottom: 16 }}
          />
        )}

        {/* Main card */}
        <div style={{ backgroundColor: "#fff", borderRadius: 16, border: "1px solid #e8eaed", padding: 28, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <span style={{ backgroundColor: isOnline ? "#ede9fe" : "#f0f9ff", color: isOnline ? "#7c3aed" : "#0369a1", fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 8 }}>
              {isOnline ? "Online" : "Presencial"}
            </span>
            <span style={{ backgroundColor: isFree ? "#dcfce7" : "#fff7ed", color: isFree ? "#16a34a" : "#ea580c", fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 8 }}>
              {isFree ? "Gratuito" : event.price ? `R$ ${event.price}` : "Pago"}
            </span>
            {isPast && (
              <span style={{ backgroundColor: "#f3f4f6", color: "#6b7280", fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 8 }}>
                Encerrado
              </span>
            )}
          </div>

          <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, margin: "0 0 16px" }}>{event.title}</h1>

          <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#555" }}>
              <span>📅</span> {fmtDate(event.start_date)}
              {event.end_date && event.end_date !== event.start_date && (
                <span style={{ color: "#aaa" }}> — {fmtDate(event.end_date)}</span>
              )}
            </div>
            {event.location && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#555" }}>
                <span>📍</span> {event.location}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#555" }}>
              <span>👥</span> {event.attendees_count ?? 0} inscrito{(event.attendees_count ?? 0) !== 1 ? "s" : ""}
              {event.max_attendees && (
                <span style={{ color: isFull ? "#dc2626" : "#aaa" }}>
                  {isFull ? " — Esgotado" : ` / ${event.max_attendees} vagas`}
                </span>
              )}
            </div>
          </div>

          {event.description && (
            <>
              <hr style={{ border: "none", borderTop: "1px solid #e8eaed", margin: "16px 0" }} />
              <h3 style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 10 }}>Sobre o evento</h3>
              <p style={{ fontSize: 14, color: "#555", lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0 }}>{event.description}</p>
            </>
          )}
        </div>

        {/* Registration action */}
        {!isPast && (
          <div style={{ backgroundColor: "#fff", borderRadius: 16, border: "1px solid #e8eaed", padding: 24, marginBottom: 16 }}>
            {event.is_registered ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>🎟️</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#16a34a" }}>Você está inscrito neste evento!</span>
                </div>
                <button
                  onClick={handleToggle}
                  disabled={toggling}
                  style={{
                    padding: "10px 0",
                    backgroundColor: "#f3f4f6",
                    color: "#dc2626",
                    border: "none",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    opacity: toggling ? 0.6 : 1,
                  }}
                >{toggling ? "Cancelando..." : "Cancelar inscrição"}</button>
              </div>
            ) : (
              <button
                onClick={handleToggle}
                disabled={toggling || isFull}
                style={{
                  width: "100%",
                  padding: "14px 0",
                  backgroundColor: isFull ? "#e5e7eb" : GOLD,
                  color: isFull ? "#9ca3af" : "#fff",
                  border: "none",
                  borderRadius: 12,
                  fontSize: 15,
                  fontWeight: 800,
                  cursor: isFull ? "not-allowed" : "pointer",
                  opacity: toggling ? 0.6 : 1,
                }}
              >{toggling ? "Inscrevendo..." : isFull ? "Esgotado" : "📅 Inscrever-se"}</button>
            )}
          </div>
        )}

        {/* Participants list */}
        {participants.length > 0 && (
          <div style={{ backgroundColor: "#fff", borderRadius: 16, border: "1px solid #e8eaed", padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: NAVY, margin: "0 0 16px" }}>
              👥 Participantes ({participants.length})
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {participants.map((p) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                    backgroundColor: `${GOLD}22`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, overflow: "hidden",
                  }}>
                    {p.profile?.avatar_url ? (
                      <img src={p.profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : "👤"}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>
                      {p.profile?.full_name ?? "Usuário"}
                    </div>
                    {p.profile?.plan && (
                      <div style={{ fontSize: 12, color: GOLD, fontWeight: 600, textTransform: "capitalize" }}>
                        {p.profile.plan}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
