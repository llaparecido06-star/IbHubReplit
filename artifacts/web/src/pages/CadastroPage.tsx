import { useState, useCallback, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

const TOTAL_STEPS = 3;

const AREAS = [
  "Sommelier", "Comprador", "Importador", "Produtor",
  "Enólogo", "Consultor", "Investidor", "Entusiasta", "Outros",
];

const PLANS = [
  {
    key: "basico",
    name: "Básico",
    price: "GRÁTIS",
    subtitle: "Para iniciantes",
    popular: false,
    features: ["Perfil básico", "Feed de publicações", "5 conexões/mês"],
  },
  {
    key: "premium",
    name: "Premium",
    price: "R$ 149/mês",
    subtitle: "Para profissionais",
    popular: true,
    features: ["Tudo do Básico", "Conexões ilimitadas", "Mercado", "Dados de mercado"],
  },
  {
    key: "exclusive",
    name: "Exclusive",
    price: "R$ 299/mês",
    subtitle: "Para especialistas",
    popular: false,
    features: ["Tudo do Premium", "Inteligência de mercado", "Apresentações exclusivas", "Destaque no feed"],
  },
  {
    key: "business",
    name: "Business",
    price: "R$ 499/mês",
    subtitle: "Para empresas",
    popular: false,
    features: ["Tudo do Exclusive", "Página empresarial", "Vagas de emprego", "Suporte prioritário"],
  },
];

type ValidationState = "idle" | "checking" | "available" | "taken" | "invalid";

const USERNAME_RE = /^[a-zA-Z0-9._]{3,}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validationHint(field: "username" | "email", state: ValidationState): string | null {
  if (field === "username") {
    if (state === "available") return "✓ Username disponível";
    if (state === "taken") return "✗ Username já está em uso";
    if (state === "invalid") return "✗ Apenas letras, números, . e _ (mín. 3 chars)";
  }
  if (field === "email") {
    if (state === "available") return "✓ E-mail disponível";
    if (state === "taken") return "✗ Este e-mail já está cadastrado";
    if (state === "invalid") return "✗ Formato de e-mail inválido";
  }
  return null;
}

function hintColor(state: ValidationState): string {
  if (state === "available") return "#2ecc71";
  if (state === "taken" || state === "invalid") return "#e74c3c";
  return "#8a93a2";
}

export default function CadastroPage() {
  const { signUp, refreshProfileByUserId } = useAuth();
  const [, setLocation] = useLocation();

  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  const [usernameState, setUsernameState] = useState<ValidationState>("idle");
  const [emailState, setEmailState] = useState<ValidationState>("idle");

  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");

  const [selectedPlan, setSelectedPlan] = useState("basico");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("Criando conta...");
  const [error, setError] = useState<string | null>(null);

  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emailTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkUsername = useCallback(async (value: string) => {
    if (!value) { setUsernameState("idle"); return; }
    if (!USERNAME_RE.test(value)) { setUsernameState("invalid"); return; }
    setUsernameState("checking");
    try {
      const { data } = await supabase
        .from("profiles").select("id")
        .eq("username", value.toLowerCase()).maybeSingle();
      setUsernameState(data ? "taken" : "available");
    } catch { setUsernameState("idle"); }
  }, []);

  const checkEmail = useCallback(async (value: string) => {
    if (!value) { setEmailState("idle"); return; }
    if (!EMAIL_RE.test(value)) { setEmailState("invalid"); return; }
    setEmailState("checking");
    try {
      const { data } = await supabase
        .from("profiles").select("id")
        .eq("email", value.toLowerCase()).maybeSingle();
      setEmailState(data ? "taken" : "available");
    } catch { setEmailState("available"); }
  }, []);

  const onUsernameChange = (val: string) => {
    setUsername(val);
    setUsernameState(val ? "checking" : "idle");
    if (usernameTimer.current) clearTimeout(usernameTimer.current);
    usernameTimer.current = setTimeout(() => checkUsername(val.trim()), 600);
  };

  const onEmailChange = (val: string) => {
    setEmail(val);
    setEmailState(val ? "checking" : "idle");
    if (emailTimer.current) clearTimeout(emailTimer.current);
    emailTimer.current = setTimeout(() => checkEmail(val.trim()), 600);
  };

  const toggleArea = (area: string) =>
    setSelectedAreas((prev) => prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]);

  const validateStep1 = (): string | null => {
    if (!fullName.trim()) return "Informe seu nome completo";
    if (!username.trim()) return "Informe um username";
    if (usernameState === "invalid") return "Username inválido (mín. 3 chars, use letras, números, . e _)";
    if (usernameState === "taken") return "Esse username já está em uso";
    if (usernameState === "checking") return "Aguarde a verificação do username";
    if (!email.trim()) return "Informe um e-mail";
    if (emailState === "invalid") return "Formato de e-mail inválido";
    if (emailState === "taken") return "Esse e-mail já está cadastrado";
    if (emailState === "checking") return "Aguarde a verificação do e-mail";
    if (!password) return "Informe uma senha";
    if (password.length < 6) return "A senha deve ter no mínimo 6 caracteres";
    if (password !== confirmPassword) return "As senhas não coincidem";
    if (!termsAccepted) return "Aceite os Termos de Uso para continuar";
    if (!ageConfirmed) return "Confirme que você tem 18 anos ou mais";
    return null;
  };

  const validateStep2 = (): string | null => {
    if (selectedAreas.length === 0) return "Selecione ao menos uma área de atuação";
    return null;
  };

  const nextStep = async () => {
    setError(null);
    if (step === 1) {
      const err = validateStep1();
      if (err) { setError(err); return; }
      setStep(2);
    } else if (step === 2) {
      const err = validateStep2();
      if (err) { setError(err); return; }
      setStep(3);
    } else {
      setLoading(true);
      setLoadingMsg("Criando conta...");

      const { error: err } = await signUp(email, password, fullName);
      if (err) { setLoading(false); setError(err); return; }

      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        setLoadingMsg("Finalizando perfil...");
        await supabase.from("profiles").upsert({
          id: currentUser.id,
          username: username.toLowerCase().trim(),
          areas_of_expertise: selectedAreas,
          company: company.trim() || null,
          position: role.trim() || null,
          plan: selectedPlan,
        }, { onConflict: "id" });

        await refreshProfileByUserId(currentUser.id);
      }

      setLoading(false);
      setLocation("/app");
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid #e8eaed",
    backgroundColor: "#f4f5f7",
    fontSize: 15,
    color: "#0d1b2a",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 700,
    color: "#0d1b2a",
    display: "block",
    marginBottom: 6,
  };

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#0d1b2a",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: "#0d1b2a",
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        gap: 12,
      }}>
        <span style={{ fontSize: 22, fontWeight: 900, color: "#c9a84c" }}>ibhub</span>
        <span style={{
          fontSize: 8, fontWeight: 800, color: "#c9a84c",
          backgroundColor: "rgba(201,168,76,0.12)", padding: "2px 7px", borderRadius: 4, letterSpacing: 2.5,
        }}>REDE DO VINHO</span>
      </div>

      {/* Progress */}
      <div style={{ display: "flex", gap: 6, padding: "12px 24px", backgroundColor: "#0d1b2a" }}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 2,
            backgroundColor: i < step ? "#c9a84c" : "rgba(255,255,255,0.12)",
            transition: "background-color 0.3s",
          }} />
        ))}
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "24px 16px 48px",
        backgroundColor: "#f2f3f5",
      }}>
        <div style={{ width: "100%", maxWidth: 520 }}>
          {error && (
            <div style={{
              backgroundColor: "#fdecea", border: "1px solid #f5c6cb",
              borderRadius: 10, padding: "12px 14px", marginBottom: 20,
              fontSize: 14, color: "#c0392b",
            }}>⚠️ {error}</div>
          )}

          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div style={{
                width: 48, height: 48,
                border: "4px solid #e8eaed", borderTopColor: "#c9a84c",
                borderRadius: "50%", margin: "0 auto 20px",
                animation: "spin 1s linear infinite",
              }} />
              <p style={{ fontSize: 16, color: "#0d1b2a", fontWeight: 700 }}>{loadingMsg}</p>
              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : step === 1 ? (
            <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: 28, boxShadow: "0 4px 24px rgba(13,27,42,0.08)" }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0d1b2a", marginBottom: 4 }}>Seus dados pessoais</h2>
              <p style={{ fontSize: 14, color: "#8a93a2", marginBottom: 24 }}>Etapa 1 de 3 — Informações da conta</p>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={labelStyle}>Nome completo</label>
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome completo" style={inputStyle} />
                </div>

                <div>
                  <label style={labelStyle}>Username</label>
                  <input type="text" value={username} onChange={(e) => onUsernameChange(e.target.value)} placeholder="@username" autoCapitalize="none" style={inputStyle} />
                  {validationHint("username", usernameState) && (
                    <p style={{ fontSize: 12, color: hintColor(usernameState), marginTop: 4 }}>
                      {validationHint("username", usernameState)}
                    </p>
                  )}
                </div>

                <div>
                  <label style={labelStyle}>E-mail</label>
                  <input type="email" value={email} onChange={(e) => onEmailChange(e.target.value)} placeholder="seu@email.com" style={inputStyle} />
                  {validationHint("email", emailState) && (
                    <p style={{ fontSize: 12, color: hintColor(emailState), marginTop: 4 }}>
                      {validationHint("email", emailState)}
                    </p>
                  )}
                </div>

                <div>
                  <label style={labelStyle}>Senha</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      style={{ ...inputStyle, paddingRight: 44 }}
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)} style={{
                      position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#8fa3b8",
                    }}>{showPassword ? "🙈" : "👁"}</button>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Confirmar senha</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a senha"
                    style={inputStyle}
                  />
                </div>

                <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                  <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} style={{ marginTop: 2, accentColor: "#c9a84c" }} />
                  <span style={{ fontSize: 13, color: "#0d1b2a", lineHeight: 1.5 }}>
                    Aceito os <a href="#" style={{ color: "#c9a84c", fontWeight: 700 }}>Termos de Uso</a> e a <a href="#" style={{ color: "#c9a84c", fontWeight: 700 }}>Política de Privacidade</a>
                  </span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <input type="checkbox" checked={ageConfirmed} onChange={(e) => setAgeConfirmed(e.target.checked)} style={{ accentColor: "#c9a84c" }} />
                  <span style={{ fontSize: 13, color: "#0d1b2a" }}>Confirmo que tenho 18 anos ou mais</span>
                </label>
              </div>

              <button
                onClick={nextStep}
                style={{
                  marginTop: 24, width: "100%", backgroundColor: "#c9a84c", color: "#0d1b2a",
                  fontWeight: 800, fontSize: 15, padding: "14px", borderRadius: 10, border: "none", cursor: "pointer",
                }}
              >Continuar →</button>

              <div style={{ textAlign: "center", marginTop: 20 }}>
                <span style={{ fontSize: 14, color: "#8a93a2" }}>Já tem conta? </span>
                <Link href="/login" style={{ fontSize: 14, color: "#0d1b2a", fontWeight: 800, textDecoration: "none" }}>Entrar</Link>
              </div>
            </div>
          ) : step === 2 ? (
            <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: 28, boxShadow: "0 4px 24px rgba(13,27,42,0.08)" }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0d1b2a", marginBottom: 4 }}>Sua atuação no vinho</h2>
              <p style={{ fontSize: 14, color: "#8a93a2", marginBottom: 24 }}>Etapa 2 de 3 — Selecione suas áreas</p>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
                {AREAS.map((area) => (
                  <button
                    key={area}
                    onClick={() => toggleArea(area)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 100,
                      border: selectedAreas.includes(area) ? "2px solid #c9a84c" : "2px solid #e8eaed",
                      backgroundColor: selectedAreas.includes(area) ? "#c9a84c" : "#f4f5f7",
                      color: selectedAreas.includes(area) ? "#0d1b2a" : "#8a93a2",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >{area}</button>
                ))}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
                <div>
                  <label style={labelStyle}>Empresa (opcional)</label>
                  <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Nome da empresa" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Cargo (opcional)</label>
                  <input type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Ex: Sommelier, Diretor" style={inputStyle} />
                </div>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button
                  onClick={() => setStep(1)}
                  style={{
                    flex: 1, backgroundColor: "#f4f5f7", color: "#0d1b2a", fontWeight: 700,
                    fontSize: 15, padding: "14px", borderRadius: 10, border: "1px solid #e8eaed", cursor: "pointer",
                  }}
                >← Voltar</button>
                <button
                  onClick={nextStep}
                  style={{
                    flex: 2, backgroundColor: "#c9a84c", color: "#0d1b2a", fontWeight: 800,
                    fontSize: 15, padding: "14px", borderRadius: 10, border: "none", cursor: "pointer",
                  }}
                >Continuar →</button>
              </div>
            </div>
          ) : (
            <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: 28, boxShadow: "0 4px 24px rgba(13,27,42,0.08)" }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0d1b2a", marginBottom: 4 }}>Escolha seu plano</h2>
              <p style={{ fontSize: 14, color: "#8a93a2", marginBottom: 24 }}>Etapa 3 de 3 — Você pode mudar depois</p>

              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                {PLANS.map((plan) => (
                  <label key={plan.key} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "14px 16px",
                    borderRadius: 12,
                    border: selectedPlan === plan.key ? "2px solid #c9a84c" : "2px solid #e8eaed",
                    backgroundColor: selectedPlan === plan.key ? "rgba(201,168,76,0.08)" : "#f4f5f7",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    position: "relative",
                  }}>
                    <input
                      type="radio"
                      name="plan"
                      value={plan.key}
                      checked={selectedPlan === plan.key}
                      onChange={() => setSelectedPlan(plan.key)}
                      style={{ accentColor: "#c9a84c" }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 800, fontSize: 15, color: "#0d1b2a" }}>{plan.name}</span>
                        <span style={{ fontWeight: 800, fontSize: 14, color: "#c9a84c" }}>{plan.price}</span>
                      </div>
                      <span style={{ fontSize: 12, color: "#8a93a2" }}>{plan.subtitle}</span>
                    </div>
                    {plan.popular && (
                      <span style={{
                        position: "absolute", top: -10, right: 12,
                        backgroundColor: "#722f37", color: "#fff",
                        fontSize: 9, fontWeight: 800, padding: "3px 8px",
                        borderRadius: 100, letterSpacing: 1.5,
                      }}>POPULAR</span>
                    )}
                  </label>
                ))}
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button
                  onClick={() => setStep(2)}
                  style={{
                    flex: 1, backgroundColor: "#f4f5f7", color: "#0d1b2a", fontWeight: 700,
                    fontSize: 15, padding: "14px", borderRadius: 10, border: "1px solid #e8eaed", cursor: "pointer",
                  }}
                >← Voltar</button>
                <button
                  onClick={nextStep}
                  style={{
                    flex: 2, backgroundColor: "#c9a84c", color: "#0d1b2a", fontWeight: 800,
                    fontSize: 15, padding: "14px", borderRadius: 10, border: "none", cursor: "pointer",
                  }}
                >Criar minha conta 🍷</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
