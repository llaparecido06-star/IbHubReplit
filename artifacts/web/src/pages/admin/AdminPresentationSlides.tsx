import React, { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { supabase } from "@/lib/supabase";
import { getCachedSession } from "@/lib/supabase";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)
  ?? `${window.location.origin.replace(/:\d+$/, "")}/api`;

interface MarketPresentation {
  id: string;
  title: string;
  icon: string | null;
  is_active: boolean;
  created_at: string;
}

interface Slide {
  id: string;
  presentation_id: string;
  storage_path: string;
  sequence_order: number;
  created_at: string;
}

export default function AdminPresentationSlides() {
  const [presentations, setPresentations] = useState<MarketPresentation[]>([]);
  const [selected, setSelected] = useState<MarketPresentation | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loadingPres, setLoadingPres] = useState(true);
  const [loadingSlides, setLoadingSlides] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showNewPres, setShowNewPres] = useState(false);
  const [newPresTitle, setNewPresTitle] = useState("");
  const [creatingPres, setCreatingPres] = useState(false);

  const loadPresentations = useCallback(async () => {
    setLoadingPres(true);
    const { data } = await supabase.from("market_presentations").select("*").order("created_at", { ascending: false });
    setPresentations((data ?? []) as MarketPresentation[]);
    setLoadingPres(false);
  }, []);

  useEffect(() => { void loadPresentations(); }, [loadPresentations]);

  const selectPresentation = async (p: MarketPresentation) => {
    setSelected(p);
    setLoadingSlides(true);
    const { data } = await supabase.from("slides").select("*").eq("presentation_id", p.id).order("sequence_order", { ascending: true });
    setSlides((data ?? []) as Slide[]);
    setLoadingSlides(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selected || !e.target.files || e.target.files.length === 0) return;
    setUploading(true);
    setUploadMsg(null);
    const file = e.target.files[0];
    const session = await getCachedSession();
    const token = session?.access_token ?? "";

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("presentationId", selected.id);

      const res = await fetch(`${API_BASE}/admin/upload-slide`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (res.ok) {
        setUploadMsg({ type: "success", text: "Slide enviado com sucesso!" });
        await selectPresentation(selected);
      } else {
        const json = await res.json().catch(() => ({})) as { error?: string };
        setUploadMsg({ type: "error", text: json.error ?? "Erro ao enviar slide." });
      }
    } catch {
      setUploadMsg({ type: "error", text: "Erro de conexão ao enviar slide." });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDeleteSlide = async (slide: Slide) => {
    if (!confirm("Remover este slide? Esta ação é irreversível.")) return;
    setDeletingId(slide.id);
    const { error } = await supabase.from("slides").delete().eq("id", slide.id);
    if (!error) {
      setSlides((prev) => prev.filter((s) => s.id !== slide.id));
    } else {
      alert("Erro ao remover slide.");
    }
    setDeletingId(null);
  };

  const handleCreatePresentation = async () => {
    if (!newPresTitle.trim()) return;
    setCreatingPres(true);
    const { error } = await supabase.from("market_presentations").insert({ title: newPresTitle.trim(), is_active: true });
    if (!error) {
      setNewPresTitle("");
      setShowNewPres(false);
      void loadPresentations();
    } else {
      alert("Erro ao criar apresentação: " + error.message);
    }
    setCreatingPres(false);
  };

  const handleTogglePresActive = async (pres: MarketPresentation) => {
    await supabase.from("market_presentations").update({ is_active: !pres.is_active }).eq("id", pres.id);
    void loadPresentations();
  };

  const getSlideUrl = (path: string) => {
    const { data } = supabase.storage.from("slides").getPublicUrl(path);
    return data.publicUrl;
  };

  return (
    <AdminShell>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, margin: "0 0 4px" }}>Slides de Apresentação</h1>
          <p style={{ fontSize: 14, color: "#8a93a2", margin: 0 }}>Gerencie apresentações e seus slides</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 24 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>Apresentações</div>
              <button onClick={() => setShowNewPres(true)} style={{ padding: "5px 12px", backgroundColor: GOLD, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>+ Nova</button>
            </div>

            {showNewPres && (
              <div style={{ marginBottom: 12, padding: 14, backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 10 }}>
                <input value={newPresTitle} onChange={(e) => setNewPresTitle(e.target.value)} placeholder="Nome da apresentação" style={{ width: "100%", padding: "8px 10px", border: "1px solid #e8eaed", borderRadius: 7, fontSize: 13, outline: "none", marginBottom: 10, boxSizing: "border-box" }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setShowNewPres(false)} style={{ flex: 1, padding: "7px", background: "#f3f4f6", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 12 }}>Cancelar</button>
                  <button onClick={handleCreatePresentation} disabled={creatingPres} style={{ flex: 1, padding: "7px", backgroundColor: GOLD, color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>{creatingPres ? "..." : "Criar"}</button>
                </div>
              </div>
            )}

            {loadingPres ? (
              <div style={{ textAlign: "center", padding: 40, color: "#aaa", fontSize: 13 }}>Carregando...</div>
            ) : presentations.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#aaa", fontSize: 13 }}>Nenhuma apresentação.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {presentations.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => selectPresentation(p)}
                    style={{ padding: "12px 14px", backgroundColor: selected?.id === p.id ? `${NAVY}08` : "#fff", border: `1px solid ${selected?.id === p.id ? GOLD + "60" : "#e8eaed"}`, borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                      <div style={{ fontSize: 11, color: p.is_active ? "#059669" : "#aaa", marginTop: 2 }}>{p.is_active ? "Ativo" : "Inativo"}</div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleTogglePresActive(p); }}
                      style={{ fontSize: 11, padding: "3px 8px", backgroundColor: p.is_active ? "#fef2f2" : "#f0fdf4", color: p.is_active ? "#dc2626" : "#16a34a", border: "none", borderRadius: 5, cursor: "pointer", flexShrink: 0 }}
                    >{p.is_active ? "Pausar" : "Ativar"}</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            {!selected ? (
              <div style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 60, textAlign: "center", color: "#aaa" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>⧉</div>
                Selecione uma apresentação para gerenciar seus slides
              </div>
            ) : (
              <div style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>{selected.title}</div>
                    <div style={{ fontSize: 13, color: "#8a93a2" }}>{slides.length} slide{slides.length !== 1 ? "s" : ""}</div>
                  </div>
                  <label style={{ padding: "8px 16px", backgroundColor: GOLD, color: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                    {uploading ? "Enviando..." : "📤 Adicionar Slide"}
                    <input type="file" accept="image/*" onChange={handleFileUpload} disabled={uploading} style={{ display: "none" }} />
                  </label>
                </div>

                {uploadMsg && (
                  <div style={{ marginBottom: 16, padding: "10px 14px", backgroundColor: uploadMsg.type === "success" ? "#f0fdf4" : "#fef2f2", border: `1px solid ${uploadMsg.type === "success" ? "#86efac" : "#fca5a5"}`, borderRadius: 8, fontSize: 13, color: uploadMsg.type === "success" ? "#16a34a" : "#dc2626" }}>
                    {uploadMsg.text}
                  </div>
                )}

                {loadingSlides ? (
                  <div style={{ textAlign: "center", padding: 60, color: "#aaa" }}>⏳ Carregando slides...</div>
                ) : slides.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 60, color: "#aaa" }}>
                    <div style={{ fontSize: 32, marginBottom: 10 }}>📄</div>
                    Nenhum slide. Clique em "Adicionar Slide" para enviar.
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
                    {slides.map((slide, i) => (
                      <div key={slide.id} style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: "1px solid #e8eaed", backgroundColor: "#fafbfc" }}>
                        <img src={getSlideUrl(slide.storage_path)} alt={`Slide ${i + 1}`} style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }} />
                        <div style={{ position: "absolute", top: 6, left: 6, backgroundColor: NAVY, color: GOLD, fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 4 }}>#{i + 1}</div>
                        <div style={{ padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: "#8a93a2" }}>#{slide.sequence_order}</span>
                          <button
                            onClick={() => handleDeleteSlide(slide)}
                            disabled={deletingId === slide.id}
                            style={{ fontSize: 12, color: "#dc2626", background: "#fef2f2", border: "none", borderRadius: 5, cursor: "pointer", padding: "3px 8px" }}
                          >{deletingId === slide.id ? "..." : "🗑"}</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
