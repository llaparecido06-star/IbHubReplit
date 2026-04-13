import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import {
  WineEntry,
  fetchWineCellar,
  addWineEntry,
  deleteWineEntry,
  updateWineEntry,
} from "@/services/api";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";

type FilterKey = "todos" | "adega" | "consumido" | "presenteado" | "wishlist";
type WineStatus = "adega" | "consumido" | "presenteado" | "wishlist";

const FILTER_OPTIONS = [
  { key: "todos" as FilterKey, label: "Todos" },
  { key: "adega" as FilterKey, label: "Na Adega" },
  { key: "consumido" as FilterKey, label: "Consumido" },
  { key: "presenteado" as FilterKey, label: "Presenteado" },
  { key: "wishlist" as FilterKey, label: "Wishlist" },
];

const STATUS_OPTIONS: { key: WineStatus; label: string }[] = [
  { key: "adega", label: "Na Adega" },
  { key: "consumido", label: "Consumido" },
  { key: "presenteado", label: "Presenteado" },
  { key: "wishlist", label: "Wishlist" },
];

const statusColors: Record<WineStatus, { bg: string; color: string }> = {
  adega: { bg: `${GOLD}18`, color: GOLD },
  consumido: { bg: "#f2f3f5", color: "#8a93a2" },
  presenteado: { bg: "#f0fdf4", color: "#16a34a" },
  wishlist: { bg: "#fff7ed", color: "#f59e0b" },
};

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span
          key={s}
          onClick={() => onChange(s)}
          style={{ fontSize: 22, cursor: "pointer", color: s <= value ? GOLD : "#e8eaed" }}
        >★</span>
      ))}
    </div>
  );
}

const emptyForm = () => ({
  name: "",
  producer: "",
  vintage: "",
  region: "",
  country: "",
  grape: "",
  qty: "1",
  price: "",
  buy_date: "",
  drink_by: "",
  storage: "",
  notes: "",
  rating: 0,
  status: "adega" as WineStatus,
  is_private: true,
});

