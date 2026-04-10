import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import * as API from "@/services/api";

type AdminTab = "vagas" | "anuncios" | "eventos";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:     { label: "Pendente",     color: "#f39c12" },
  reviewed:    { label: "Visualizado",  color: "#3498db" },
  shortlisted: { label: "Selecionado",  color: "#8b5cf6" },
  hired:       { label: "Contratado",   color: "#2ecc71" },
  rejected:    { label: "Rejeitado",    color: "#e74c3c" },
};

const STATUS_CYCLE: API.CompanyAdminApplicant["status"][] = [
  "pending", "reviewed", "shortlisted", "hired", "rejected",
];

function fmtCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Applicants Modal ────────────────────────────────────────────────────────

interface ApplicantsModalProps {
  opportunity: API.CompanyAdminOpportunity | null;
  visible: boolean;
  onClose: () => void;
}

function ApplicantsModal({ opportunity, visible, onClose }: ApplicantsModalProps) {
  const colors = useColors();
  const [applicants, setApplicants] = useState<API.CompanyAdminApplicant[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !opportunity) return;
    setLoading(true);
    API.fetchOpportunityApplicants(opportunity.id).then(data => {
      setApplicants(data);
      setLoading(false);
    });
  }, [visible, opportunity?.id]);

  const handleStatusChange = async (applicant: API.CompanyAdminApplicant) => {
    const currentIdx = STATUS_CYCLE.indexOf(applicant.status);
    const nextStatus = STATUS_CYCLE[(currentIdx + 1) % STATUS_CYCLE.length];
    const ok = await API.updateApplicationStatus(applicant.id, nextStatus);
    if (ok) {
      setApplicants(prev => prev.map(a =>
        a.id === applicant.id ? { ...a, status: nextStatus } : a
      ));
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.modalHeader, { borderBottomColor: colors.border, paddingTop: Platform.OS === "ios" ? 54 : 20 }]}>
          <TouchableOpacity onPress={onClose}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]} numberOfLines={1}>
              {opportunity?.title}
            </Text>
            <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
              {applicants.length} candidato{applicants.length !== 1 ? "s" : ""}
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.gold} />
          </View>
        ) : applicants.length === 0 ? (
          <View style={styles.center}>
            <Feather name="users" size={40} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Nenhum candidato ainda
            </Text>
          </View>
        ) : (
          <FlatList
            data={applicants}
            keyExtractor={a => a.id}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            renderItem={({ item }) => {
              const statusMeta = STATUS_LABELS[item.status] ?? STATUS_LABELS.pending;
              return (
                <View style={[styles.applicantCard, { backgroundColor: colors.secondary, borderRadius: 12 }]}>
                  {/* Profile row */}
                  <View style={styles.applicantTop}>
                    <Avatar uri={item.avatar_url} name={item.full_name ?? "?"} size={48} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[styles.applicantName, { color: colors.foreground }]}>
                        {item.full_name ?? "Usuário"}
                      </Text>
                      {item.headline ? (
                        <Text style={[styles.applicantHeadline, { color: colors.mutedForeground }]} numberOfLines={1}>
                          {item.headline}
                        </Text>
                      ) : null}
                      <Text style={[styles.applicantDate, { color: colors.mutedForeground }]}>
                        Candidatou-se em {fmtDate(item.created_at)}
                      </Text>
                    </View>
                  </View>

                  {/* Message */}
                  {item.message ? (
                    <View style={[styles.applicantMsg, { backgroundColor: colors.background, borderRadius: 8 }]}>
                      <Text style={[{ color: colors.foreground, fontSize: 13, lineHeight: 18 }]}>
                        "{item.message}"
                      </Text>
                    </View>
                  ) : null}

                  {/* Actions */}
                  <View style={styles.applicantActions}>
                    {/* Status badge — tap to cycle */}
                    <TouchableOpacity
                      style={[styles.statusBadge, { backgroundColor: statusMeta.color + "20", borderColor: statusMeta.color }]}
                      onPress={() => handleStatusChange(item)}
                    >
                      <Text style={[styles.statusText, { color: statusMeta.color }]}>
                        {statusMeta.label}
                      </Text>
                      <Feather name="chevron-right" size={12} color={statusMeta.color} />
                    </TouchableOpacity>

                    {/* CV button */}
                    {item.cv_url ? (
                      <TouchableOpacity
                        style={[styles.cvBtn, { backgroundColor: colors.gold + "20", borderRadius: 8 }]}
                        onPress={() => Linking.openURL(item.cv_url!)}
                      >
                        <Feather name="file-text" size={14} color={colors.gold} />
                        <Text style={[styles.cvBtnText, { color: colors.gold }]}>Ver CV</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={[styles.cvBtn, { backgroundColor: colors.border + "40", borderRadius: 8 }]}>
                        <Feather name="file-text" size={14} color={colors.mutedForeground} />
                        <Text style={[styles.cvBtnText, { color: colors.mutedForeground }]}>Sem CV</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

// ─── Attendees Modal ─────────────────────────────────────────────────────────

interface AttendeesModalProps {
  event: API.CompanyAdminEvent | null;
  visible: boolean;
  onClose: () => void;
}

function AttendeesModal({ event, visible, onClose }: AttendeesModalProps) {
  const colors = useColors();
  const [attendees, setAttendees] = useState<API.AppEventAttendee[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !event) return;
    setLoading(true);
    API.fetchEventAttendees(event.id).then(data => {
      setAttendees(data);
      setLoading(false);
    });
  }, [visible, event?.id]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: colors.border, paddingTop: Platform.OS === "ios" ? 54 : 20 }]}>
          <TouchableOpacity onPress={onClose}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]} numberOfLines={1}>
              {event?.title}
            </Text>
            <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
              {attendees.length}{event?.capacity ? ` / ${event.capacity}` : ""} inscritos
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.gold} />
          </View>
        ) : attendees.length === 0 ? (
          <View style={styles.center}>
            <Feather name="calendar" size={40} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Nenhum inscrito ainda
            </Text>
          </View>
        ) : (
          <FlatList
            data={attendees}
            keyExtractor={a => a.id}
            contentContainerStyle={{ padding: 16, gap: 10 }}
            renderItem={({ item }) => (
              <View style={[styles.attendeeRow, { borderBottomColor: colors.border }]}>
                <Avatar uri={item.profile?.avatar_url} name={item.profile?.full_name ?? "?"} size={42} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.applicantName, { color: colors.foreground }]}>
                    {item.profile?.full_name ?? "Usuário"}
                  </Text>
                  {item.profile?.position ? (
                    <Text style={[styles.applicantHeadline, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {item.profile.position}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.attendeeDate, { color: colors.mutedForeground }]}>
                  {fmtDate(item.created_at)}
                </Text>
              </View>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

// ─── Main Admin Screen ────────────────────────────────────────────────────────

export default function CompanyAdminScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const { id: companyId, name: companyName } = useLocalSearchParams<{ id: string; name?: string }>();

  const [activeTab, setActiveTab] = useState<AdminTab>("vagas");
  const [loading, setLoading] = useState(false);

  const [vagas, setVagas]       = useState<API.CompanyAdminOpportunity[]>([]);
  const [anuncios, setAnuncios] = useState<API.CompanyAdminOpportunity[]>([]);
  const [eventos, setEventos]   = useState<API.CompanyAdminEvent[]>([]);

  // Modals
  const [selectedJob, setSelectedJob]         = useState<API.CompanyAdminOpportunity | null>(null);
  const [showApplicants, setShowApplicants]   = useState(false);
  const [selectedEvent, setSelectedEvent]     = useState<API.CompanyAdminEvent | null>(null);
  const [showAttendees, setShowAttendees]     = useState(false);

  const topPad = Platform.OS === "web" ? 0 : insets.top;

  const loadAll = useCallback(async () => {
    if (!companyId || !user?.id) return;
    setLoading(true);
    const [v, a, e] = await Promise.all([
      API.fetchCompanyOpportunities(companyId, user.id, "vaga"),
      API.fetchCompanyOpportunities(companyId, user.id, "marketplace"),
      API.fetchCompanyEvents(companyId, user.id),
    ]);
    setVagas(v);
    setAnuncios(a);
    setEventos(e);
    setLoading(false);
  }, [companyId, user?.id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleToggleJobActive = async (opp: API.CompanyAdminOpportunity) => {
    const ok = await API.toggleOpportunity(opp.id, !opp.is_active);
    if (ok) {
      setVagas(prev => prev.map(v => v.id === opp.id ? { ...v, is_active: !v.is_active } : v));
      setAnuncios(prev => prev.map(a => a.id === opp.id ? { ...a, is_active: !a.is_active } : a));
    }
  };

  const handleToggleSold = async (opp: API.CompanyAdminOpportunity, soldViaIbhub: boolean) => {
    const newSold = !opp.sold || !soldViaIbhub;
    const ok = await API.markOpportunitySold(opp.id, newSold, soldViaIbhub);
    if (ok) {
      setAnuncios(prev => prev.map(a =>
        a.id === opp.id ? { ...a, sold: newSold, sold_via_ibhub: soldViaIbhub && newSold } : a
      ));
    }
  };

  const openSoldMenu = (opp: API.CompanyAdminOpportunity) => {
    if (opp.sold) {
      Alert.alert(
        "Vendido",
        "Desmarcar como vendido?",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Desmarcar", onPress: () => API.markOpportunitySold(opp.id, false, false).then(ok => {
            if (ok) setAnuncios(prev => prev.map(a => a.id === opp.id ? { ...a, sold: false, sold_via_ibhub: false } : a));
          })},
        ]
      );
    } else {
      Alert.alert(
        "Marcar como vendido",
        "Como foi a venda?",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Vendido fora do ibhub", onPress: () => handleToggleSold(opp, false) },
          { text: "Vendido pelo ibhub", onPress: () => handleToggleSold(opp, true) },
        ]
      );
    }
  };

  // ── Stat card (small) ──────────────────────────────────────────────────────
  const StatBox = ({ icon, label, value, color }: { icon: string; label: string; value: number | string; color: string }) => (
    <View style={[styles.statBox, { backgroundColor: color + "15", borderColor: color + "30" }]}>
      <Feather name={icon as any} size={14} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );

  // ── Vaga row ───────────────────────────────────────────────────────────────
  const renderVaga = ({ item }: { item: API.CompanyAdminOpportunity }) => (
    <View style={[styles.card, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
      {/* Title + status */}
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>
            {item.title}
          </Text>
          {item.company ? (
            <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{item.company}</Text>
          ) : null}
          <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>
            Publicada em {fmtDate(item.created_at)}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.activeBadge, { backgroundColor: item.is_active ? "#2ecc71" + "20" : colors.border + "40" }]}
          onPress={() => handleToggleJobActive(item)}
        >
          <View style={[styles.activeDot, { backgroundColor: item.is_active ? "#2ecc71" : colors.mutedForeground }]} />
          <Text style={[styles.activeBadgeText, { color: item.is_active ? "#2ecc71" : colors.mutedForeground }]}>
            {item.is_active ? "Ativa" : "Inativa"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatBox icon="eye"   label="Views"       value={fmtCount(item.view_count ?? 0)}          color="#3498db" />
        <StatBox icon="users" label="Candidatos"  value={fmtCount(item.applications_count ?? 0)}  color={colors.gold} />
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={[styles.ctaBtn, { backgroundColor: colors.gold, borderRadius: 10 }]}
        onPress={() => { setSelectedJob(item); setShowApplicants(true); }}
      >
        <Feather name="user-check" size={15} color="#fff" />
        <Text style={styles.ctaBtnText}>
          Ver candidatos ({item.applications_count ?? 0})
        </Text>
      </TouchableOpacity>
    </View>
  );

  // ── Anúncio row ────────────────────────────────────────────────────────────
  const renderAnuncio = ({ item }: { item: API.CompanyAdminOpportunity }) => (
    <View style={[styles.card, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>
            {item.title}
          </Text>
          {item.price ? (
            <Text style={[styles.cardPrice, { color: colors.gold }]}>{item.price}</Text>
          ) : null}
          <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>
            Publicado em {fmtDate(item.created_at)}
          </Text>
        </View>
        {/* Sold badge */}
        <TouchableOpacity
          style={[
            styles.activeBadge,
            { backgroundColor: item.sold ? "#2ecc71" + "20" : colors.border + "40" }
          ]}
          onPress={() => openSoldMenu(item)}
        >
          <Feather name={item.sold ? "check-circle" : "circle"} size={12} color={item.sold ? "#2ecc71" : colors.mutedForeground} />
          <Text style={[styles.activeBadgeText, { color: item.sold ? "#2ecc71" : colors.mutedForeground }]}>
            {item.sold ? (item.sold_via_ibhub ? "Vendido ibhub" : "Vendido") : "Disponível"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatBox icon="eye"      label="Views"      value={fmtCount(item.view_count ?? 0)}        color="#3498db" />
        <StatBox icon="heart"    label="Interesses" value={fmtCount(item.interests_count ?? 0)}   color="#e74c3c" />
        <StatBox icon="message-circle" label="Msgs" value="—"                                     color="#8b5cf6" />
      </View>

      {/* Active toggle */}
      <TouchableOpacity
        style={[styles.secondaryBtn, { borderColor: colors.border }]}
        onPress={() => handleToggleJobActive(item)}
      >
        <Feather name={item.is_active ? "eye-off" : "eye"} size={14} color={colors.mutedForeground} />
        <Text style={[styles.secondaryBtnText, { color: colors.mutedForeground }]}>
          {item.is_active ? "Pausar anúncio" : "Reativar anúncio"}
        </Text>
      </TouchableOpacity>
    </View>
  );

  // ── Evento row ─────────────────────────────────────────────────────────────
  const renderEvento = ({ item }: { item: API.CompanyAdminEvent }) => {
    const pct = item.capacity && item.attendees_count
      ? Math.min(100, Math.round(((item.attendees_count ?? 0) / item.capacity) * 100))
      : null;

    return (
      <View style={[styles.card, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
              {item.location_type === "online" ? "Online" : item.location ?? ""}  ·  {fmtDate(item.start_date)}
            </Text>
            <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>
              Criado em {fmtDate(item.created_at)}
            </Text>
          </View>
          <View style={[styles.activeBadge, { backgroundColor: item.is_active ? "#2ecc71" + "20" : colors.border + "40" }]}>
            <View style={[styles.activeDot, { backgroundColor: item.is_active ? "#2ecc71" : colors.mutedForeground }]} />
            <Text style={[styles.activeBadgeText, { color: item.is_active ? "#2ecc71" : colors.mutedForeground }]}>
              {item.is_active ? "Ativo" : "Encerrado"}
            </Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatBox icon="user-check" label="Inscritos" value={item.attendees_count ?? 0}                                 color={colors.gold} />
          <StatBox icon="users"      label="Vagas"     value={item.capacity ? String(item.capacity) : "∞"}               color="#3498db" />
          {pct !== null && (
            <StatBox icon="percent"  label="Lotação"   value={`${pct}%`}                                                  color={pct > 80 ? "#e74c3c" : "#2ecc71"} />
          )}
        </View>

        {/* Capacity bar */}
        {pct !== null && (
          <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
            <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: pct > 80 ? "#e74c3c" : colors.gold }]} />
          </View>
        )}

        {/* CTA */}
        <TouchableOpacity
          style={[styles.ctaBtn, { backgroundColor: colors.gold, borderRadius: 10 }]}
          onPress={() => { setSelectedEvent(item); setShowAttendees(true); }}
        >
          <Feather name="calendar" size={15} color="#fff" />
          <Text style={styles.ctaBtnText}>
            Ver inscritos ({item.attendees_count ?? 0})
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ── Tabs ───────────────────────────────────────────────────────────────────
  const TABS: { key: AdminTab; label: string; icon: string; count: number }[] = [
    { key: "vagas",    label: "Vagas",    icon: "briefcase",   count: vagas.length },
    { key: "anuncios", label: "Anúncios", icon: "tag",         count: anuncios.length },
    { key: "eventos",  label: "Eventos",  icon: "calendar",    count: eventos.length },
  ];

  const currentData = activeTab === "vagas" ? vagas : activeTab === "anuncios" ? anuncios : eventos;
  const currentRender = activeTab === "vagas" ? renderVaga : activeTab === "anuncios" ? renderAnuncio : renderEvento;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Painel da Empresa
          </Text>
          {companyName ? (
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]} numberOfLines={1}>
              {companyName}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity onPress={loadAll}>
          <Feather name="refresh-cw" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.tabBar, { borderBottomColor: colors.border }]}
      >
        {TABS.map(tab => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabBtn, active && { borderBottomColor: colors.gold, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Feather name={tab.icon as any} size={14} color={active ? colors.gold : colors.mutedForeground} />
              <Text style={[styles.tabLabel, { color: active ? colors.gold : colors.mutedForeground }]}>
                {tab.label}
              </Text>
              <View style={[styles.tabBadge, { backgroundColor: active ? colors.gold : colors.border }]}>
                <Text style={[styles.tabBadgeText, { color: active ? "#fff" : colors.mutedForeground }]}>
                  {tab.count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground, marginTop: 10 }]}>
            Carregando dados...
          </Text>
        </View>
      ) : currentData.length === 0 ? (
        <View style={styles.center}>
          <Feather
            name={activeTab === "vagas" ? "briefcase" : activeTab === "anuncios" ? "tag" : "calendar"}
            size={48}
            color={colors.border}
          />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Nenhum{activeTab === "eventos" ? "" : "a"} {activeTab === "vagas" ? "vaga" : activeTab === "anuncios" ? "anúncio" : "evento"} ainda
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            {activeTab === "vagas"
              ? "Crie vagas e acompanhe os candidatos aqui."
              : activeTab === "anuncios"
              ? "Publique anúncios no Mercado e acompanhe o desempenho."
              : "Crie eventos e veja quem se inscreveu."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={currentData as any[]}
          keyExtractor={(item: any) => item.id}
          renderItem={currentRender as any}
          contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Applicants modal */}
      <ApplicantsModal
        opportunity={selectedJob}
        visible={showApplicants}
        onClose={() => { setShowApplicants(false); setSelectedJob(null); }}
      />

      {/* Attendees modal */}
      <AttendeesModal
        event={selectedEvent}
        visible={showAttendees}
        onClose={() => { setShowAttendees(false); setSelectedEvent(null); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1 },
  header:            { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle:       { fontSize: 18, fontWeight: "700" },
  headerSub:         { fontSize: 13 },
  tabBar:            { paddingHorizontal: 12, gap: 4, borderBottomWidth: 1 },
  tabBtn:            { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 12 },
  tabLabel:          { fontSize: 14, fontWeight: "600" },
  tabBadge:          { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  tabBadgeText:      { fontSize: 11, fontWeight: "700" },
  center:            { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 32 },
  emptyTitle:        { fontSize: 16, fontWeight: "700", textAlign: "center" },
  emptyText:         { fontSize: 14, textAlign: "center", lineHeight: 20 },
  card:              { borderRadius: 14, borderWidth: 1, padding: 14, gap: 12 },
  cardTop:           { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  cardTitle:         { fontSize: 15, fontWeight: "700", lineHeight: 20 },
  cardSub:           { fontSize: 13, marginTop: 2 },
  cardDate:          { fontSize: 12, marginTop: 2 },
  cardPrice:         { fontSize: 15, fontWeight: "700", marginTop: 2 },
  activeBadge:       { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 20 },
  activeDot:         { width: 7, height: 7, borderRadius: 4 },
  activeBadgeText:   { fontSize: 11, fontWeight: "700" },
  statsRow:          { flexDirection: "row", gap: 8 },
  statBox:           { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 10, borderWidth: 1, gap: 3 },
  statValue:         { fontSize: 15, fontWeight: "800" },
  statLabel:         { fontSize: 11 },
  ctaBtn:            { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 11 },
  ctaBtnText:        { fontSize: 14, fontWeight: "700", color: "#fff" },
  secondaryBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  secondaryBtnText:  { fontSize: 13, fontWeight: "600" },
  progressBar:       { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill:      { height: "100%", borderRadius: 3 },
  // modal
  modalContainer:    { flex: 1 },
  modalHeader:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  modalTitle:        { fontSize: 16, fontWeight: "700" },
  modalSub:          { fontSize: 13, marginTop: 2 },
  applicantCard:     { padding: 14, gap: 10 },
  applicantTop:      { flexDirection: "row", alignItems: "flex-start" },
  applicantName:     { fontSize: 15, fontWeight: "700" },
  applicantHeadline: { fontSize: 13, marginTop: 2 },
  applicantDate:     { fontSize: 11, marginTop: 2 },
  applicantMsg:      { padding: 10 },
  applicantActions:  { flexDirection: "row", gap: 10, alignItems: "center" },
  statusBadge:       { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  statusText:        { fontSize: 12, fontWeight: "700" },
  cvBtn:             { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7 },
  cvBtnText:         { fontSize: 13, fontWeight: "600" },
  attendeeRow:       { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1 },
  attendeeDate:      { fontSize: 12 },
});
