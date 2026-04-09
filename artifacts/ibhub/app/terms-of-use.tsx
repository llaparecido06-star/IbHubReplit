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
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

const SECTIONS = [
  {
    title: "1. Aceitação dos Termos",
    body: "Ao acessar ou utilizar o aplicativo ibhub, você concorda em ficar vinculado a estes Termos de Uso. Se não concordar com qualquer parte destes termos, não poderá usar o serviço. O uso continuado do aplicativo após alterações nos termos constitui aceitação das novas condições.",
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
    body: "O serviço ibhub e seu conteúdo original, recursos e funcionalidade são e continuarão sendo de propriedade exclusiva do ibhub e seus licenciadores. O serviço é protegido por direitos autorais, marcas registradas e outras leis do Brasil e de outros países. Nossas marcas e apresentação comercial não podem ser usadas em conexão com qualquer produto ou serviço sem o consentimento prévio por escrito do ibhub.",
  },
  {
    title: "5. Limitações de Responsabilidade",
    body: "Na extensão máxima permitida pela lei aplicável, o ibhub não será responsável por quaisquer danos indiretos, incidentais, especiais, consequenciais ou punitivos, incluindo, sem limitação, perda de lucros, dados, uso, boa vontade ou outras perdas intangíveis resultantes do seu acesso ou uso (ou incapacidade de acesso ou uso) do serviço.",
  },
  {
    title: "6. Rescisão e Exclusão de Conta",
    body: "Podemos encerrar ou suspender sua conta e acesso ao serviço imediatamente, sem aviso prévio ou responsabilidade, por qualquer motivo, inclusive se você violar estes Termos. Após o encerramento, seu direito de usar o serviço cessará imediatamente. Se desejar encerrar sua conta, você pode solicitar a exclusão permanente de todos os seus dados diretamente no aplicativo, em Configurações › Privacidade e Segurança › Excluir minha conta. A exclusão é irreversível e remove definitivamente todos os dados pessoais, publicações, conexões e histórico associados à conta.",
  },
  {
    title: "7. Alterações nos Termos",
    body: "Reservamo-nos o direito, a nosso critério exclusivo, de modificar ou substituir estes Termos a qualquer momento. Se uma revisão for material, tentaremos fornecer pelo menos 30 dias de aviso antes que quaisquer novos termos entrem em vigor. O que constitui uma mudança material será determinado a nosso critério exclusivo.",
  },
  {
    title: "8. Contato",
    body: "Em caso de dúvidas sobre estes Termos de Uso, entre em contato conosco pelo aplicativo, utilizando a opção \"Fale Conosco\" nas Configurações, ou pelo e-mail: suporte@ibhub.com.br. Nossa equipe retornará em até 5 dias úteis.",
  },
];

export default function TermsOfUseScreen() {
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
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Termos de Uso</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <Text style={[styles.lastUpdated, { color: colors.mutedForeground }]}>
            Última atualização: 9 de abril de 2026
          </Text>
          <Text style={[styles.intro, { color: colors.navy }]}>
            Bem-vindo ao ibhub. Ao utilizar nosso aplicativo, você concorda com os termos e condições descritos abaixo. Por favor, leia atentamente antes de prosseguir.
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
          <Feather name="info" size={16} color={colors.gold} />
          <Text style={[styles.footerText, { color: colors.navy }]}>
            Estes termos foram elaborados de acordo com a Lei Geral de Proteção de Dados (LGPD) e demais legislações brasileiras aplicáveis.
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
