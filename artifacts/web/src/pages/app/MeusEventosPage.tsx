import React, { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { fetchMyEvents, createEvent, deleteEvent, AppEvent } from "@/services/api";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";
const BG = "#f5f5f0";
const BORDER = "#e8e8e3";
const MUTED = "#7a8494";

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 13px", borderRadius: 9, border: `1.5px solid ${BORDER}`,
  fontSize: 14, fontFamily: "inherit", boxSizing: "border-box",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function MeusEventosPage() {
  const { profile } = useAuth();
  const [, setLocation] = useLocation();
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    start_date: "",
    end_date: "",
    location: "",
    location_type: "presencial" as "presencial" | "online",
    entry_type: "gratuito" as "gratuito" | "pago",
    price: "",
    max_attendees: "",
  });

  const loadEvents = useCallback(async () => {
    if (!profile?.id) return;
    const evts = await fetchMyEvents(profile.id);
    setEvents(evts);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const handleCreate = async () => {
    if (!profile?.id) return;
    if (!form.title.trim()) { setFormError("Título é obrigatório."); return; }
    if (!form.start_date) { setFormError("Data de início é obrigatória."); return; }
    setFormError("");
    setSubmitting(true);
    const event = await createEvent({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      start_date: form.start_date,
      end_date: form.end_date || undefined,
      location: form.location.trim() || undefined,
      location_type: form.location_type,
      entry_type: form.entry_type,
      price: form.entry_type === "pago" && form.price ? parseFloat(form.price) : undefined,
      max_attendees: form.max_attendees ? parseInt(form.max_attendees) : undefined,
      created_by: profile.id,
    });
    if (event) {
      setEvents(prev => [event, ...prev]);
      setShowForm(false);
      setForm({ title: "", description: "", start_date: "", end_date: "", location: "", location_type: "presencial", entry_type: "gratuito", price: "", max_attendees: "" });
    }
    setSubmitting(false);
  };

  const handleDelete = async (eventId: string) => {
    if (!profile?.id) return;
    if (!confirm("Tem certeza que deseja excluir este evento?")) return;
    setDeleting(eventId);
    const ok = await deleteEvent(eventId, profile.id);
    if (ok) setEvents(prev => prev.filter(e => e.id !== eventId));
    setDeleting(null);
  };

  return (
    <AppShell>
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: NAVY, marginBottom: 4 }}>📅 Meus Eventos</h1>
            <p style={{ color: MUTED, fontSize: 14 }}>Gerencie os eventos que você criou na plataforma.</p>
          </div>
          <button
            onClick={() => setShowForm(v => !v)}
            style={{ padding: "10px 20px", backgroundColor: GOLD, color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 14, whiteSpace: "nowrap" }}
          >
            {showForm ? "Cancelar" : "+ Criar evento"}
          </button>
        </div>

        {showForm && (
          <div style={{ backgroundColor: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, padding: 26, marginBottom: 24 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: NAVY, marginBottom: 20 }}>Criar novo evento</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: "block", marginBottom: 6 }}>Título do evento *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Degustação de Vinhos da Serra Gaúcha" style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: "block", marginBottom: 6 }}>Descrição</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descreva o evento, programação, requisitos..." rows={3} style={{ ...inputStyle, resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: "block", marginBottom: 6 }}>Data/hora início *</label>
                  <input type="datetime-local" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: "block", marginBottom: 6 }}>Data/hora fim</label>
                  <input type="datetime-local" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 14 }}>
                <div style={{ flex: 2 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: "block", marginBottom: 6 }}>Local / Link</label>
                  <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Endereço ou link online" style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: "block", marginBottom: 6 }}>Formato</label>
                  <select value={form.location_type} onChange={e => setForm(f => ({ ...f, location_type: e.target.value as any }))} style={{ ...inputStyle, backgroundColor: "#fff" }}>
                    <option value="presencial">Presencial</option>
                    <option value="online">Online</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: "block", marginBottom: 6 }}>Entrada</label>
                  <select value={form.entry_type} onChange={e => setForm(f => ({ ...f, entry_type: e.target.value as any }))} style={{ ...inputStyle, backgroundColor: "#fff" }}>
                    <option value="gratuito">Gratuito</option>
                    <option value="pago">Pago</option>
                  </select>
                </div>
                {form.entry_type === "pago" && (
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: "block", marginBottom: 6 }}>Preço (R$)</label>
                    <input type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0,00" style={inputStyle} />
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: "block", marginBottom: 6 }}>Máx. participantes</label>
                  <input type="number" min="1" value={form.max_attendees} onChange={e => setForm(f => ({ ...f, max_attendees: e.target.value }))} placeholder="Ilimitado" style={inputStyle} />
                </div>
              </div>
              {formError && <p style={{ color: "#dc3545", fontSize: 13, fontWeight: 600 }}>{formError}</p>}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 8 }}>
                <button onClick={() => setShowForm(false)} style={{ padding: "10px 20px", borderRadius: 9, border: `1.5px solid ${BORDER}`, backgroundColor: "#fff", color: NAVY, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Cancelar</button>
                <button onClick={handleCreate} disabled={submitting} style={{ padding: "10px 24px", borderRadius: 9, border: "none", backgroundColor: submitting ? BORDER : GOLD, color: submitting ? MUTED : "#fff", fontWeight: 700, cursor: submitting ? "default" : "pointer", fontSize: 13 }}>
                  {submitting ? "Criando..." : "Criar evento"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ backgroundColor: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${BORDER}`, backgroundColor: "#fafaf8" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{events.length} evento{events.length !== 1 ? "s" : ""} criado{events.length !== 1 ? "s" : ""}</span>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: 48, color: MUTED }}>Carregando...</div>
          ) : events.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48 }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📅</div>
              <p style={{ color: MUTED, fontWeight: 600 }}>Nenhum evento criado</p>
              <p style={{ color: MUTED, fontSize: 13 }}>Crie seu primeiro evento para a comunidade do vinho.</p>
            </div>
          ) : (
            <div>
              {events.map((evt, idx) => {
                const isPast = new Date(evt.start_date) < new Date();
                return (
                  <div
                    key={evt.id}
                    style={{ padding: "16px 20px", borderBottom: idx < events.length - 1 ? `1px solid ${BORDER}` : "none", display: "flex", gap: 16, alignItems: "flex-start" }}
                  >
                    <div style={{ flexShrink: 0, backgroundColor: isPast ? BORDER : `${GOLD}20`, borderRadius: 10, padding: "10px 14px", textAlign: "center", minWidth: 56 }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: isPast ? MUTED : GOLD }}>
                        {new Date(evt.start_date).getDate()}
                      </div>
                      <div style={{ fontSize: 11, color: isPast ? MUTED : GOLD, textTransform: "uppercase", fontWeight: 700 }}>
                        {new Date(evt.start_date).toLocaleDateString("pt-BR", { month: "short" })}
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        onClick={() => setLocation(`/app/eventos/${evt.id}`)}
                        style={{ fontWeight: 700, fontSize: 15, color: NAVY, marginBottom: 4, cursor: "pointer" }}
                      >
                        {evt.title}
                      </div>
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: MUTED }}>📅 {formatDate(evt.start_date)}</span>
                        {evt.location && <span style={{ fontSize: 12, color: MUTED }}>📍 {evt.location}</span>}
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                          backgroundColor: evt.location_type === "online" ? "#e3f0ff" : "#f0ffe3",
                          color: evt.location_type === "online" ? "#1a5fa8" : "#2a7a2a",
                        }}>
                          {evt.location_type === "online" ? "Online" : "Presencial"}
                        </span>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                          backgroundColor: evt.entry_type === "pago" ? "#fff3cd" : "#d4edda",
                          color: evt.entry_type === "pago" ? "#856404" : "#155724",
                        }}>
                          {evt.entry_type === "pago" ? `R$ ${evt.price?.toFixed(2)}` : "Gratuito"}
                        </span>
                        {evt.attendees_count !== undefined && (
                          <span style={{ fontSize: 12, color: MUTED }}>👥 {evt.attendees_count} inscritos</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(evt.id)}
                      disabled={deleting === evt.id}
                      style={{ flexShrink: 0, padding: "7px 14px", borderRadius: 8, border: "1px solid #fca5a5", backgroundColor: "#fff", color: "#dc2626", fontWeight: 700, cursor: "pointer", fontSize: 12 }}
                    >
                      {deleting === evt.id ? "..." : "Excluir"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
