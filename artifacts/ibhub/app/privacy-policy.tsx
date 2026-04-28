import { useRouter } from "expo-router";
import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/ui/Icon";
import { useColors } from "@/hooks/useColors";

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
    body: "Utilizamos cookies e tecnologias similares para melhorar sua experiência, analisar o uso do aplicativo e personalizar conteúdo. Você pode controlar o uso de cookies nas configurações do seu dispositivo. A desativação de cookies pode limitar algumas funcionalidades do serviço.",
  },
  {
    title: "6. Seus Direitos",
    body: "De acordo com a LGPD, você tem os seguintes direitos: acesso aos seus dados pessoais; correção de dados incompletos, inexatos ou desatualizados; anonimização, bloqueio ou eliminação de dados desnecessários; portabilidade dos dados; eliminação dos dados tratados com seu consentimento; informação sobre com quem compartilhamos seus dados; revogação do consentimento. Para exercer esses direitos, use a opção \"Fale Conosco\" no aplicativo.",
  },
  {
    title: "7. Contato",
    body: "Para dúvidas, solicitações ou reclamações relacionadas à proteção de dados e privacidade, entre em contato com nosso Encarregado de Dados (DPO) pelo e-mail: privacidade@ibhub.com.br, ou pelo aplicativo, usando a opção \"Fale Conosco\" nas Configurações. Respondemos em até 15 dias úteis.",
  },
];

export default function PrivacyPolicyScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Política de Privacidade</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <Text style={[styles.lastUpdated, { color: colors.mutedForeground }]}>
            Última atualização: 28 de abril de 2026
          </Text>
          <Text style={[styles.intro, { color: colors.navy }]}>
            Esta Política de Privacidade descreve como o ibhub coleta, usa e protege suas informações pessoais ao utilizar nosso aplicativo, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018).
          </Text>
        </View>

        {SECTIONS.map((section, i) => (
          <View key={i} style={[styles.sectionCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: colors.gold }]} />
              <Text style={[styles.sectionTitle, { color: colors.navy }]}>{section.title}</Text>
            </View>
            <Text style={[styles.sectionBody, { color: colors.foreground }]}>{section.body}</Text>
          </View>
        ))}

        <View style={[styles.footerCard, { backgroundColor: colors.gold + "15", borderColor: colors.gold + "40" }]}>
          <Feather name="shield" size={16} color={colors.gold} />
          <Text style={[styles.footerText, { color: colors.navy }]}>
            O ibhub está comprometido com a proteção dos seus dados pessoais e com total transparência sobre as práticas de privacidade adotadas.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1 },
  header:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle:   { fontSize: 20, fontWeight: "700" },
  card:          { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 12 },
  lastUpdated:   { fontSize: 12, marginBottom: 10 },
  intro:         { fontSize: 14, lineHeight: 22 },
  sectionCard:   { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 10, gap: 8 },
  sectionHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  sectionDot:    { width: 6, height: 6, borderRadius: 3, marginTop: 7, flexShrink: 0 },
  sectionTitle:  { fontSize: 15, fontWeight: "700", flex: 1 },
  sectionBody:   { fontSize: 14, lineHeight: 22 },
  footerCard:    { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 8 },
  footerText:    { fontSize: 13, lineHeight: 20, flex: 1 },
});
