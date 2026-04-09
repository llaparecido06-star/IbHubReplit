import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { createOpportunity } from "@/services/api";

type Mode = "marketplace" | "vaga";

const MARKET_CATS   = ["Vinho", "Insumo", "Equipamento", "Serviço", "Outros"];
const JOB_CATS      = ["Sommelier", "Enólogo", "Gerência", "Marketing", "Vendas", "Exportação", "Produção", "Outros"];
const CONTRACT_TYPES = ["CLT", "PJ", "Freelancer", "Estágio"];

export default function NewOpportunityScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, activeCompany } = useAuth();
  const isEmpresa = !!activeCompany;

  const [mode, setMode]         = useState<Mode>("vaga");
  const [title, setTitle]       = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [desc, setDesc]         = useState("");
  const [price, setPrice]       = useState("");
  const [location, setLocation] = useState("");
  const [expiry, setExpiry]     = useState("");
  const [email, setEmail]       = useState("");
  const [company, setCompany]   = useState("");
  const [salary, setSalary]     = useState("");
  const [contract, setContract] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const canPublish = title.trim().length > 0 && category !== null;

  const handlePublish = async () => {
    if (!user?.id) { Alert.alert("Erro", "Você precisa estar logado."); return; }
    if (!isEmpresa) {
      Alert.alert(
        "Apenas empresas podem publicar",
        "Somente contas do tipo Empresa podem anunciar vagas e produtos. Acesse as configurações para alterar o tipo da sua conta.",
      );
      return;
    }
    if (!canPublish) { Alert.alert("Atenção", "Preencha o título e a categoria."); return; }

    setPublishing(true);
    try {
      const result = await createOpportunity(
        {
          created_by: user.id,
          type: mode === "vaga" ? "vaga" : "marketplace",
          title: title.trim(),
          description: desc.trim() || null,
          category,
          location: location.trim() || null,
          price: mode === "marketplace" ? (price.trim() || null) : null,
          company: mode === "vaga" ? (company.trim() || null) : null,
          contract_type: mode === "vaga" ? (contract ?? null) : null,
          salary: mode === "vaga" ? (salary.trim() || null) : null,
          contact_email: email.trim() || null,
          expires_at: expiry.trim() ? parseExpiry(expiry) : null,
        },
        user.id,
      );

      if (result) {
        Alert.alert(
          mode === "marketplace" ? "Anúncio publicado!" : "Vaga publicada!",
          `"${title}" já está visível na aba Oportunidades.`,
          [{ text: "Ver publicação", onPress: () => router.replace(`/opportunity/${result.id}` as any) }],
        );
      } else {
        Alert.alert("Erro", "Não foi possível publicar. Tente novamente.");
      }
    } finally {
      setPublishing(false);
    }
  };

  const ChipSelector = ({
    options, selected, onSelect,
  }: { options: string[]; selected: string | null; onSelect: (v: string) => void }) => (
    <View style={styles.chipWrap}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          style={[
            styles.chip,
            { borderColor: selected === opt ? colors.gold : colors.border,
              backgroundColor: selected === opt ? colors.gold + "18" : colors.background },
          ]}
          onPress={() => onSelect(opt)}
        >
          <Text style={[styles.chipText, { color: selected === opt ? colors.gold : colors.foreground, fontWeight: selected === opt ? "700" : "400" }]}>
            {opt}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancelar</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Nova Oportunidade</Text>
        <TouchableOpacity
          style={[styles.publishBtn, { backgroundColor: canPublish && !publishing ? colors.gold : colors.border }]}
          onPress={handlePublish}
          disabled={publishing || !canPublish}
        >
          <Text style={[styles.publishBtnText, { color: canPublish && !publishing ? "#fff" : colors.mutedForeground }]}>
            {publishing ? "Publicando..." : "Publicar"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, rowGap: 20, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        {/* Mode toggle */}
        <View style={[styles.toggle, { backgroundColor: colors.secondary, borderRadius: 12, padding: 4 }]}>
          {(["vaga", "marketplace"] as Mode[]).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.toggleBtn, { backgroundColor: mode === m ? colors.gold : "transparent" }]}
              onPress={() => { setMode(m); setCategory(null); }}
            >
              <Text style={[styles.toggleText, { color: mode === m ? "#fff" : colors.mutedForeground }]}>
                {m === "marketplace" ? "Marketplace" : "Vaga de Emprego"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Vaga de Emprego ── */}
        {mode === "vaga" && (
          <>
            <Field label="Título da vaga *" colors={colors}>
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="Ex: Sommelier Chefe" placeholderTextColor={colors.mutedForeground} value={title} onChangeText={setTitle} />
            </Field>
            <Field label="Categoria *" colors={colors}>
              <ChipSelector options={JOB_CATS} selected={category} onSelect={setCategory} />
            </Field>
            <Field label="Empresa" colors={colors}>
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="Nome da empresa" placeholderTextColor={colors.mutedForeground} value={company} onChangeText={setCompany} />
            </Field>
            <Field label="Tipo de contrato" colors={colors}>
              <ChipSelector options={CONTRACT_TYPES} selected={contract} onSelect={setContract} />
            </Field>
            <Field label="Salário / Remuneração" colors={colors}>
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="Ex: R$ 8.000 – 12.000" placeholderTextColor={colors.mutedForeground} value={salary} onChangeText={setSalary} />
            </Field>
            <Field label="Localização" colors={colors}>
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="Ex: São Paulo, SP" placeholderTextColor={colors.mutedForeground} value={location} onChangeText={setLocation} />
            </Field>
            <Field label="Descrição" colors={colors}>
              <TextInput style={[styles.input, styles.textarea, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="Descreva os requisitos e benefícios..." placeholderTextColor={colors.mutedForeground} value={desc} onChangeText={setDesc} multiline numberOfLines={5} textAlignVertical="top" />
            </Field>
            <Field label="Validade (opcional)" colors={colors}>
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="dd/mm/aaaa" placeholderTextColor={colors.mutedForeground} value={expiry} onChangeText={setExpiry} />
            </Field>
            <Field label="E-mail de contato" colors={colors}>
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="rh@empresa.com" placeholderTextColor={colors.mutedForeground} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            </Field>
          </>
        )}

        {/* ── Marketplace ── */}
        {mode === "marketplace" && (
          <>
            <Field label="Título do anúncio *" colors={colors}>
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder='Ex: Malbec Gran Reserva 2022' placeholderTextColor={colors.mutedForeground} value={title} onChangeText={setTitle} />
            </Field>
            <Field label="Categoria *" colors={colors}>
              <ChipSelector options={MARKET_CATS} selected={category} onSelect={setCategory} />
            </Field>
            <Field label="Descrição" colors={colors}>
              <TextInput style={[styles.input, styles.textarea, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="Descreva os detalhes..." placeholderTextColor={colors.mutedForeground} value={desc} onChangeText={setDesc} multiline numberOfLines={5} textAlignVertical="top" />
            </Field>
            <Field label="Preço" colors={colors}>
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="Ex: R$ 89/un" placeholderTextColor={colors.mutedForeground} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
            </Field>
            <Field label="Localização" colors={colors}>
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="Ex: São Paulo, SP" placeholderTextColor={colors.mutedForeground} value={location} onChangeText={setLocation} />
            </Field>
            <Field label="Validade (opcional)" colors={colors}>
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="dd/mm/aaaa" placeholderTextColor={colors.mutedForeground} value={expiry} onChangeText={setExpiry} />
            </Field>
            <Field label="E-mail de contato" colors={colors}>
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="contato@empresa.com" placeholderTextColor={colors.mutedForeground} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            </Field>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children, colors }: { label: string; children: React.ReactNode; colors: any }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.navy }]}>{label}</Text>
      {children}
    </View>
  );
}

function parseExpiry(str: string): string | null {
  const parts = str.split("/");
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    const d = new Date(`${yyyy}-${mm}-${dd}`);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

const styles = StyleSheet.create({
  container:      { flex: 1 },
  header:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  cancelText:     { fontSize: 15 },
  headerTitle:    { fontSize: 17, fontWeight: "700" },
  publishBtn:     { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  publishBtnText: { fontSize: 14, fontWeight: "700" },
  toggle:         { flexDirection: "row" },
  toggleBtn:      { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  toggleText:     { fontSize: 14, fontWeight: "600" },
  field:          { gap: 8 },
  label:          { fontSize: 15, fontWeight: "700" },
  input:          { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  textarea:       { height: 120, textAlignVertical: "top" },
  chipWrap:       { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip:           { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  chipText:       { fontSize: 13 },
});
