import React, { useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { supabase } from "@/lib/supabase";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";

interface FeatureFlag {
  key: string;
  label: string;
  description: string;
  icon: string;
  iconBg: string;
  iconColor: string;
}

const FLAGS: FeatureFlag[] = [
  { key: "enquetes",   label: "Habilitar Enquetes",            description: "Permite a criação de novos posts do tipo Enquete.",                        icon: "📊", iconBg: "#fef9ee", iconColor: GOLD },
  { key: "stories",    label: "Habilitar Stories (Momentos)",  description: "Se ativo, a barra de Stories aparecerá no topo do feed para todos os usuários.", icon: "🎬", iconBg: "#fef9ee", iconColor: GOLD },
  { key: "manutencao", label: "Modo Manutenção",               description: 'Bloqueia o acesso ao app exibindo uma tela de manutenção.',                  icon: "⚠️", iconBg: "#f3f4f6", iconColor: "#6b7280" },
];

export default function AdminConfiguracoes() {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchFlags = async () => {
    setLoading(true);
    setLoadError(null);
    const keys = FLAGS.map((f) => f.key);
    const { data, error } = await supabase.from("feature_flags").select("key, enabled").in("key", keys);
    if (error) {
      setLoadError("Erro ao carregar flags: " + error.message);
    } else if (data) {
      const map: Record<string, boolean> = {};
      for (const f of FLAGS) {
        const found = (data as Array<{ key: string; enabled: boolean }>).find((d) => d.key === f.key);
        map[f.key] = found ? found.enabled : false;
      }
      setFlags(map);
    }
    setLoading(false);
  };

  useEffect(() => { void fetchFlags(); }, []);

  const toggle = async (key: string) => {
    const newVal = !flags[key];
    setFlags((prev) => ({ ...prev, [key]: newVal }));
    setToggling(key);
    const { error } = await supabase.from("feature_flags").upsert(
      { key, enabled: newVal, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
    if (error) {
      setFlags((prev) => ({ ...prev, [key]: !newVal }));
    }
    setToggling(null);
  };

  return (
    <AdminShell>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <span style={{ fontSize: 22, color: GOLD }}>⚙</span>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, margin: 0 }}>Configurações do Sistema</h1>
        </div>
        <p style={{ fontSize: 14, color: "#8a93a2", margin: "0 0 28px" }}>
          Gerencie funcionalidades globais do aplicativo sem precisar atualizar o código.
        </p>

        <div style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 22, marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: NAVY, marginBottom: 4 }}>Gestão de Funcionalidades (Feature Flags)</div>
          <p style={{ fontSize: 13, color: "#8a93a2", margin: "0 0 20px" }}>
            Ligue ou desligue módulos inteiros do aplicativo globalmente. As alterações são aplicadas imediatamente para todos os usuários.
          </p>

          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "#aaa" }}>⏳ Carregando...</div>
          ) : loadError ? (
            <div style={{ padding: 14, backgroundColor: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, color: "#dc2626", fontSize: 13 }}>{loadError}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {FLAGS.map((flag, i) => (
                <div
                  key={flag.key}
                  style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "18px 0", borderTop: i > 0 ? "1px solid #e8eaed" : "none" }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 11, backgroundColor: flag.iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0, marginTop: 2 }}>
                    {flag.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: NAVY, marginBottom: 4 }}>{flag.label}</div>
                    <div style={{ fontSize: 12, color: "#8a93a2", lineHeight: 1.5 }}>{flag.description}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    {toggling === flag.key ? (
                      <div style={{ width: 44, height: 24, backgroundColor: "#e8eaed", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: 10, color: "#aaa" }}>...</span>
                      </div>
                    ) : (
                      <>
                        <div
                          onClick={() => toggle(flag.key)}
                          style={{
                            width: 44,
                            height: 24,
                            borderRadius: 12,
                            backgroundColor: flags[flag.key] ? NAVY : "#d1d5db",
                            cursor: "pointer",
                            position: "relative",
                            transition: "background 0.2s",
                          }}
                        >
                          <div style={{
                            position: "absolute",
                            top: 2,
                            left: flags[flag.key] ? 22 : 2,
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            backgroundColor: "#fff",
                            transition: "left 0.2s",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                          }} />
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: flags[flag.key] ? NAVY : "#9ca3af" }}>
                          {flags[flag.key] ? "ON" : "OFF"}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 22 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: NAVY, marginBottom: 14 }}>ℹ Informações</div>
          {[
            { bold: "Feature Flags", text: "permitem controlar funcionalidades sem deploy." },
            { bold: "Modo Manutenção", text: 'exibe uma tela de "Voltamos já" para todos os usuários não-admin.' },
            { bold: "Alterações", text: "são instantâneas e afetam todos os usuários ativos." },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 10 }}>
              <span style={{ color: "#555", marginTop: 1 }}>•</span>
              <span style={{ fontSize: 13, color: "#555", lineHeight: 1.5 }}>
                <strong>{item.bold}</strong> {item.text}
              </span>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
