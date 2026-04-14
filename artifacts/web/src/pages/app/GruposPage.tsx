import React, { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const WHITE  = "#ffffff";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";

const SAMPLE_GROUPS = [
  {
    id: "1",
    name: "Sommeliers do Brasil",
    description: "Grupo para profissionais certificados da APASOC, ASI e Court of Master Sommeliers.",
    members: 1247,
    category: "Profissional",
    color: "#722f37",
    emoji: "🍷",
    private: false,
  },
  {
    id: "2",
    name: "Vitivinicultura Gaúcha",
    description: "Produtores e entusiastas dos vinhos da Serra Gaúcha, Campanha e demais regiões do RS.",
    members: 843,
    category: "Região",
    color: "#15803d",
    emoji: "🍇",
    private: false,
  },
  {
    id: "3",
    name: "Wine Investment Club",
    description: "Discussão sobre mercado secundário, leilões, rentabilidade e colecionismo.",
    members: 412,
    category: "Negócios",
    color: "#c9a84c",
    emoji: "📈",
    private: true,
  },
  {
    id: "4",
    name: "Enoturismo Brasil",
    description: "Rotas de vinho, hospedagens em vinícolas e dicas para quem ama turismo vínico.",
    members: 2103,
    category: "Turismo",
    color: "#1d4ed8",
    emoji: "🗺️",
    private: false,
  },
  {
    id: "5",
    name: "Espumantes & Champagnes",
    description: "Dedicado aos produtores e apreciadores de vinhos espumantes de todo o mundo.",
    members: 674,
    category: "Estilo",
    color: "#9333ea",
    emoji: "🥂",
    private: false,
  },
  {
    id: "6",
    name: "Vinhos Naturais & Biodinâmicos",
    description: "Produção sustentável, vinificação sem intervenção e o movimento natural brasileiro.",
    members: 538,
    category: "Sustentabilidade",
    color: "#059669",
    emoji: "🌿",
    private: false,
  },
];

const CATEGORIES = ["Todos", "Profissional", "Região", "Negócios", "Turismo", "Estilo", "Sustentabilidade"];

function GroupCard({ group }: { group: typeof SAMPLE_GROUPS[0] }) {
  const [joined, setJoined] = useState(false);

  return (
    <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: "hidden" }}>
      <div style={{ height: 60, background: `linear-gradient(135deg, ${group.color}30 0%, ${group.color}18 100%)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 30 }}>{group.emoji}</span>
      </div>
      <div style={{ padding: "14px 16px 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 6 }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: NAVY, margin: 0, flex: 1 }}>{group.name}</h3>
          {group.private && (
            <span style={{ fontSize: 10, backgroundColor: "#fef3c7", color: "#92400e", fontWeight: 700, padding: "2px 7px", borderRadius: 100, flexShrink: 0, marginTop: 1 }}>
              🔒 Privado
            </span>
          )}
        </div>
        <p style={{ fontSize: 12, color: MUTED, margin: "0 0 10px", lineHeight: 1.5 }}>
          {group.description.length > 90 ? group.description.slice(0, 90) + "…" : group.description}
        </p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: MUTED }}>👥 {group.members.toLocaleString("pt-BR")} membros</span>
            <span style={{ fontSize: 10, backgroundColor: `${group.color}18`, color: group.color, fontWeight: 700, padding: "2px 8px", borderRadius: 100 }}>{group.category}</span>
          </div>
          <button
            onClick={() => setJoined(v => !v)}
            style={{
              fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8,
              border: joined ? `1px solid ${BORDER}` : `1px solid ${GOLD}50`,
              backgroundColor: joined ? "#f5f5f0" : `${GOLD}15`,
              color: joined ? MUTED : GOLD,
              cursor: "pointer",
            }}
          >
            {joined ? "Membro" : "Participar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GruposPage() {
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [search, setSearch] = useState("");

  const filtered = SAMPLE_GROUPS.filter(g => {
    const matchesCategory = activeCategory === "Todos" || g.category === activeCategory;
    const matchesSearch   = !search || g.name.toLowerCase().includes(search.toLowerCase()) || g.description.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <AppShell>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: NAVY, margin: "0 0 4px" }}>Grupos</h1>
            <p style={{ fontSize: 14, color: MUTED, margin: 0 }}>Comunidades de profissionais do vinho</p>
          </div>
          <button style={{
            backgroundColor: GOLD, color: NAVY, fontWeight: 800, fontSize: 13,
            border: "none", borderRadius: 10, padding: "10px 18px", cursor: "pointer",
          }}>
            + Criar grupo
          </button>
        </div>

        {/* Search */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
          <svg width="16" height="16" fill="none" stroke={MUTED} strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar grupos..."
            style={{ border: "none", outline: "none", fontSize: 14, flex: 1, fontFamily: "inherit" }}
          />
        </div>

        {/* Category tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, overflowX: "auto", paddingBottom: 4 }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: "6px 16px", borderRadius: 20, fontSize: 13, fontWeight: activeCategory === cat ? 700 : 500,
                border: `1px solid ${activeCategory === cat ? GOLD : BORDER}`,
                backgroundColor: activeCategory === cat ? GOLD : WHITE,
                color: activeCategory === cat ? "#fff" : MUTED,
                cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Groups grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
          {filtered.map(g => <GroupCard key={g.id} group={g} />)}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: MUTED }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <p style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>Nenhum grupo encontrado</p>
            <p style={{ fontSize: 13 }}>Tente outra busca ou categoria</p>
          </div>
        )}

        {/* Coming soon notice */}
        <div style={{ marginTop: 24, backgroundColor: `${GOLD}10`, border: `1px dashed ${GOLD}60`, borderRadius: 12, padding: "14px 18px", fontSize: 13, color: "#92400e", textAlign: "center" }}>
          🚀 Os grupos com bate-papo em tempo real estão em desenvolvimento. Em breve você poderá criar e interagir com grupos!
        </div>
      </div>
    </AppShell>
  );
}
