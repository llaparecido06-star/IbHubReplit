import { Link } from "wouter";

const navy = "#0d1b2a";
const gold = "#c9a84c";

const SECTIONS = [
  {
    title: "1. Dados que Coletamos",
    body: "Coletamos informações que você nos fornece diretamente ao criar sua conta ou usar nossos serviços: nome completo, endereço de e-mail, telefone, foto de perfil, área de atuação profissional e conteúdo que você publica. Caso você opte por criar sua conta utilizando serviços de terceiros (como Google ou Apple), receberemos as informações básicas do seu perfil público permitidas por essas plataformas, como nome e e-mail. Também coletamos automaticamente dados de uso, como endereço IP, tipo de dispositivo, sistema operacional e páginas visitadas dentro do aplicativo.",
  },
  {
    title: "2. Como Usamos seus Dados",
    body: "Utilizamos seus dados para: (a) fornecer, operar e melhorar o serviço ibhub; (b) personalizar sua experiência e recomendar conexões relevantes; (c) enviar notificações, atualizações e comunicações relacionadas ao serviço; (d) detectar, investigar e prevenir atividades fraudulentas e violações de segurança; (e) cumprir obrigações legais aplicáveis.",
  },
  {
    title: "3. Compartilhamento de Informações",
    body: "Não vendemos suas informações pessoais a terceiros. Podemos compartilhar informações com: prestadores de serviços que nos auxiliam na operação da plataforma (hospedagem, análise, suporte); parceiros comerciais com seu consentimento explícito; autoridades governamentais quando exigido por lei ou ordem judicial. Todos os parceiros estão sujeitos a obrigações de confidencialidade.",
  },
  {
    title: "4. Segurança dos Dados",
    body: "Implementamos medidas técnicas e organizacionais adequadas para proteger seus dados pessoais contra acesso não autorizado, perda acidental ou destruição. Utilizamos criptografia SSL/TLS para transmissão de dados, autenticação segura e controles de acesso rigorosos. Apesar de nossos esforços, nenhum método de transmissão pela internet é 100% seguro.",
  },
  {
    title: "5. Cookies e Tecnologias Similares",
    body: "Utilizamos cookies e tecnologias similares para melhorar sua experiência, analisar o uso do aplicativo e personalizar conteúdo. Você pode controlar o uso de cookies nas configurações do seu dispositivo ou navegador. A desativação de cookies pode limitar algumas funcionalidades do serviço.",
  },
  {
    title: "6. Seus Direitos (LGPD)",
    body: "De acordo com a LGPD, você tem os seguintes direitos: acesso aos seus dados pessoais; correção de dados incompletos, inexatos ou desatualizados; anonimização, bloqueio ou eliminação de dados desnecessários; portabilidade dos dados; eliminação dos dados tratados com seu consentimento; informação sobre com quem compartilhamos seus dados; revogação do consentimento. Para exercer esses direitos, entre em contato pelo e-mail atendimento@idealbi.com.br.",
  },
  {
    title: "7. Contato",
    body: "Para dúvidas, solicitações ou reclamações relacionadas à proteção de dados e privacidade, entre em contato com nosso Encarregado de Dados (DPO) pelo e-mail: atendimento@idealbi.com.br. Respondemos em até 15 dias úteis.",
  },
];

export default function PoliticaPrivacidadePage() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f2f3f5", fontFamily: "'Inter', sans-serif" }}>

      <header style={{
        backgroundColor: navy,
        padding: "16px 24px",
        display: "flex", alignItems: "center", gap: 16,
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <Link href="/">
          <img src="/logo-ibhub-branco.png" alt="ibhub" style={{ height: 32, display: "block" }} />
        </Link>
        <Link href="/" style={{
          fontSize: 13, color: "rgba(255,255,255,0.5)", textDecoration: "none",
          marginLeft: "auto", display: "flex", alignItems: "center", gap: 6,
        }}>
          ← Voltar
        </Link>
      </header>

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "40px 20px 80px" }}>

        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: navy, margin: 0, marginBottom: 8 }}>
            Política de Privacidade
          </h1>
          <p style={{ fontSize: 13, color: "#8a93a2", margin: 0 }}>
            Última atualização: 28 de abril de 2026
          </p>
        </div>

        <div style={{
          backgroundColor: "#fff", borderRadius: 14, border: "1px solid #e8eaf0",
          padding: 24, marginBottom: 20,
        }}>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "#3d4a5c", margin: 0 }}>
            Esta Política de Privacidade descreve como o <strong>ibhub</strong> coleta, usa e protege suas
            informações pessoais ao utilizar nosso aplicativo e plataforma web, em conformidade com a
            Lei Geral de Proteção de Dados (<strong>LGPD — Lei 13.709/2018</strong>).
          </p>
        </div>

        {SECTIONS.map((s, i) => (
          <div key={i} style={{
            backgroundColor: "#fff", borderRadius: 14, border: "1px solid #e8eaf0",
            padding: 24, marginBottom: 12,
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: gold, flexShrink: 0, marginTop: 7 }} />
              <h2 style={{ fontSize: 16, fontWeight: 700, color: navy, margin: 0 }}>{s.title}</h2>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.75, color: "#4a5568", margin: 0 }}>{s.body}</p>
          </div>
        ))}

        <div style={{
          backgroundColor: gold + "18", borderRadius: 14, border: `1px solid ${gold}40`,
          padding: 20, display: "flex", alignItems: "flex-start", gap: 12, marginTop: 8,
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>🛡️</span>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: navy, margin: 0 }}>
            O ibhub está comprometido com a proteção dos seus dados pessoais e com total transparência sobre as práticas de privacidade adotadas.
          </p>
        </div>

      </main>

      <footer style={{
        backgroundColor: "#fff", borderTop: "1px solid #eaeae5",
        padding: "20px 24px", textAlign: "center",
      }}>
        <p style={{ fontSize: 13, color: "#9a9a8e", margin: 0 }}>
          © 2026 ibhub — Rede do Vinho. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
}
