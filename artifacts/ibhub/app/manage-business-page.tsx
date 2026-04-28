import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { Feather } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionsContext";
import { useColors } from "@/hooks/useColors";
import { PaywallScreen } from "@/components/ui/PaywallScreen";
import * as API from "@/services/api";

type Tab     = "preview" | "editar" | "equipe";
type RoleKey = "editor" | "moderador" | "visualizador";

const CATEGORIES: string[] = [
  // Produção
  "Vinícola", "Adega / Cave",
  // Comércio exterior & distribuição
  "Importadora", "Exportadora", "Distribuidora", "Atacadista", "Representante Comercial",
  // Varejo & ponto de venda
  "Enoteca", "Loja Especializada", "Supermercado", "E-commerce",
  // Hospitalidade & serviço
  "Restaurante", "Hotelaria", "Bar / Bistrô",
  // Experiências & comunicação
  "Enoturismo", "Eventos", "Marketing / Agência", "Jornalismo / Imprensa", "Educação",
  // Negócios & outros
  "Consultoria", "Outros",
];

const ROLES: { key: RoleKey; label: string }[] = [
  { key: "editor",       label: "Editor" },
  { key: "moderador",    label: "Moderador" },
  { key: "visualizador", label: "Visualizador" },
];

const ROLE_DESCRIPTIONS: Record<RoleKey, { icon: string; desc: string }> = {
  editor: {
    icon: "edit-3",
    desc: "Pode editar informações da página (nome, logo, bio), alterar portfólio e publicar todo tipo de conteúdo: posts, stories, chat, eventos, vagas e marketplace.",
  },
  moderador: {
    icon: "shield",
    desc: "Pode publicar posts, responder chat, criar eventos, anunciar vagas e no marketplace. Não pode editar informações da página nem alterar portfólio.",
  },
  visualizador: {
    icon: "eye",
    desc: "Pode responder mensagens no chat e grupos como empresa. Não pode publicar posts, criar eventos/vagas/marketplace nem editar informações da página.",
  },
};

