import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionsContext";
import { fetchWebCompanyPages, type WebCompanyPage } from "@/services/api";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const WHITE  = "#ffffff";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";
const BG     = "#f5f5f0";

function CompanyAvatar({ page, size = 52 }: { page: WebCompanyPage; size?: number }) {
  const [err, setErr] = useState(false);
  if (page.avatar_url && !err) {
    return (
      <img
        src={page.avatar_url}
        alt={page.name}
        onError={() => setErr(true)}
        style={{ width: size, height: size, borderRadius: 12, objectFit: "cover", flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: 12,
      backgroundColor: GOLD + "20",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.42, fontWeight: 900, color: GOLD, flexShrink: 0,
    }}>
      {(page.name?.[0] ?? "E").toUpperCase()}
    </div>
  );
}

export default function MinhasEmpresasPage() {
  const [, setLocation] = useLocation();
  const { profile } = useAuth();
  const { hasFeature } = usePermissions();
  const canCreateEmpresa = hasFeature("Criar Página Empresa");

  const [pages, setPages] = useState<WebCompanyPage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    fetchWebCompanyPages(profile.id)
      .then(setPages)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [profile?.id]);

  return (
    <AppShell>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "16px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: NAVY, margin: "8px 0 4px" }}>Minhas Empresas</h1>
            <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
              {pages.length > 0
                ? `${pages.length} página${pages.length > 1 ? "s" : ""} empresarial${pages.length > 1 ? "is" : ""}`
                : "Gerencie suas páginas empresariais"}
            </p>
          </div>
          {canCreateEmpresa && (
            <button
              onClick={() => setLocation("/app/criar-empresa")}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "10px 18px", borderRadius: 10,
                backgroundColor: GOLD, border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 700, color: NAVY, fontFamily: "inherit",
                boxShadow: "0 2px 8px rgba(201,168,76,0.35)",
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              <span style={{ fontSize: 16, fontWeight: 900 }}>+</span>
              Nova Empresa
            </button>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              border: `3px solid ${GOLD}30`, borderTopColor: GOLD,
              animation: "spin 0.8s linear infinite",
            }} />
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Empty state */}
        {!loading && pages.length === 0 && (
          <div style={{
            backgroundColor: WHITE, borderRadius: 16, border: `1px solid ${BORDER}`,
            padding: "48px 24px", textAlign: "center",
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏢</div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: NAVY, margin: "0 0 8px" }}>
              Nenhuma página empresarial ainda
            </h2>
            <p style={{ fontSize: 14, color: MUTED, margin: "0 0 24px", lineHeight: 1.5 }}>
              Crie a presença digital da sua empresa na maior rede do vinho.
              Conecte-se com profissionais, divulgue produtos e muito mais.
            </p>
            {canCreateEmpresa ? (
              <button
                onClick={() => setLocation("/app/criar-empresa")}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "12px 28px", borderRadius: 10,
                  backgroundColor: GOLD, border: "none", cursor: "pointer",
                  fontSize: 14, fontWeight: 700, color: NAVY, fontFamily: "inherit",
                  boxShadow: "0 2px 12px rgba(201,168,76,0.4)",
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >
                <span style={{ fontSize: 18, fontWeight: 900 }}>+</span>
                Criar minha primeira página
              </button>
            ) : (
              <button
                onClick={() => setLocation("/comunidade-exclusiva")}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "12px 28px", borderRadius: 10,
                  border: `1.5px solid ${GOLD}`, backgroundColor: "transparent",
                  cursor: "pointer", fontSize: 14, fontWeight: 700, color: GOLD,
                  fontFamily: "inherit",
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = GOLD + "12")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                🔒 Fazer upgrade para criar páginas
              </button>
            )}
          </div>
        )}

        {/* Company cards */}
        {!loading && pages.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {pages.map((page) => (
              <div
                key={page.id}
                style={{
                  backgroundColor: WHITE, borderRadius: 14, border: `1px solid ${BORDER}`,
                  padding: "16px 18px",
                  display: "flex", alignItems: "center", gap: 16,
                  transition: "box-shadow 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)")}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
              >
                <CompanyAvatar page={page} size={52} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {page.name}
                  </div>
                  {page.industry ? (
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {page.industry}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: MUTED + "80", marginTop: 2, fontStyle: "italic" }}>
                      Setor não informado
                    </div>
                  )}
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    marginTop: 6, padding: "2px 8px", borderRadius: 20,
                    backgroundColor: GOLD + "15", border: `1px solid ${GOLD}40`,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: GOLD, display: "inline-block" }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: GOLD, letterSpacing: 0.4 }}>PÁGINA ATIVA</span>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => setLocation(`/app/empresa/${page.id}`)}
                    title="Ver perfil"
                    style={{
                      padding: "8px 14px", borderRadius: 8, border: `1px solid ${BORDER}`,
                      backgroundColor: BG, cursor: "pointer",
                      fontSize: 12, fontWeight: 600, color: NAVY, fontFamily: "inherit",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = BORDER)}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = BG)}
                  >
                    Ver Perfil
                  </button>
                  <button
                    onClick={() => setLocation(`/app/empresa/${page.id}/editar`)}
                    title="Editar página"
                    style={{
                      padding: "8px 14px", borderRadius: 8, border: `1px solid ${GOLD}60`,
                      backgroundColor: GOLD + "12", cursor: "pointer",
                      fontSize: 12, fontWeight: 700, color: GOLD, fontFamily: "inherit",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = GOLD + "25")}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = GOLD + "12")}
                  >
                    Editar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upgrade nudge for users without company feature */}
        {!loading && !canCreateEmpresa && pages.length === 0 && null}

      </div>
    </AppShell>
  );
}
