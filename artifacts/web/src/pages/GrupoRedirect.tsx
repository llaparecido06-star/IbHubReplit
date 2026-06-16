import { useEffect, useState } from "react";
import { useParams } from "wouter";

const NAVY  = "#0d1b2a";
const GOLD  = "#c9a84c";

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.ibhub.app";
const APP_STORE_URL  = "https://apps.apple.com/br/app/ibhub/id6744803404";

function getOS(): "ios" | "android" | "desktop" {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua))          return "android";
  return "desktop";
}

export default function GrupoRedirect() {
  const { id } = useParams<{ id: string }>();
  const [phase] = useState<"opening" | "fallback">("opening");

  useEffect(() => {
    if (!id) return;
    // Always open the web version — app not yet available in stores
    window.location.replace(`/app/grupos/${id}`);
  }, [id]);

  const os = getOS();
  const storeUrl  = os === "ios" ? APP_STORE_URL : PLAY_STORE_URL;
  const storeName = os === "ios" ? "App Store" : "Google Play";
  const storeIcon = os === "ios"
    ? (
      <svg viewBox="0 0 24 24" fill="currentColor" width={18} height={18}>
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
      </svg>
    )
    : (
      <svg viewBox="0 0 24 24" fill="currentColor" width={18} height={18}>
        <path d="M3.18 23.76c.33.19.71.2 1.06.04L13.9 12 4.24.2C3.89.04 3.51.05 3.18.24 2.51.62 2.1 1.3 2.1 2.08v19.84c0 .78.41 1.46 1.08 1.84zm15.76-9.93-2.45-1.41-2.74 2.74 2.74 2.74 2.48-1.43c.7-.4 1.13-1.13 1.13-1.91s-.43-1.5-1.16-1.73zM5.08 1.29l10.03 10.03-2.83 2.83L5.08 1.29zm0 21.42 7.2-7.2 2.83 2.83L5.08 22.71z"/>
      </svg>
    );

  const containerStyle: React.CSSProperties = {
    minHeight: "100dvh",
    backgroundColor: NAVY,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    fontFamily: "'Inter', sans-serif",
    color: "#fff",
  };

  const logoStyle: React.CSSProperties = {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: GOLD,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    fontSize: 32,
    fontWeight: 700,
    color: NAVY,
    letterSpacing: -1,
  };

  if (phase === "opening") {
    return (
      <div style={containerStyle}>
        <div style={logoStyle}>ib</div>
        <div style={{ marginBottom: 16 }}>
          <div style={{
            width: 36, height: 36,
            border: `3px solid rgba(201,168,76,0.3)`,
            borderTopColor: GOLD,
            borderRadius: "50%",
            animation: "spin 0.9s linear infinite",
          }} />
          <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
        </div>
        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.75)", margin: 0 }}>
          Abrindo o ibhub…
        </p>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={logoStyle}>ib</div>

      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, textAlign: "center" }}>
        Instale o ibhub
      </h1>
      <p style={{ fontSize: 15, color: "rgba(255,255,255,0.65)", textAlign: "center", maxWidth: 300, marginBottom: 32, lineHeight: 1.5 }}>
        Para entrar no grupo, baixe o aplicativo ibhub na {storeName}.
      </p>

      <a
        href={storeUrl}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          backgroundColor: GOLD,
          color: NAVY,
          textDecoration: "none",
          fontWeight: 700,
          fontSize: 15,
          padding: "14px 28px",
          borderRadius: 12,
          marginBottom: 16,
        }}
      >
        {storeIcon}
        Baixar na {storeName}
      </a>

      <a
        href={`/app/grupos/${id}`}
        style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", textDecoration: "underline" }}
      >
        Continuar na versão web
      </a>
    </div>
  );
}