export default function AdegaPage() {
  const { user } = useAuth();

  const [wines, setWines] = useState<WineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("todos");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingWine, setEditingWine] = useState<WineEntry | null>(null);
  const [form, setForm] = useState(emptyForm());

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const data = await fetchWineCellar(user.id);
    setWines(data);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const parseDateBR = (str: string): string | null => {
    if (!str.trim()) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(str.trim())) return str.trim();
    const parts = str.trim().split("/");
    if (parts.length === 3) {
      const [d, m, y] = parts;
      if (d && m && y && y.length === 4) return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    return null;
  };

  const handleAdd = async () => {
    if (!form.name.trim()) { alert("Informe o nome do vinho."); return; }
    if (!user?.id) return;

    const buyDate = parseDateBR(form.buy_date);
    const drinkBy = parseDateBR(form.drink_by);

    if (form.buy_date.trim() && !buyDate) { alert("Data de compra inválida. Use dd/mm/aaaa."); return; }
    if (form.drink_by.trim() && !drinkBy) { alert("'Beber até' inválido. Use dd/mm/aaaa."); return; }

    setSaving(true);
    const entry = await addWineEntry({
      user_id: user.id,
      name: form.name.trim(),
      producer: form.producer.trim() || null,
      vintage: form.vintage.trim() || null,
      region: form.region.trim() || null,
      country: form.country.trim() || null,
      grape: form.grape.trim() || null,
      qty: Math.max(1, parseInt(form.qty) || 1),
      price: form.price.trim() ? parseFloat(form.price.replace(",", ".")) : null,
      buy_date: buyDate,
      drink_by: drinkBy,
      storage: form.storage.trim() || null,
      notes: form.notes.trim() || null,
      rating: form.rating,
      status: form.status,
      is_private: form.is_private,
    });
    setSaving(false);

    if (entry) {
      setWines((prev) => [entry, ...prev]);
      setForm(emptyForm());
      setShowForm(false);
    } else {
      alert("Não foi possível salvar o vinho. Tente novamente.");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remover "${name}" da adega?`)) return;
    const ok = await deleteWineEntry(id);
    if (ok) setWines((prev) => prev.filter((w) => w.id !== id));
  };

  const startEdit = (wine: WineEntry) => {
    setEditingWine(wine);
    setForm({
      name: wine.name,
      producer: wine.producer ?? "",
      vintage: wine.vintage ?? "",
      region: wine.region ?? "",
      country: wine.country ?? "",
      grape: wine.grape ?? "",
      qty: String(wine.qty),
      price: wine.price != null ? String(wine.price) : "",
      buy_date: wine.buy_date ? wine.buy_date.split("T")[0] : "",
      drink_by: wine.drink_by ? wine.drink_by.split("T")[0] : "",
      storage: wine.storage ?? "",
      notes: wine.notes ?? "",
      rating: wine.rating,
      status: wine.status as WineStatus,
      is_private: wine.is_private,
    });
    setShowForm(true);
  };

  const handleUpdate = async () => {
    if (!editingWine || !form.name.trim()) { alert("Informe o nome do vinho."); return; }

    const buyDate = parseDateBR(form.buy_date);
    const drinkBy = parseDateBR(form.drink_by);

    if (form.buy_date.trim() && !buyDate) { alert("Data de compra inválida. Use dd/mm/aaaa."); return; }
    if (form.drink_by.trim() && !drinkBy) { alert("'Beber até' inválido. Use dd/mm/aaaa."); return; }

    setSaving(true);
    const patch: Partial<WineEntry> = {
      name: form.name.trim(),
      producer: form.producer.trim() || null,
      vintage: form.vintage.trim() || null,
      region: form.region.trim() || null,
      country: form.country.trim() || null,
      grape: form.grape.trim() || null,
      qty: Math.max(1, parseInt(form.qty) || 1),
      price: form.price.trim() ? parseFloat(form.price.replace(",", ".")) : null,
      buy_date: buyDate,
      drink_by: drinkBy,
      storage: form.storage.trim() || null,
      notes: form.notes.trim() || null,
      rating: form.rating,
      status: form.status,
      is_private: form.is_private,
    };
    const ok = await updateWineEntry(editingWine.id, patch);
    setSaving(false);
    if (ok) {
      setWines((prev) => prev.map((w) => w.id === editingWine.id ? { ...w, ...patch } : w));
      setEditingWine(null);
      setForm(emptyForm());
      setShowForm(false);
    } else {
      alert("Não foi possível atualizar o vinho. Tente novamente.");
    }
  };

  const closeModal = () => {
    setShowForm(false);
    setEditingWine(null);
    setForm(emptyForm());
  };

  const filtered = wines.filter((w) => {
    if (filter !== "todos" && w.status !== filter) return false;
    if (search && !w.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = {
    adega: wines.filter((w) => w.status === "adega").length,
    consumido: wines.filter((w) => w.status === "consumido").length,
    wishlist: wines.filter((w) => w.status === "wishlist").length,
  };

  const cellarValue = wines
    .filter((w) => w.status === "adega" && w.price != null)
    .reduce((sum, w) => sum + (w.price ?? 0) * w.qty, 0);

  const winesNearWindow = wines.filter((w) => {
    if (!w.drink_by || w.status !== "adega") return false;
    const diff = Math.ceil((new Date(w.drink_by).getTime() - Date.now()) / 86400000);
    return diff >= 0 && diff <= 30;
  });

  return (
    <AppShell>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, margin: 0 }}>🍷 Adega</h1>
            <p style={{ fontSize: 14, color: "#8a93a2", margin: "4px 0 0" }}>Gerencie seu inventário de vinhos</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "10px 20px",
              backgroundColor: GOLD,
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >+ Adicionar</button>
        </div>

        {/* KPI row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 16 }}>
          {[
            { icon: "🍷", label: "Na Adega", val: counts.adega, color: GOLD },
            { icon: "☕", label: "Consumidos", val: counts.consumido, color: "#8a93a2" },
            { icon: "⭐", label: "Wishlist", val: counts.wishlist, color: "#f59e0b" },
          ].map((k) => (
            <div key={k.label} style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 18, textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 4 }}>{k.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: k.color }}>{k.val}</div>
              <div style={{ fontSize: 12, color: "#8a93a2" }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Banners */}
        {cellarValue > 0 && (
          <div style={{ backgroundColor: `${GOLD}14`, border: `1px solid ${GOLD}40`, borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span>📈</span>
            <span style={{ fontSize: 14, color: NAVY }}>
              Valor estimado da adega: <strong style={{ color: GOLD }}>R$ {cellarValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            </span>
          </div>
        )}
        {winesNearWindow.length > 0 && (
          <div style={{ backgroundColor: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span>⏰</span>
            <span style={{ fontSize: 14, color: "#b45309" }}>
              {winesNearWindow.length === 1
                ? `"${winesNearWindow[0].name}" está na janela ideal de consumo!`
                : `${winesNearWindow.length} vinhos na janela ideal de consumo — hora de abrir!`}
            </span>
          </div>
        )}

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 12 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}>🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar vinhos..."
            style={{
              width: "100%",
              padding: "10px 12px 10px 38px",
              border: "1px solid #e8eaed",
              borderRadius: 10,
              fontSize: 14,
              backgroundColor: "#fff",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Filter chips */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          {FILTER_OPTIONS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                border: `1px solid ${filter === f.key ? GOLD : "#e8eaed"}`,
                backgroundColor: filter === f.key ? GOLD : "#fff",
                color: filter === f.key ? "#fff" : "#555",
                fontSize: 12,
                fontWeight: filter === f.key ? 700 : 500,
                cursor: "pointer",
              }}
            >{f.label}</button>
          ))}
        </div>

        {/* Wine list */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60 }}>⏳ Carregando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, backgroundColor: "#fff", borderRadius: 14, border: "1px solid #e8eaed" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🍷</div>
            <h3 style={{ color: NAVY, margin: "0 0 8px" }}>Sua adega está vazia</h3>
            <button
              onClick={() => setShowForm(true)}
              style={{ padding: "10px 24px", backgroundColor: GOLD, color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}
            >+ Adicionar primeiro vinho</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filtered.map((wine) => {
              const sc = statusColors[wine.status];
              const nearWindow = wine.drink_by && wine.status === "adega" && (() => {
                const diff = Math.ceil((new Date(wine.drink_by!).getTime() - Date.now()) / 86400000);
                return diff >= 0 && diff <= 30;
              })();

              return (
                <div
                  key={wine.id}
                  style={{
                    backgroundColor: "#fff",
                    border: `1px solid ${nearWindow ? "#fbbf24" : "#e8eaed"}`,
                    borderRadius: 14,
                    padding: 18,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: NAVY, margin: 0 }}>{wine.name}</h3>
                        <span style={{ backgroundColor: sc.bg, color: sc.color, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6 }}>
                          {STATUS_OPTIONS.find((s) => s.key === wine.status)?.label}
                        </span>
                        {wine.is_private && <span style={{ fontSize: 11, color: "#aaa" }}>🔒</span>}
                      </div>
                      {wine.producer && (
                        <p style={{ fontSize: 13, color: "#8a93a2", margin: "0 0 4px" }}>
                          {wine.producer}{wine.vintage ? ` · ${wine.vintage}` : ""}
                        </p>
                      )}
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 13, color: "#8a93a2" }}>
                        {wine.region && <span>📍 {wine.region}</span>}
                        <span>📦 {wine.qty}x</span>
                        {wine.price != null && <span style={{ color: GOLD, fontWeight: 700 }}>R$ {Number(wine.price).toFixed(2)}</span>}
                        {wine.drink_by && <span>⏰ Beber até: {new Date(wine.drink_by).toLocaleDateString("pt-BR")}</span>}
                      </div>
                      {wine.rating > 0 && (
                        <div style={{ display: "flex", gap: 2, marginTop: 6 }}>
                          {[1,2,3,4,5].map((s) => (
                            <span key={s} style={{ color: s <= wine.rating ? GOLD : "#e8eaed", fontSize: 14 }}>★</span>
                          ))}
                        </div>
                      )}
                      {wine.notes && (
                        <p style={{ fontSize: 12, color: "#aaa", margin: "6px 0 0", fontStyle: "italic" }}>"{wine.notes}"</p>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 12 }}>
                      <button
                        onClick={() => startEdit(wine)}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, color: "#8a93a2" }}
                        title="Editar"
                      >✏️</button>
                      <button
                        onClick={() => handleDelete(wine.id, wine.name)}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, color: "#ccc" }}
                        title="Remover"
                      >🗑️</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Wine Modal */}
      {showForm && (
        <div
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={closeModal}
        >
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "22px 22px 0 0",
              width: "100%",
              maxWidth: 700,
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "24px 28px", borderBottom: "1px solid #e8eaed", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, backgroundColor: "#fff" }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: NAVY }}>{editingWine ? "Editar Vinho" : "Adicionar Vinho"}</h2>
              <button onClick={closeModal} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#aaa" }}>✕</button>
            </div>
            <div style={{ padding: "24px 28px 40px", display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nome do vinho *"
                style={inputStyle}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <input value={form.producer} onChange={(e) => setForm((f) => ({ ...f, producer: e.target.value }))} placeholder="Produtor" style={inputStyle} />
                <input value={form.vintage} onChange={(e) => setForm((f) => ({ ...f, vintage: e.target.value }))} placeholder="Safra" style={inputStyle} type="number" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <input value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} placeholder="Região" style={inputStyle} />
                <input value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} placeholder="País" style={inputStyle} />
              </div>
              <input value={form.grape} onChange={(e) => setForm((f) => ({ ...f, grape: e.target.value }))} placeholder="Uva/Casta" style={inputStyle} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <input value={form.qty} onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))} placeholder="Quantidade" type="number" style={inputStyle} />
                <input value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="Preço de compra (R$)" style={inputStyle} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#8a93a2", display: "block", marginBottom: 4 }}>Data de compra</label>
                  <input value={form.buy_date} onChange={(e) => setForm((f) => ({ ...f, buy_date: e.target.value }))} placeholder="dd/mm/aaaa" style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#8a93a2", display: "block", marginBottom: 4 }}>Beber até</label>
                  <input value={form.drink_by} onChange={(e) => setForm((f) => ({ ...f, drink_by: e.target.value }))} placeholder="dd/mm/aaaa" style={inputStyle} />
                </div>
              </div>
              <input value={form.storage} onChange={(e) => setForm((f) => ({ ...f, storage: e.target.value }))} placeholder="Local de armazenamento" style={inputStyle} />
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Notas de degustação"
                rows={3}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
              />

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: "block", marginBottom: 8 }}>Avaliação:</label>
                <StarRating value={form.rating} onChange={(v) => setForm((f) => ({ ...f, rating: v }))} />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: "block", marginBottom: 8 }}>Status:</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => setForm((f) => ({ ...f, status: s.key }))}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 20,
                        border: `1px solid ${form.status === s.key ? GOLD : "#e8eaed"}`,
                        backgroundColor: form.status === s.key ? GOLD : "#fff",
                        color: form.status === s.key ? "#fff" : "#555",
                        fontSize: 13,
                        fontWeight: form.status === s.key ? 700 : 500,
                        cursor: "pointer",
                      }}
                    >{s.label}</button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setForm((f) => ({ ...f, is_private: !f.is_private }))}
                style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#555" }}
              >
                {form.is_private ? "🔒" : "👁️"}
                {form.is_private ? "Apenas para você" : "Visível para conexões"}
              </button>

              <button
                onClick={editingWine ? handleUpdate : handleAdd}
                disabled={saving}
                style={{
                  padding: "14px 0",
                  backgroundColor: saving ? "#ccc" : GOLD,
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  fontSize: 15,
                  fontWeight: 800,
                  cursor: "pointer",
                  marginTop: 8,
                }}
              >{saving ? "Salvando..." : editingWine ? "✓ Atualizar Vinho" : "✓ Salvar Vinho"}</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  border: "1px solid #e8eaed",
  borderRadius: 10,
  fontSize: 14,
  outline: "none",
  backgroundColor: "#fff",
  boxSizing: "border-box",
  fontFamily: "inherit",
};