export default function ManageBusinessPageScreen() {
  const colors  = useColors();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { user: currentUser } = useAuth();
  const { hasFeature, isLoading: permLoading } = usePermissions();
  const { id: pageId }  = useLocalSearchParams<{ id: string }>();

  const [activeTab, setActiveTab] = useState<Tab>("preview");
  const [page, setPage]           = useState<API.CompanyPage | null>(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [isOwner, setIsOwner]     = useState(false);
  const [userRole, setUserRole]   = useState<string | null>(null);

  // Editar fields (local copies so user can cancel)
  const [companyName, setCompanyName] = useState("");
  const [username, setUsername]       = useState("");
  const [category, setCategory]       = useState("Vinícola");
  const [desc, setDesc]               = useState("");
  const [website, setWebsite]         = useState("");
  const [location, setLocation]       = useState("");
  const [logoUri, setLogoUri]         = useState<string | null>(null);

  // Equipe
  const [admins, setAdmins]               = useState<API.CompanyPageAdmin[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [selectedRole, setSelectedRole]   = useState<RoleKey>("editor");
  const [memberSearch, setMemberSearch]   = useState("");
  const [searchResults, setSearchResults] = useState<
    { id: string; full_name: string; username: string; avatar_url: string | null; headline: string | null }[]
  >([]);
  const [addingMember, setAddingMember]   = useState(false);
  const [transferring, setTransferring]   = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  // ── Load company page ──────────────────────────────────────────────────────
  const loadPage = useCallback(async () => {
    if (!pageId) { setLoading(false); return; }
    setLoading(true);
    const [data, roleInfo] = await Promise.all([
      API.fetchCompanyPageById(pageId),
      currentUser?.id ? API.checkUserCompanyRole(pageId, currentUser.id) : Promise.resolve({ isOwner: false, role: null }),
    ]);
    if (data) {
      setPage(data);
      setCompanyName(data.name);
      setUsername(data.username ?? "");
      setCategory(data.industry ?? "Vinícola");
      setDesc(data.bio ?? "");
      setWebsite(data.website ?? "");
      setLocation(data.location ?? "");
    }
    setIsOwner(roleInfo.isOwner);
    setUserRole(roleInfo.role);
    setLoading(false);
  }, [pageId, currentUser?.id]);

  useEffect(() => { loadPage(); }, [loadPage]);

  // ── Load admins when equipe tab opens ──────────────────────────────────────
  useEffect(() => {
    if (activeTab !== "equipe" || !pageId) return;
    setAdminsLoading(true);
    API.fetchCompanyPageAdmins(pageId).then(data => {
      setAdmins(data);
      setAdminsLoading(false);
    });
  }, [activeTab, pageId]);

  // ── Member search with debounce ────────────────────────────────────────────
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!memberSearch.trim() || !currentUser?.id) {
      setSearchResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      const results = await API.searchProfiles(memberSearch, currentUser.id);
      const existingIds = new Set(admins.map(a => a.user_id));
      setSearchResults(results.filter(r => !existingIds.has(r.id)));
    }, 350);
  }, [memberSearch, currentUser?.id, admins]);

  // ── Save edits (create or update) ─────────────────────────────────────────
  const handleSave = async () => {
    if (!companyName.trim()) {
      Alert.alert("Atenção", "O nome da empresa é obrigatório.");
      return;
    }
    if (!currentUser?.id) return;
    setSaving(true);

    // ── CREATE mode (no existing pageId) ──
    if (!pageId) {
      const created = await API.createCompanyPage({
        owner_id: currentUser.id,
        name: companyName.trim(),
        username: username.trim() || undefined,
        industry: category,
        bio: desc.trim() || undefined,
        website: website.trim() || undefined,
        location: location.trim() || undefined,
      });
      setSaving(false);
      if (created) {
        Alert.alert("Página criada!", `"${created.name}" foi criada com sucesso.`, [
          { text: "OK", onPress: () => router.replace(`/manage-business-page?id=${created.id}` as any) },
        ]);
      } else {
        Alert.alert("Erro", "Não foi possível criar a empresa. Tente novamente.");
      }
      return;
    }

    // ── EDIT mode ──
    let avatar_url = page?.avatar_url ?? null;
    if (logoUri && logoUri !== page?.avatar_url) {
      const uploaded = await API.uploadCompanyLogo(pageId, logoUri);
      if (uploaded) avatar_url = uploaded;
    }

    const ok = await API.updateCompanyPage(pageId, {
      name: companyName.trim(),
      username: username.trim() || null,
      industry: category,
      bio: desc.trim() || null,
      website: website.trim() || null,
      location: location.trim() || null,
      avatar_url,
    });

    setSaving(false);

    if (ok) {
      setPage(prev => prev ? { ...prev, name: companyName, username: username.trim() || null, industry: category, bio: desc, website, location, avatar_url } : prev);
      Alert.alert("Salvo!", "Alterações salvas com sucesso.");
    } else {
      Alert.alert("Erro", "Não foi possível salvar. Tente novamente.");
    }
  };

  // ── Delete page ────────────────────────────────────────────────────────────
  const handleDelete = () => {
    Alert.alert(
      "Excluir página",
      `Tem certeza que deseja excluir "${page?.name ?? "esta página"}"? Esta ação é irreversível.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            if (!pageId) return;
            setDeleting(true);
            const ok = await API.deleteCompanyPage(pageId);
            setDeleting(false);
            if (ok) {
              Alert.alert("Excluída", "A página foi excluída.", [
                { text: "OK", onPress: () => router.back() },
              ]);
            } else {
              Alert.alert("Erro", "Não foi possível excluir. Tente novamente.");
            }
          },
        },
      ],
    );
  };

  // ── Pick logo ──────────────────────────────────────────────────────────────
  const handlePickLogo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permissão necessária", "Permita o acesso à galeria para trocar o logo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setLogoUri(result.assets[0].uri);
    }
  };

  // ── Add member ─────────────────────────────────────────────────────────────
  const handleAddMember = async (userId: string) => {
    if (!pageId) return;
    setAddingMember(true);
    const ok = await API.addCompanyPageAdmin(pageId, userId, selectedRole);
    if (ok) {
      setMemberSearch("");
      setSearchResults([]);
      const updated = await API.fetchCompanyPageAdmins(pageId);
      setAdmins(updated);
    } else {
      Alert.alert("Erro", "Não foi possível adicionar o membro.");
    }
    setAddingMember(false);
  };

  // ── Remove member ──────────────────────────────────────────────────────────
  const handleRemoveMember = (userId: string, name: string) => {
    Alert.alert("Remover membro", `Remover ${name} da equipe?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: async () => {
          if (!pageId) return;
          const ok = await API.removeCompanyPageAdmin(pageId, userId);
          if (ok) setAdmins(prev => prev.filter(a => a.user_id !== userId));
          else Alert.alert("Erro", "Não foi possível remover o membro.");
        },
      },
    ]);
  };

  // ── Transfer ownership ─────────────────────────────────────────────────────
  const handleTransferOwnership = (toUserId: string, toName: string) => {
    if (!pageId || !currentUser?.id) return;
    Alert.alert(
      "Transferir Propriedade",
      `Deseja transferir a propriedade da página para ${toName}?\n\nVocê continuará na equipe como Editor.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Transferir",
          style: "destructive",
          onPress: async () => {
            setTransferring(true);
            const { ok, error } = await API.transferCompanyOwnership(pageId, toUserId, currentUser.id);
            setTransferring(false);
            if (ok) {
              Alert.alert(
                "Propriedade transferida",
                `${toName} agora é o proprietário da página. Você foi convertido em Editor.`,
                [{ text: "OK", onPress: () => router.back() }],
              );
            } else {
              Alert.alert("Erro", error ?? "Não foi possível transferir a propriedade.");
            }
          },
        },
      ],
    );
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const logoSource = logoUri ?? page?.avatar_url ?? null;
  const logoInitial = (page?.name ?? companyName ?? "?")[0]?.toUpperCase() ?? "?";

  if (loading || permLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  if (!hasFeature("Criar Página Empresa")) {
    return (
      <PaywallScreen
        featureName="Criar Página Empresa"
        description="Crie e gerencie uma página empresarial profissional para a sua empresa no ibhub."
        requiredPlan="Empresarial"
      />
    );
  }

  const isCreateMode = !pageId;

  const canEdit = isOwner || userRole === "editor";

  const tabList: Array<{ key: Tab; label: string; icon: string }> = [
    { key: "preview", label: "Preview", icon: "eye" },
    ...(canEdit ? [{ key: "editar" as Tab, label: "Editar", icon: "edit-2" }] : []),
    ...(isOwner  ? [{ key: "equipe" as Tab, label: "Equipe", icon: "users" }] : []),
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
          <Text style={[styles.headerTitle, { color: colors.navy }]}>
            {isCreateMode ? "Nova Empresa" : (page?.name ?? "Página Empresarial")}
          </Text>
        </TouchableOpacity>
        {/* Admin panel shortcut — only for owners */}
        {!isCreateMode && isOwner && pageId && (
          <TouchableOpacity
            style={[styles.adminBtn, { backgroundColor: colors.gold }]}
            onPress={() => router.push(`/empresa/admin?id=${pageId}&name=${encodeURIComponent(page?.name ?? "")}` as any)}
          >
            <Feather name="bar-chart-2" size={14} color="#fff" />
            <Text style={styles.adminBtnText}>Painel</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs — only shown when editing an existing page */}
      {!isCreateMode && (
        <View style={[styles.tabBar, { backgroundColor: "#fff", borderBottomColor: colors.border }]}>
          {tabList.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabItem, activeTab === t.key && { borderBottomColor: colors.gold, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab(t.key)}
            >
              <Feather name={t.icon as any} size={14} color={activeTab === t.key ? colors.gold : colors.mutedForeground} />
              <Text style={[styles.tabLabel, { color: activeTab === t.key ? colors.gold : colors.mutedForeground }]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
          {/* Role badge for non-owners */}
          {!isOwner && userRole && (
            <View style={[styles.tabRoleBadge, { backgroundColor: colors.gold + "18" }]}>
              <Feather name="user-check" size={12} color={colors.gold} />
              <Text style={[styles.tabRoleLabel, { color: colors.gold }]}>{userRole}</Text>
            </View>
          )}
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── Preview ── */}
        {activeTab === "preview" && (
          <View style={{ padding: 16, gap: 16 }}>
            {/* Role info banner for non-owners */}
            {!isOwner && userRole && ROLE_DESCRIPTIONS[userRole as RoleKey] && (
              <View style={[styles.roleInfoBanner, { backgroundColor: colors.gold + "12", borderColor: colors.gold + "40" }]}>
                <Feather name={ROLE_DESCRIPTIONS[userRole as RoleKey].icon as any} size={16} color={colors.gold} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.roleInfoTitle, { color: colors.navy }]}>
                    Seu papel: {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                  </Text>
                  <Text style={[styles.roleInfoDesc, { color: colors.mutedForeground }]}>
                    {ROLE_DESCRIPTIONS[userRole as RoleKey].desc}
                  </Text>
                </View>
              </View>
            )}
            <View style={[styles.previewCard, { borderColor: colors.border }]}>
              {logoSource
                ? <Image source={{ uri: logoSource }} style={styles.previewLogo} />
                : (
                  <View style={[styles.previewLogoFallback, { backgroundColor: colors.navy }]}>
                    <Text style={[styles.previewLogoInitial, { color: colors.gold }]}>{logoInitial}</Text>
                  </View>
                )
              }
              <Text style={[styles.previewName, { color: colors.navy }]}>{page?.name ?? "—"}</Text>
              {page?.industry && (
                <View style={[styles.categoryBadge, { backgroundColor: colors.gold + "18" }]}>
                  <Text style={[styles.categoryBadgeText, { color: colors.gold }]}>{page.industry}</Text>
                </View>
              )}
              {page?.bio ? (
                <Text style={[styles.previewBio, { color: colors.mutedForeground }]}>{page.bio}</Text>
              ) : null}
              <View style={styles.previewMeta}>
                {page?.website ? (
                  <View style={styles.previewMetaRow}>
                    <Feather name="globe" size={13} color={colors.mutedForeground} />
                    <Text style={[styles.previewMetaText, { color: colors.mutedForeground }]}>{page.website}</Text>
                  </View>
                ) : null}
                {page?.location ? (
                  <View style={styles.previewMetaRow}>
                    <Feather name="map-pin" size={13} color={colors.mutedForeground} />
                    <Text style={[styles.previewMetaText, { color: colors.mutedForeground }]}>{page.location}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {isOwner && (
              <TouchableOpacity
                style={[styles.deletePageBtn, { borderColor: "#dc2626", opacity: deleting ? 0.6 : 1 }]}
                onPress={handleDelete}
                disabled={deleting}
              >
                {deleting
                  ? <ActivityIndicator size="small" color="#dc2626" />
                  : <Feather name="trash-2" size={16} color="#dc2626" />
                }
                <Text style={[styles.deletePageText, { color: "#dc2626" }]}>Excluir página</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Editar / Criar ── */}
        {(isCreateMode || activeTab === "editar") && (
          <View style={{ padding: 16, gap: 18 }}>
            {/* Logo picker — only available when editing an existing page */}
            {!isCreateMode && (
              <View style={styles.logoWrap}>
                <TouchableOpacity onPress={handlePickLogo} activeOpacity={0.8}>
                  {logoSource
                    ? <Image source={{ uri: logoSource }} style={styles.companyLogoLarge} />
                    : (
                      <View style={[styles.companyLogoLarge, { backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" }]}>
                        <Text style={[styles.companyLogoLargeText, { color: colors.gold }]}>{logoInitial}</Text>
                      </View>
                    )
                  }
                </TouchableOpacity>
                <TouchableOpacity style={[styles.cameraOverlay, { backgroundColor: colors.gold }]} onPress={handlePickLogo}>
                  <Feather name="camera" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.navy }]}>Nome da empresa *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
                value={companyName}
                onChangeText={setCompanyName}
                placeholder="Nome da empresa"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.navy }]}>Username da página</Text>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 15, marginRight: 4 }}>@</Text>
                <TextInput
                  style={[styles.input, { flex: 1, backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
                  value={username}
                  onChangeText={t => setUsername(t.toLowerCase().replace(/[^a-z0-9._]/g, ""))}
                  placeholder="nome_empresa"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                />
              </View>
              <Text style={[styles.charCount, { color: colors.mutedForeground }]}>Letras minúsculas, números, ponto e underscore.</Text>
            </View>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.navy }]}>Categoria *</Text>
              <View style={styles.catGrid}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catChip, {
                      backgroundColor: category === cat ? colors.gold : "#fff",
                      borderColor: category === cat ? colors.gold : colors.border,
                    }]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={[styles.catChipText, { color: category === cat ? "#fff" : colors.foreground }]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.navy }]}>Descrição</Text>
              <TextInput
                style={[styles.input, styles.textarea, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
                placeholder="Sobre a empresa..."
                placeholderTextColor={colors.mutedForeground}
                value={desc}
                onChangeText={setDesc}
                multiline
                textAlignVertical="top"
                maxLength={500}
              />
              <Text style={[styles.charCount, { color: colors.mutedForeground }]}>{desc.length}/500</Text>
            </View>

            {[
              { label: "Website",    value: website,   onChange: setWebsite,   placeholder: "https://suaempresa.com.br" },
              { label: "Localização",value: location,  onChange: setLocation,  placeholder: "Ex: São Paulo - SP" },
            ].map(f => (
              <View key={f.label} style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.navy }]}>{f.label}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
                  placeholder={f.placeholder}
                  placeholderTextColor={colors.mutedForeground}
                  value={f.value}
                  onChangeText={f.onChange}
                />
              </View>
            ))}

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.gold, opacity: saving ? 0.7 : 1 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Feather name="save" size={16} color="#fff" />
              }
              <Text style={styles.saveBtnText}>{saving ? (isCreateMode ? "Criando..." : "Salvando...") : (isCreateMode ? "Criar Empresa" : "Salvar alterações")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Equipe ── */}
        {activeTab === "equipe" && (
          <View style={{ padding: 16, gap: 16 }}>
            {/* Role selector */}
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.navy }]}>Papel do novo membro</Text>
              <View style={styles.roleChips}>
                {ROLES.map(r => (
                  <TouchableOpacity
                    key={r.key}
                    style={[styles.roleChip, { backgroundColor: selectedRole === r.key ? colors.gold : "#fff", borderColor: selectedRole === r.key ? colors.gold : colors.border }]}
                    onPress={() => setSelectedRole(r.key)}
                  >
                    <Text style={[styles.roleChipText, { color: selectedRole === r.key ? "#fff" : colors.mutedForeground }]}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {/* Role description */}
              <View style={[styles.roleDescCard, { backgroundColor: colors.gold + "12", borderColor: colors.gold + "40" }]}>
                <Feather name={ROLE_DESCRIPTIONS[selectedRole].icon as any} size={14} color={colors.gold} />
                <Text style={[styles.roleDescText, { color: colors.navy }]}>
                  {ROLE_DESCRIPTIONS[selectedRole].desc}
                </Text>
              </View>
            </View>

            {/* Search bar */}
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.navy }]}>Buscar usuário</Text>
              <View style={[styles.memberSearchBar, { backgroundColor: "#fff", borderColor: colors.border }]}>
                <Feather name="search" size={14} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.memberSearchInput, { color: colors.foreground }]}
                  placeholder="Nome ou @username..."
                  placeholderTextColor={colors.mutedForeground}
                  value={memberSearch}
                  onChangeText={setMemberSearch}
                />
                {memberSearch.length > 0 && (
                  <TouchableOpacity onPress={() => { setMemberSearch(""); setSearchResults([]); }}>
                    <Feather name="x" size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Search results */}
              {searchResults.length > 0 && (
                <View style={[styles.searchResultsList, { borderColor: colors.border }]}>
                  {searchResults.map(u => (
                    <TouchableOpacity
                      key={u.id}
                      style={[styles.searchResultItem, { borderBottomColor: colors.border }]}
                      onPress={() => handleAddMember(u.id)}
                      disabled={addingMember}
                    >
                      <Avatar uri={u.avatar_url} name={u.full_name} size={36} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.memberName, { color: colors.foreground }]}>{u.full_name}</Text>
                        {u.headline ? (
                          <Text style={[styles.memberRole, { color: colors.mutedForeground }]}>{u.headline}</Text>
                        ) : null}
                      </View>
                      {addingMember
                        ? <ActivityIndicator size="small" color={colors.gold} />
                        : <Feather name="plus-circle" size={18} color={colors.gold} />
                      }
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Team list */}
            <Text style={[styles.teamSectionTitle, { color: colors.navy }]}>
              Equipe ({admins.length})
            </Text>

            {adminsLoading ? (
              <ActivityIndicator color={colors.gold} style={{ marginTop: 16 }} />
            ) : admins.length === 0 ? (
              <View style={styles.teamEmpty}>
                <Feather name="users" size={32} color={colors.border} />
                <Text style={[styles.teamEmptyText, { color: colors.mutedForeground }]}>
                  Nenhum membro na equipe ainda.
                </Text>
              </View>
            ) : (
              admins.map(admin => {
                const p = admin.profile;
                const headline = [p?.position, p?.company].filter(Boolean).join(" · ") || null;
                return (
                  <View key={admin.user_id} style={[styles.memberRow, { borderBottomColor: colors.border }]}>
                    <Avatar uri={p?.avatar_url} name={p?.full_name ?? "?"} size={42} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.memberName, { color: colors.foreground }]}>
                        {p?.full_name ?? "Usuário"}
                      </Text>
                      {headline ? (
                        <Text style={[styles.memberRole, { color: colors.mutedForeground }]}>{headline}</Text>
                      ) : null}
                    </View>
                    <View style={[styles.roleBadge, { backgroundColor: colors.gold + "18" }]}>
                      <Text style={[styles.roleBadgeText, { color: colors.gold }]}>
                        {admin.role.charAt(0).toUpperCase() + admin.role.slice(1)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.removeBtn, { marginRight: 4 }]}
                      onPress={() => handleTransferOwnership(admin.user_id, p?.full_name ?? "membro")}
                      disabled={transferring}
                    >
                      <Feather name="award" size={16} color={colors.gold} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => handleRemoveMember(admin.user_id, p?.full_name ?? "membro")}
                    >
                      <Feather name="trash-2" size={16} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  adminBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  adminBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  backRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  tabBar: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1 },
  tabItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14 },
  tabLabel: { fontSize: 13, fontWeight: "600" },
  tabRoleBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, marginRight: 10 },
  tabRoleLabel: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },

  // Preview
  previewCard: { alignItems: "center", gap: 12, padding: 24, borderRadius: 12, borderWidth: 1, backgroundColor: "#fff" },
  previewLogo: { width: 80, height: 80, borderRadius: 12 },
  previewLogoFallback: { width: 80, height: 80, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  previewLogoInitial: { fontSize: 32, fontWeight: "800" },
  previewName: { fontSize: 22, fontWeight: "800", textAlign: "center" },
  categoryBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  categoryBadgeText: { fontSize: 13, fontWeight: "600" },
  previewBio: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  previewMeta: { gap: 6, width: "100%" },
  previewMetaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  previewMetaText: { fontSize: 13 },
  deletePageBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 10, borderWidth: 1.5 },
  deletePageText: { fontSize: 15, fontWeight: "700" },

  // Editar
  logoWrap: { alignSelf: "center", position: "relative" },
  companyLogoLarge: { width: 100, height: 100, borderRadius: 16 },
  companyLogoLargeText: { fontSize: 40, fontWeight: "800" },
  cameraOverlay: { position: "absolute", bottom: -6, right: -6, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  field: { gap: 8 },
  fieldLabel: { fontSize: 15, fontWeight: "700" },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  textarea: { height: 110, textAlignVertical: "top" },
  charCount: { fontSize: 12, textAlign: "right" },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catChip: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  catChipText: { fontSize: 13 },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15, borderRadius: 10 },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  // Equipe
  roleChips: { flexDirection: "row", gap: 8 },
  roleChip: { borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  roleChipText: { fontSize: 13, fontWeight: "500" },
  roleDescCard: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 4 },
  roleDescText: { flex: 1, fontSize: 13, lineHeight: 18 },
  roleInfoBanner: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  roleInfoTitle: { fontSize: 13, fontWeight: "700", marginBottom: 2 },
  roleInfoDesc: { fontSize: 13, lineHeight: 18 },
  memberSearchBar: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  memberSearchInput: { flex: 1, fontSize: 14 },
  searchResultsList: { borderWidth: 1, borderRadius: 10, overflow: "hidden", marginTop: 4 },
  searchResultItem: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderBottomWidth: 1 },
  divider: { height: 1 },
  teamSectionTitle: { fontSize: 15, fontWeight: "700" },
  teamEmpty: { alignItems: "center", paddingVertical: 32, gap: 10 },
  teamEmptyText: { fontSize: 14 },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1 },
  memberName: { fontSize: 14, fontWeight: "600" },
  memberRole: { fontSize: 12, marginTop: 2 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  roleBadgeText: { fontSize: 12, fontWeight: "600" },
  removeBtn: { padding: 6 },
});
