import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
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
import { useColors } from "@/hooks/useColors";
import * as API from "@/services/api";
import { maskDate } from "@/utils/masks";

type AdminTab = "vagas" | "anuncios" | "eventos";

const JOB_CATS       = ["Sommelier", "Enólogo", "Gerência", "Marketing", "Vendas", "Exportação", "Produção", "Outros"];
const MARKET_CATS    = ["Vinho", "Insumo", "Equipamento", "Serviço", "Outros"];
const CONTRACT_TYPES = ["CLT", "PJ", "Freelancer", "Estágio"];

function isoToDDMMYYYY(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function ddmmyyyyToISO(str: string): string | null {
  const parts = str.split("/");
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    const d = new Date(`${yyyy}-${mm}-${dd}`);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

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
  const { t } = useTranslation();
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
        <View style={[styles.modalHeader, { borderBottomColor: colors.border, paddingTop: Platform.OS === "ios" ? 54 : 20 }]}>
          <TouchableOpacity onPress={onClose}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]} numberOfLines={1}>
              {opportunity?.title}
            </Text>
            <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
              {t("empresa_admin_screen.applicants_count", { count: applicants.length })}
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
              {t("empresa_admin_screen.applicants_empty")}
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
                        {t("empresa_admin_screen.applied_on", { date: fmtDate(item.created_at) })}
                      </Text>
                    </View>
                  </View>

                  {item.message ? (
                    <View style={[styles.applicantMsg, { backgroundColor: colors.background, borderRadius: 8 }]}>
                      <Text style={[{ color: colors.foreground, fontSize: 13, lineHeight: 18 }]}>
                        "{item.message}"
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.applicantActions}>
                    <TouchableOpacity
                      style={[styles.statusBadge, { backgroundColor: statusMeta.color + "20", borderColor: statusMeta.color }]}
                      onPress={() => handleStatusChange(item)}
                    >
                      <Text style={[styles.statusText, { color: statusMeta.color }]}>
                        {t(`empresa_admin_screen.status_${item.status}`, { defaultValue: statusMeta.label })}
                      </Text>
                      <Feather name="chevron-right" size={12} color={statusMeta.color} />
                    </TouchableOpacity>

                    {item.cv_url ? (
                      <TouchableOpacity
                        style={[styles.cvBtn, { backgroundColor: colors.gold + "20", borderRadius: 8 }]}
                        onPress={async () => {
                          const url = await API.getCvSignedUrl(item.cv_url!, { applicationId: item.id });
                          if (url) {
                            Linking.openURL(url);
                          } else {
                            Alert.alert(t("empresa_admin_screen.cv_error_title"), t("empresa_admin_screen.cv_error_msg"));
                          }
                        }}
                      >
                        <Feather name="file-text" size={14} color={colors.gold} />
                        <Text style={[styles.cvBtnText, { color: colors.gold }]}>{t("empresa_admin_screen.see_cv")}</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={[styles.cvBtn, { backgroundColor: colors.border + "40", borderRadius: 8 }]}>
                        <Feather name="file-text" size={14} color={colors.mutedForeground} />
                        <Text style={[styles.cvBtnText, { color: colors.mutedForeground }]}>{t("empresa_admin_screen.no_cv")}</Text>
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
  const { t } = useTranslation();
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
              {t("empresa_admin_screen.attendees_count", { count: attendees.length })}{event?.capacity ? ` / ${event.capacity}` : ""}
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
              {t("empresa_admin_screen.attendees_empty")}
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

// ─── Edit Opportunity Modal ──────────────────────────────────────────────────

interface EditOppModalProps {
  opp: API.CompanyAdminOpportunity | null;
  visible: boolean;
  onClose: () => void;
  onSaved: (updated: Partial<API.CompanyAdminOpportunity>) => void;
}

function EditOppModal({ opp, visible, onClose, onSaved }: EditOppModalProps) {
  const colors = useColors();
  const { t } = useTranslation();
  const isMarket = opp?.type === "marketplace";
  const catOptions = isMarket ? MARKET_CATS : JOB_CATS;

  const [title,    setTitle]    = useState("");
  const [desc,     setDesc]     = useState("");
  const [money,    setMoney]    = useState("");
  const [location, setLocation] = useState("");
  const [contact,  setContact]  = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [contract, setContract] = useState<string | null>(null);
  const [company,  setCompany]  = useState("");
  const [expiry,   setExpiry]   = useState("");
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    if (opp) {
      setTitle(opp.title);
      setDesc(opp.description ?? "");
      setMoney(isMarket ? (opp.price ?? "") : (opp.salary ?? ""));
      setLocation(opp.location ?? "");
      setContact(opp.contact_email ?? "");
      setCategory(opp.category ?? null);
      setContract(opp.contract_type ?? null);
      setCompany(opp.company ?? "");
      setExpiry(isoToDDMMYYYY(opp.expires_at));
    }
  }, [opp?.id, visible]);

  const handleSave = async () => {
    if (!opp || !title.trim()) return;
    setSaving(true);
    const trimmedExpiry = expiry.trim();
    const expiresIso = trimmedExpiry ? ddmmyyyyToISO(trimmedExpiry) : null;
    if (trimmedExpiry && !expiresIso) {
      setSaving(false);
      Alert.alert(t("empresa_admin_screen.invalid_date_title"), t("empresa_admin_screen.invalid_date_msg"));
      return;
    }
    const baseFields: Record<string, unknown> = {
      title: title.trim(),
      description: desc.trim() || null,
      category: category ?? null,
      location: location.trim() || null,
      contact_email: contact.trim() || null,
      expires_at: expiresIso,
    };
    if (isMarket) {
      baseFields.price = money.trim() || null;
    } else {
      baseFields.salary = money.trim() || null;
      baseFields.contract_type = contract ?? null;
      baseFields.company = company.trim() || null;
    }
    const ok = await API.updateOpportunity(opp.id, baseFields as Parameters<typeof API.updateOpportunity>[1]);
    setSaving(false);
    if (ok) {
      onSaved(baseFields as Partial<API.CompanyAdminOpportunity>);
      onClose();
    } else {
      Alert.alert(t("empresa_admin_screen.save_error_title"), t("empresa_admin_screen.save_error_msg"));
    }
  };

  const renderChips = (options: string[], selected: string | null, onSelect: (v: string) => void) => (
    <View style={styles.chipWrap}>
      {options.map(opt => {
        const active = selected === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={[
              styles.chip,
              { borderColor: active ? colors.gold : colors.border,
                backgroundColor: active ? colors.gold + "20" : colors.background },
            ]}
            onPress={() => onSelect(opt)}
          >
            <Text style={{ color: active ? colors.gold : colors.foreground, fontSize: 13, fontWeight: active ? "700" : "400" }}>
              {opt}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border, paddingTop: Platform.OS === "ios" ? 54 : 20 }]}>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground, flex: 1, marginLeft: 12 }]}>
              {isMarket ? t("empresa_admin_screen.edit_opp_title_ad") : t("empresa_admin_screen.edit_opp_title_job")}
            </Text>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.gold, opacity: saving ? 0.6 : 1 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.saveBtnText}>{t("empresa_admin_screen.save_btn")}</Text>
              }
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                {t("empresa_admin_screen.field_title_label")}
              </Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
                value={title}
                onChangeText={setTitle}
                placeholder={t("empresa_admin_screen.field_title_placeholder_ad")}
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{t("empresa_admin_screen.field_category")}</Text>
              {renderChips(catOptions, category, setCategory)}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                {t("empresa_admin_screen.field_description")}
              </Text>
              <TextInput
                style={[styles.textInput, styles.textArea, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
                value={desc}
                onChangeText={setDesc}
                placeholder={t("empresa_admin_screen.field_description_placeholder_ad")}
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={4}
              />
            </View>

            {!isMarket ? (
              <>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{t("empresa_admin_screen.field_contract_type")}</Text>
                  {renderChips(CONTRACT_TYPES, contract, setContract)}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{t("empresa_admin_screen.field_company")}</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
                    value={company}
                    onChangeText={setCompany}
                    placeholder={t("empresa_admin_screen.field_company_placeholder")}
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>
              </>
            ) : null}

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                {isMarket ? t("empresa_admin_screen.field_price") : t("empresa_admin_screen.field_salary")}
              </Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
                value={money}
                onChangeText={setMoney}
                placeholder={isMarket ? t("empresa_admin_screen.field_price_placeholder") : t("empresa_admin_screen.field_salary_placeholder")}
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{t("empresa_admin_screen.field_location")}</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
                value={location}
                onChangeText={setLocation}
                placeholder={t("empresa_admin_screen.field_location_placeholder")}
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{t("empresa_admin_screen.field_expiry")}</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
                value={expiry}
                onChangeText={(v) => setExpiry(maskDate(v))}
                placeholder={t("empresa_admin_screen.field_expiry_placeholder")}
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                maxLength={10}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{t("empresa_admin_screen.field_email")}</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
                value={contact}
                onChangeText={setContact}
                placeholder={t("empresa_admin_screen.field_email_placeholder")}
                placeholderTextColor={colors.mutedForeground}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Edit Event Modal ─────────────────────────────────────────────────────────

interface EditEventModalProps {
  event: API.CompanyAdminEvent | null;
  visible: boolean;
  onClose: () => void;
  onSaved: (updated: Partial<API.CompanyAdminEvent>) => void;
}

function EditEventModal({ event, visible, onClose, onSaved }: EditEventModalProps) {
  const colors = useColors();
  const { t } = useTranslation();

  const [title,    setTitle]    = useState("");
  const [desc,     setDesc]     = useState("");
  const [location, setLocation] = useState("");
  const [capacity, setCapacity] = useState("");
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDesc(event.description ?? "");
      setLocation(event.location ?? "");
      setCapacity(event.capacity ? String(event.capacity) : "");
    }
  }, [event?.id, visible]);

  const handleSave = async () => {
    if (!event || !title.trim()) return;
    setSaving(true);
    const fields = {
      title: title.trim(),
      description: desc.trim() || undefined,
      location: location.trim() || undefined,
      capacity: capacity.trim() ? parseInt(capacity.trim(), 10) : undefined,
    };
    const ok = await API.updateEvent(event.id, fields);
    setSaving(false);
    if (ok) {
      onSaved({ ...fields });
      onClose();
    } else {
      Alert.alert(t("empresa_admin_screen.save_error_title"), t("empresa_admin_screen.save_error_msg"));
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border, paddingTop: Platform.OS === "ios" ? 54 : 20 }]}>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground, flex: 1, marginLeft: 12 }]}>
              {t("empresa_admin_screen.edit_event_title")}
            </Text>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.gold, opacity: saving ? 0.6 : 1 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.saveBtnText}>{t("empresa_admin_screen.save_btn")}</Text>
              }
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{t("empresa_admin_screen.field_event_title_label")}</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
                value={title}
                onChangeText={setTitle}
                placeholder={t("empresa_admin_screen.field_event_title_placeholder")}
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{t("empresa_admin_screen.field_description")}</Text>
              <TextInput
                style={[styles.textInput, styles.textArea, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
                value={desc}
                onChangeText={setDesc}
                placeholder={t("empresa_admin_screen.field_event_description_placeholder")}
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{t("empresa_admin_screen.field_event_location")}</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
                value={location}
                onChangeText={setLocation}
                placeholder={t("empresa_admin_screen.field_event_location_placeholder")}
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{t("empresa_admin_screen.field_event_capacity")}</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
                value={capacity}
                onChangeText={setCapacity}
                placeholder={t("empresa_admin_screen.field_event_capacity_placeholder")}
                placeholderTextColor={colors.mutedForeground}
                keyboardType="number-pad"
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main Admin Screen ────────────────────────────────────────────────────────

export default function CompanyAdminScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const { id: companyId, name: companyName } = useLocalSearchParams<{ id: string; name?: string }>();

  const [activeTab, setActiveTab] = useState<AdminTab>("vagas");
  const [loading, setLoading] = useState(false);

  const [vagas,    setVagas]    = useState<API.CompanyAdminOpportunity[]>([]);
  const [anuncios, setAnuncios] = useState<API.CompanyAdminOpportunity[]>([]);
  const [eventos,  setEventos]  = useState<API.CompanyAdminEvent[]>([]);

  const [selectedJob,      setSelectedJob]      = useState<API.CompanyAdminOpportunity | null>(null);
  const [showApplicants,   setShowApplicants]   = useState(false);
  const [selectedEvent,    setSelectedEvent]    = useState<API.CompanyAdminEvent | null>(null);
  const [showAttendees,    setShowAttendees]    = useState(false);
  const [editingOpp,       setEditingOpp]       = useState<API.CompanyAdminOpportunity | null>(null);
  const [editingEvent,     setEditingEvent]     = useState<API.CompanyAdminEvent | null>(null);

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

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleToggleOppActive = async (opp: API.CompanyAdminOpportunity) => {
    const ok = await API.toggleOpportunity(opp.id, !opp.is_active);
    if (ok) {
      setVagas(prev    => prev.map(v => v.id === opp.id ? { ...v, is_active: !v.is_active } : v));
      setAnuncios(prev => prev.map(a => a.id === opp.id ? { ...a, is_active: !a.is_active } : a));
    }
  };

  const handleToggleEventActive = async (event: API.CompanyAdminEvent) => {
    const ok = await API.updateEvent(event.id, { is_active: !event.is_active });
    if (ok) setEventos(prev => prev.map(e => e.id === event.id ? { ...e, is_active: !e.is_active } : e));
  };

  const handleDeleteOpp = (opp: API.CompanyAdminOpportunity) => {
    Alert.alert(
      t("empresa_admin_screen.delete_opp_title"),
      t("empresa_admin_screen.delete_opp_msg", { title: opp.title }),
      [
        { text: t("empresa_admin_screen.cancel"), style: "cancel" },
        { text: t("empresa_admin_screen.delete_btn"), style: "destructive", onPress: async () => {
          const ok = await API.deleteOpportunityById(opp.id);
          if (ok) {
            setVagas(prev    => prev.filter(v => v.id !== opp.id));
            setAnuncios(prev => prev.filter(a => a.id !== opp.id));
          }
        }},
      ]
    );
  };

  const handleDeleteEvent = (event: API.CompanyAdminEvent) => {
    Alert.alert(
      t("empresa_admin_screen.delete_event_title"),
      t("empresa_admin_screen.delete_event_msg", { title: event.title }),
      [
        { text: t("empresa_admin_screen.cancel"), style: "cancel" },
        { text: t("empresa_admin_screen.delete_btn"), style: "destructive", onPress: async () => {
          const ok = await API.deleteEventById(event.id);
          if (ok) setEventos(prev => prev.filter(e => e.id !== event.id));
        }},
      ]
    );
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
        t("empresa_admin_screen.sold_title"),
        t("empresa_admin_screen.sold_unmark_msg"),
        [
          { text: t("empresa_admin_screen.cancel"), style: "cancel" },
          { text: t("empresa_admin_screen.sold_unmark_btn"), onPress: () => API.markOpportunitySold(opp.id, false, false).then(ok => {
            if (ok) setAnuncios(prev => prev.map(a => a.id === opp.id ? { ...a, sold: false, sold_via_ibhub: false } : a));
          })},
        ]
      );
    } else {
      Alert.alert(
        t("empresa_admin_screen.mark_sold_title"),
        t("empresa_admin_screen.mark_sold_msg"),
        [
          { text: t("empresa_admin_screen.cancel"), style: "cancel" },
          { text: t("empresa_admin_screen.sold_outside"), onPress: () => handleToggleSold(opp, false) },
          { text: t("empresa_admin_screen.sold_via_ibhub"), onPress: () => handleToggleSold(opp, true) },
        ]
      );
    }
  };

  // ── Stat box ───────────────────────────────────────────────────────────────

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
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>
            {item.title}
          </Text>
          {item.company ? (
            <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{item.company}</Text>
          ) : null}
          {item.location ? (
            <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{item.location}</Text>
          ) : null}
          <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>
            {t("empresa_admin_screen.published_on", { date: fmtDate(item.created_at) })}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.activeBadge, { backgroundColor: item.is_active ? "#2ecc71" + "20" : colors.border + "40" }]}
          onPress={() => handleToggleOppActive(item)}
        >
          <View style={[styles.activeDot, { backgroundColor: item.is_active ? "#2ecc71" : colors.mutedForeground }]} />
          <Text style={[styles.activeBadgeText, { color: item.is_active ? "#2ecc71" : colors.mutedForeground }]}>
            {item.is_active ? t("empresa_admin_screen.active") : t("empresa_admin_screen.inactive")}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <StatBox icon="eye"   label={t("empresa_admin_screen.stat_views")}      value={fmtCount(item.view_count ?? 0)}         color="#3498db" />
        <StatBox icon="users" label={t("empresa_admin_screen.stat_candidates")} value={fmtCount(item.applications_count ?? 0)} color={colors.gold} />
      </View>

      <TouchableOpacity
        style={[styles.ctaBtn, { backgroundColor: colors.gold, borderRadius: 10 }]}
        onPress={() => { setSelectedJob(item); setShowApplicants(true); }}
      >
        <Feather name="user-check" size={15} color="#fff" />
        <Text style={styles.ctaBtnText}>
          {t("empresa_admin_screen.see_candidates", { count: item.applications_count ?? 0 })}
        </Text>
      </TouchableOpacity>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtn, { borderColor: colors.border, flex: 1 }]}
          onPress={() => setEditingOpp(item)}
        >
          <Feather name="edit-2" size={13} color={colors.mutedForeground} />
          <Text style={[styles.actionBtnText, { color: colors.mutedForeground }]}>{t("empresa_admin_screen.edit_btn")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { borderColor: colors.border, flex: 1 }]}
          onPress={() => handleToggleOppActive(item)}
        >
          <Feather name={item.is_active ? "pause-circle" : "play-circle"} size={13} color={colors.mutedForeground} />
          <Text style={[styles.actionBtnText, { color: colors.mutedForeground }]}>
            {item.is_active ? t("empresa_admin_screen.close_btn") : t("empresa_admin_screen.reactivate_btn")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { borderColor: "#fee2e2", flex: 1 }]}
          onPress={() => handleDeleteOpp(item)}
        >
          <Feather name="trash-2" size={13} color="#e74c3c" />
          <Text style={[styles.actionBtnText, { color: "#e74c3c" }]}>{t("empresa_admin_screen.delete_btn_label")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── Anúncio row ────────────────────────────────────────────────────────────

  const renderAnuncio = ({ item }: { item: API.CompanyAdminOpportunity }) => (
    <View style={[styles.card, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
      <View style={styles.cardTop}>
        <View style={[styles.anuncioThumb, { backgroundColor: colors.background, borderColor: colors.border }]}>
          {item.cover_image_url ? (
            <Image
              source={{ uri: item.cover_image_url }}
              style={styles.anuncioThumbImg}
              resizeMode="cover"
            />
          ) : (
            <Feather name="image" size={22} color={colors.mutedForeground} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>
            {item.title}
          </Text>
          {item.price ? (
            <Text style={[styles.cardPrice, { color: colors.gold }]}>{item.price}</Text>
          ) : null}
          <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>
            {t("empresa_admin_screen.published_on_ad", { date: fmtDate(item.created_at) })}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.activeBadge, { backgroundColor: item.sold ? "#2ecc71" + "20" : colors.border + "40" }]}
          onPress={() => openSoldMenu(item)}
        >
          <Feather name={item.sold ? "check-circle" : "circle"} size={12} color={item.sold ? "#2ecc71" : colors.mutedForeground} />
          <Text style={[styles.activeBadgeText, { color: item.sold ? "#2ecc71" : colors.mutedForeground }]}>
            {item.sold ? (item.sold_via_ibhub ? t("empresa_admin_screen.sold_ibhub_label") : t("empresa_admin_screen.sold_label")) : t("empresa_admin_screen.available")}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <StatBox icon="eye"   label={t("empresa_admin_screen.stat_views")}     value={fmtCount(item.view_count ?? 0)}       color="#3498db" />
        <StatBox icon="heart" label={t("empresa_admin_screen.stat_interests")} value={fmtCount(item.interests_count ?? 0)}  color="#e74c3c" />
        <StatBox icon="tag"   label={t("empresa_admin_screen.stat_status")}    value={item.is_active ? t("empresa_admin_screen.event_active") : t("empresa_admin_screen.event_closed")} color={item.is_active ? "#2ecc71" : "#9ca3af"} />
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtn, { borderColor: colors.border, flex: 1 }]}
          onPress={() => setEditingOpp(item)}
        >
          <Feather name="edit-2" size={13} color={colors.mutedForeground} />
          <Text style={[styles.actionBtnText, { color: colors.mutedForeground }]}>{t("empresa_admin_screen.edit_btn")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { borderColor: colors.border, flex: 1 }]}
          onPress={() => handleToggleOppActive(item)}
        >
          <Feather name={item.is_active ? "pause-circle" : "play-circle"} size={13} color={colors.mutedForeground} />
          <Text style={[styles.actionBtnText, { color: colors.mutedForeground }]}>
            {item.is_active ? t("empresa_admin_screen.pause_btn") : t("empresa_admin_screen.reactivate_btn")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { borderColor: "#fee2e2", flex: 1 }]}
          onPress={() => handleDeleteOpp(item)}
        >
          <Feather name="trash-2" size={13} color="#e74c3c" />
          <Text style={[styles.actionBtnText, { color: "#e74c3c" }]}>{t("empresa_admin_screen.delete_btn_label")}</Text>
        </TouchableOpacity>
      </View>
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
              {item.location_type === "online" ? "Online" : item.location ?? ""}{item.start_date ? `  ·  ${fmtDate(item.start_date)}` : ""}
            </Text>
            <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>
              {t("empresa_admin_screen.created_on", { date: fmtDate(item.created_at) })}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.activeBadge, { backgroundColor: item.is_active ? "#2ecc71" + "20" : colors.border + "40" }]}
            onPress={() => handleToggleEventActive(item)}
          >
            <View style={[styles.activeDot, { backgroundColor: item.is_active ? "#2ecc71" : colors.mutedForeground }]} />
            <Text style={[styles.activeBadgeText, { color: item.is_active ? "#2ecc71" : colors.mutedForeground }]}>
              {item.is_active ? t("empresa_admin_screen.event_active") : t("empresa_admin_screen.event_closed")}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <StatBox icon="user-check" label={t("empresa_admin_screen.stat_enrolled")}  value={item.attendees_count ?? 0}                color={colors.gold} />
          <StatBox icon="users"      label={t("empresa_admin_screen.stat_slots")}     value={item.capacity ? String(item.capacity) : "∞"} color="#3498db" />
          {pct !== null && (
            <StatBox icon="percent"  label={t("empresa_admin_screen.stat_occupancy")} value={`${pct}%`}                                   color={pct > 80 ? "#e74c3c" : "#2ecc71"} />
          )}
        </View>

        {pct !== null && (
          <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
            <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: pct > 80 ? "#e74c3c" : colors.gold }]} />
          </View>
        )}

        <TouchableOpacity
          style={[styles.ctaBtn, { backgroundColor: colors.gold, borderRadius: 10 }]}
          onPress={() => { setSelectedEvent(item); setShowAttendees(true); }}
        >
          <Feather name="calendar" size={15} color="#fff" />
          <Text style={styles.ctaBtnText}>
            {t("empresa_admin_screen.see_enrolled", { count: item.attendees_count ?? 0 })}
          </Text>
        </TouchableOpacity>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: colors.border, flex: 1 }]}
            onPress={() => setEditingEvent(item)}
          >
            <Feather name="edit-2" size={13} color={colors.mutedForeground} />
            <Text style={[styles.actionBtnText, { color: colors.mutedForeground }]}>{t("empresa_admin_screen.edit_btn")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: colors.border, flex: 1 }]}
            onPress={() => handleToggleEventActive(item)}
          >
            <Feather name={item.is_active ? "pause-circle" : "play-circle"} size={13} color={colors.mutedForeground} />
            <Text style={[styles.actionBtnText, { color: colors.mutedForeground }]}>
              {item.is_active ? t("empresa_admin_screen.close_btn") : t("empresa_admin_screen.reactivate_btn")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: "#fee2e2", flex: 1 }]}
            onPress={() => handleDeleteEvent(item)}
          >
            <Feather name="trash-2" size={13} color="#e74c3c" />
            <Text style={[styles.actionBtnText, { color: "#e74c3c" }]}>{t("empresa_admin_screen.delete_btn_label")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ── Tabs ───────────────────────────────────────────────────────────────────

  const TABS: { key: AdminTab; label: string; icon: string; count: number }[] = [
    { key: "vagas",    label: t("empresa_admin_screen.tab_vagas"),    icon: "briefcase", count: vagas.length },
    { key: "anuncios", label: t("empresa_admin_screen.tab_anuncios"), icon: "tag",       count: anuncios.length },
    { key: "eventos",  label: t("empresa_admin_screen.tab_eventos"),  icon: "calendar",  count: eventos.length },
  ];

  const currentData   = activeTab === "vagas" ? vagas   : activeTab === "anuncios" ? anuncios : eventos;
  const currentRender = activeTab === "vagas" ? renderVaga : activeTab === "anuncios" ? renderAnuncio : renderEvento;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="arrow-left" size={20} color={colors.navy} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.navy }]}>
            {t("empresa_admin_screen.header_title")}
          </Text>
          {companyName ? (
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]} numberOfLines={1}>
              {companyName}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity style={[styles.refreshBtn, { backgroundColor: colors.navy + "10" }]} onPress={loadAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="refresh-cw" size={15} color={colors.navy} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabChips}
      >
        {TABS.map(tab => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tabChip,
                {
                  backgroundColor: active ? colors.gold : colors.background,
                  borderColor:     active ? colors.gold : colors.border,
                },
              ]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.75}
            >
              <Feather name={tab.icon as any} size={13} color={active ? "#fff" : colors.mutedForeground} />
              <Text style={[styles.tabChipLabel, { color: active ? "#fff" : colors.mutedForeground }]}>
                {tab.label}
              </Text>
              <View style={[styles.tabChipBadge, { backgroundColor: active ? "rgba(255,255,255,0.28)" : colors.border + "80" }]}>
                <Text style={[styles.tabChipBadgeText, { color: active ? "#fff" : colors.mutedForeground }]}>
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
            {t("empresa_admin_screen.loading")}
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
            {activeTab === "vagas" ? t("empresa_admin_screen.empty_vagas_title") : activeTab === "anuncios" ? t("empresa_admin_screen.empty_anuncios_title") : t("empresa_admin_screen.empty_eventos_title")}
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            {activeTab === "vagas"
              ? t("empresa_admin_screen.empty_vagas_text")
              : activeTab === "anuncios"
              ? t("empresa_admin_screen.empty_anuncios_text")
              : t("empresa_admin_screen.empty_eventos_text")}
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

      {/* Edit opportunity modal */}
      <EditOppModal
        opp={editingOpp}
        visible={!!editingOpp}
        onClose={() => setEditingOpp(null)}
        onSaved={(updated) => {
          if (!editingOpp) return;
          setVagas(prev    => prev.map(v => v.id === editingOpp.id ? { ...v, ...updated } : v));
          setAnuncios(prev => prev.map(a => a.id === editingOpp.id ? { ...a, ...updated } : a));
        }}
      />

      {/* Edit event modal */}
      <EditEventModal
        event={editingEvent}
        visible={!!editingEvent}
        onClose={() => setEditingEvent(null)}
        onSaved={(updated) => {
          if (!editingEvent) return;
          setEventos(prev => prev.map(e => e.id === editingEvent.id ? { ...e, ...updated } : e));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1 },
  header:            { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn:           { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  refreshBtn:        { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  headerTitle:       { fontSize: 22, fontWeight: "800" },
  headerSub:         { fontSize: 12, marginTop: 1 },
  tabChips:          { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 12, gap: 8, paddingRight: 24 },
  tabChip:           { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  tabChipLabel:      { fontSize: 13, fontWeight: "600" },
  tabChipBadge:      { minWidth: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  tabChipBadgeText:  { fontSize: 11, fontWeight: "700" },
  center:            { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 32 },
  emptyTitle:        { fontSize: 16, fontWeight: "700", textAlign: "center" },
  emptyText:         { fontSize: 14, textAlign: "center", lineHeight: 20 },
  card:              { borderRadius: 14, borderWidth: 1, padding: 14, gap: 12 },
  cardTop:           { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  cardTitle:         { fontSize: 15, fontWeight: "700", lineHeight: 20 },
  anuncioThumb:      { width: 56, height: 56, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  anuncioThumbImg:   { width: "100%", height: "100%" },
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
  actionRow:         { flexDirection: "row", gap: 8 },
  actionBtn:         { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  actionBtnText:     { fontSize: 12, fontWeight: "600" },
  progressBar:       { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill:      { height: "100%", borderRadius: 3 },
  // modal
  modalContainer:    { flex: 1 },
  modalHeader:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  modalTitle:        { fontSize: 16, fontWeight: "700" },
  modalSub:          { fontSize: 13, marginTop: 2 },
  saveBtn:           { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20 },
  saveBtnText:       { fontSize: 14, fontWeight: "700", color: "#fff" },
  // edit form
  fieldGroup:        { gap: 6 },
  fieldLabel:        { fontSize: 12, fontWeight: "600", letterSpacing: 0.3, textTransform: "uppercase" },
  textInput:         { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  textArea:          { minHeight: 100, textAlignVertical: "top", paddingTop: 10 },
  chipWrap:          { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip:              { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  // applicants
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
