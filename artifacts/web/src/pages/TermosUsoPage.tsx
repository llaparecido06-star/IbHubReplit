import { Link } from "wouter";

const navy = "#0d1b2a";
const gold = "#c9a84c";

const SECTIONS = [
  {
    title: "1. Aceitação dos Termos",
    body: "Ao acessar ou utilizar o aplicativo ou a plataforma web ibhub, você concorda em ficar vinculado a estes Termos de Uso. Se não concordar com qualquer parte destes termos, não poderá usar o serviço. O uso continuado do aplicativo após alterações nos termos constitui aceitação das novas condições.",
  },
  {
    title: "2. Uso do Serviço",
    body: "Você concorda em usar o ibhub apenas para fins lícitos e de acordo com estes Termos. É proibido: (a) usar o serviço de maneira que viole qualquer lei ou regulamento aplicável; (b) transmitir material publicitário ou promocional não solicitado; (c) tentar obter acesso não autorizado a partes do serviço; (d) interferir ou interromper a integridade ou o desempenho do serviço.",
  },
  {
    title: "3. Conteúdo do Usuário",
    body: "Você é o único responsável por todo o conteúdo que publicar, enviar ou disponibilizar por meio do ibhub. Ao postar conteúdo, você concede ao ibhub uma licença mundial, não exclusiva, isenta de royalties para usar, reproduzir, modificar e exibir esse conteúdo em conexão com a prestação do serviço. Reservamo-nos o direito de remover qualquer conteúdo que viole estes Termos.",
  },
  {
    title: "4. Propriedade Intelectual",
    body: "O serviço ibhub e seu conteúdo original, recursos e funcionalidade são e continuarão sendo de propriedade exclusiva do ibhub e seus licenciadores. O serviço é protegido por direitos autorais, marcas registradas e outras leis do Brasil e de outros países. Nossas marcas e apresentação comercial não podem ser usadas sem o consentimento prévio por escrito do ibhub.",
  },
  {
    title: "5. Limitações de Responsabilidade",
    body: "Na extensão máxima permitida pela lei aplicável, o ibhub não será responsável por quaisquer danos indiretos, incidentais, especiais, consequenciais ou punitivos, incluindo, sem limitação, perda de lucros, dados, uso, boa vontade ou outras perdas intangíveis resultantes do seu acesso ou uso (ou incapacidade de acesso ou uso) do serviço.",
  },
  {
    title: "6. Rescisão e Exclusão de Conta",
    body: "Podemos encerrar ou suspender sua conta e acesso ao serviço imediatamente, sem aviso prévio ou responsabilidade, por qualquer motivo, inclusive se você violar estes Termos. Se desejar encerrar sua conta, você pode solicitar a exclusão permanente de todos os seus dados diretamente no aplicativo, em Configurações › Privacidade e Segurança › Excluir minha conta. A exclusão é irreversível e remove definitivamente todos os dados pessoais, publicações, conexões e histórico associados à conta.",
  },
  {
    title: "7. Alterações nos Termos",
    body: "Reservamo-nos o direito, a nosso critério exclusivo, de modificar ou substituir estes Termos a qualquer momento. Se uma revisão for material, tentaremos fornecer pelo menos 30 dias de aviso antes que quaisquer novos termos entrem em vigor.",
  },
  {
    title: "8. Contato",
    body: "Em caso de dúvidas sobre estes Termos de Uso, entre em contato conosco pelo e-mail: atendimento@idealbi.com.br. Nossa equipe retornará em até 5 dias úteis.",
  },
];

export default function TermosUsoPage() {
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
            Termos de Uso
          </h1>
          <p style={{ fontSize: 13, color: "#8a93a2", margin: 0 }}>
            Última atualização: 9 de abril de 2026
          </p>
        </div>

        <div style={{
          backgroundColor: "#fff", borderRadius: 14, border: "1px solid #e8eaf0",
          padding: 24, marginBottom: 20,
        }}>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "#3d4a5c", margin: 0 }}>
            Bem-vindo ao <strong>IBHUB - A Rede do Vinho</strong>. Ao utilizar nosso aplicativo ou plataforma web,
            você concorda com os termos e condições descritos abaixo. Por favor, leia atentamente antes de prosseguir.
            Estes termos foram elaborados de acordo com a <strong>Lei Geral de Proteção de Dados (LGPD)</strong> e demais legislações brasileiras aplicáveis.
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
          <span style={{ fontSize: 18, flexShrink: 0 }}>ℹ️</span>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: navy, margin: 0 }}>
            Estes termos foram elaborados de acordo com a Lei Geral de Proteção de Dados (LGPD) e demais legislações brasileiras aplicáveis.
          </p>
        </div>

      </main>

      <footer style={{
        backgroundColor: "#fff", borderTop: "1px solid #eaeae5",
        padding: "20px 24px", textAlign: "center",
      }}>
        <p style={{ fontSize: 13, color: "#9a9a8e", margin: 0 }}>
          © 2026 IBHUB - A Rede do Vinho. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
}
