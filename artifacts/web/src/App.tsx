import React from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { PermissionsProvider } from "@/context/PermissionsContext";
import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import CadastroPage from "@/pages/CadastroPage";
import RecuperarSenhaPage from "@/pages/RecuperarSenhaPage";
import RedefinirSenhaPage from "@/pages/RedefinirSenhaPage";
import AuthCallbackPage from "@/pages/AuthCallbackPage";
import AppFeedPage from "@/pages/AppFeedPage";
import OportunidadesPage from "@/pages/app/OportunidadesPage";
import OportunidadeDetalhe from "@/pages/app/OportunidadeDetalhe";
import AdegaPage from "@/pages/app/AdegaPage";
import MercadoPage from "@/pages/app/MercadoPage";
import MensagensPage from "@/pages/app/MensagensPage";
import GruposPage from "@/pages/app/GruposPage";
import GrupoChatPage from "@/pages/app/GrupoChatPage";
import GrupoConfiguracoesPage from "@/pages/app/GrupoConfiguracoesPage";
import ItensSalvosPage from "@/pages/app/ItensSalvosPage";
import MeuPerfilPage from "@/pages/app/MeuPerfilPage";
import PerfilUsuarioPage from "@/pages/app/PerfilUsuarioPage";
import EmpresaPage from "@/pages/app/EmpresaPage";
import EventoDetalhe from "@/pages/app/EventoDetalhe";
import NotificacoesPage from "@/pages/app/NotificacoesPage";
import BuscaPage from "@/pages/app/BuscaPage";
import WineRankingPage from "@/pages/app/WineRankingPage";
import ConexoesPage from "@/pages/app/ConexoesPage";
import PostDetalhePage from "@/pages/app/PostDetalhePage";
import CertificacoesPage from "@/pages/app/CertificacoesPage";
import UsuariosBloqueadosPage from "@/pages/app/UsuariosBloqueadosPage";
import AnalyticsPage from "@/pages/app/AnalyticsPage";
import ReferralPage from "@/pages/app/ReferralPage";
import GerenciarEmpresaPage from "@/pages/app/GerenciarEmpresaPage";
import EmpresaAdminPage from "@/pages/app/EmpresaAdminPage";
import MeusEventosPage from "@/pages/app/MeusEventosPage";
import EventosPage from "@/pages/app/EventosPage";
import SettingsPage from "@/pages/app/SettingsPage";
import NotificationSettingsPage from "@/pages/app/NotificationSettingsPage";
import PrivacySegurancaPage from "@/pages/app/PrivacySegurancaPage";
import ReportarBugPage from "@/pages/app/ReportarBugPage";
import ContatoPage from "@/pages/app/ContatoPage";
import MeusReportsPage from "@/pages/app/MeusReportsPage";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminLogs from "@/pages/admin/AdminLogs";
import AdminModeracao from "@/pages/admin/AdminModeracao";
import AdminMomentos from "@/pages/admin/AdminMomentos";
import AdminEventos from "@/pages/admin/AdminEventos";
import AdminMarketplace from "@/pages/admin/AdminMarketplace";
import AdminSlidesMercado from "@/pages/admin/AdminSlidesMercado";
import AdminPresentationSlides from "@/pages/admin/AdminPresentationSlides";
import AdminCRM from "@/pages/admin/AdminCRM";
import AdminFinanceiro from "@/pages/admin/AdminFinanceiro";
import AdminPlanBuilder from "@/pages/admin/AdminPlanBuilder";
import AdminComunicacao from "@/pages/admin/AdminComunicacao";
import AdminAdmins from "@/pages/admin/AdminAdmins";
import AdminConfiguracoes from "@/pages/admin/AdminConfiguracoes";
import AssinarPage from "@/pages/AssinarPage";
import AssinarSucessoPage from "@/pages/AssinarSucessoPage";
import AssinarCanceladoPage from "@/pages/AssinarCanceladoPage";
import MinhaContaPage from "@/pages/MinhaContaPage";
import PoliticaPrivacidadePage from "@/pages/PoliticaPrivacidadePage";
import TermosUsoPage from "@/pages/TermosUsoPage";
import ExcluirContaPage from "@/pages/ExcluirContaPage";
import NotFound from "@/pages/not-found";
import PublicProfilePage from "@/pages/PublicProfilePage";
import PublicPostPage from "@/pages/PublicPostPage";
import SocialCompletePage from "@/pages/SocialCompletePage";
import { AdminShell } from "@/components/layout/AdminShell";
import { FeatureFlagsProvider, useFeatureFlags } from "@/context/FeatureFlagsContext";
import MaintenancePage from "@/pages/MaintenancePage";
import { supabase } from "@/lib/supabase";
import { useEffect } from "react";

const queryClient = new QueryClient();

function LoadingScreen() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0d1b2a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{
        width: 40, height: 40,
        border: "3px solid rgba(201,168,76,0.3)", borderTopColor: "#c9a84c",
        borderRadius: "50%", animation: "spin 1s linear infinite",
      }} />
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function PrivateRoute({ component: Component }: { component: React.ComponentType }) {
  const { session, loading, profileChecked, mustChangePassword, needsProfileCompletion } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      setLocation("/login");
    } else if (mustChangePassword && location !== "/redefinir-senha") {
      setLocation("/redefinir-senha");
    } else if (needsProfileCompletion && location !== "/completar-perfil") {
      setLocation("/completar-perfil");
    }
  }, [loading, session, profileChecked, mustChangePassword, needsProfileCompletion, location, setLocation]);

  // Show loading while: global loading OR session exists but profile hasn't been checked yet.
  // The second condition prevents a flash of app content for new OAuth users between SIGNED_IN
  // and the first fetchProfile resolution (window where needsProfileCompletion is falsely false).
  if (loading || (!!session && !profileChecked)) return <LoadingScreen />;
  if (!session) return null;
  if (mustChangePassword) return null;
  if (needsProfileCompletion) return null;

  return <Component />;
}

function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { session, profile, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      setLocation("/login");
    } else if (profile && !profile.is_admin) {
      setLocation("/app");
    }
  }, [loading, session, profile, setLocation]);

  if (loading) return <LoadingScreen />;
  if (!session) return null;
  if (!profile) return <LoadingScreen />;
  if (!profile.is_admin) return null;

  return <Component />;
}

function PublicOnlyRoute({ component: Component, showWhileLoading = false }: { component: React.ComponentType; showWhileLoading?: boolean }) {
  const { session, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && session) {
      setLocation("/app");
    }
  }, [loading, session, setLocation]);

  if (loading) return showWhileLoading ? <Component /> : null;
  if (session) return null;

  return <Component />;
}

function AdminNotFound() {
  return (
    <AdminShell>
      <div style={{ textAlign: "center", padding: "80px 24px" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>😕</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0d1b2a", margin: "0 0 8px" }}>Página não encontrada</h2>
        <p style={{ fontSize: 14, color: "#8a93a2" }}>Esta seção do admin não existe.</p>
      </div>
    </AdminShell>
  );
}

// Admin sub-routes — uses direct location comparison to avoid wouter Switch quirks
const ADMIN_SUB_ROUTES: Record<string, React.ComponentType> = {
  "/admin/logs":                  AdminLogs,
  "/admin/momentos":              AdminMomentos,
  "/admin/eventos":               AdminEventos,
  "/admin/marketplace":           AdminMarketplace,
  "/admin/slides-mercado":        AdminSlidesMercado,
  "/admin/presentation-slides":   AdminPresentationSlides,
  "/admin/moderacao":             AdminModeracao,
  "/admin/crm":                   AdminCRM,
  "/admin/financeiro":            AdminFinanceiro,
  "/admin/plan-builder":          AdminPlanBuilder,
  "/admin/comunicacao":           AdminComunicacao,
  "/admin/admins":                AdminAdmins,
  "/admin/configuracoes":         AdminConfiguracoes,
};

function AdminSubRouter() {
  const [location] = useLocation();
  const path = location.split("?")[0];
  const Component = ADMIN_SUB_ROUTES[path] ?? AdminNotFound;
  return <AdminRoute component={Component} />;
}

function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  const { isEnabled, isLoading } = useFeatureFlags();
  const { profile, loading, session } = useAuth();
  const [location] = useLocation();
  const manutencao = isEnabled("manutencao");

  // Auth paths that must remain reachable during maintenance so admins can sign in
  const isAuthPath = location === "/login" || location === "/cadastro" ||
    location === "/recuperar-senha" || location === "/redefinir-senha" ||
    location === "/auth/callback" || location.startsWith("/u/") || location.startsWith("/p/");

  useEffect(() => {
    if (loading || isLoading) return;
    if (!manutencao) return;
    if (!session) return;
    if (profile?.is_admin) return;
    // Non-admin authenticated user: sign out, they'll see MaintenancePage next render
    supabase.auth.signOut();
  }, [manutencao, isLoading, loading, session, profile?.is_admin]);

  if (loading || isLoading) return <LoadingScreen />;
  // Auth routes pass through regardless of maintenance (admin login path must work).
  // All other routes: block everyone except admins when maintenance is on.
  if (manutencao && !profile?.is_admin && !isAuthPath) {
    return <MaintenancePage />;
  }
  return <>{children}</>;
}

function Router() {
  return (
    <MaintenanceGuard>
    <Switch>
      <Route path="/">
        <PublicOnlyRoute component={LandingPage} showWhileLoading />
      </Route>
      <Route path="/login">
        <PublicOnlyRoute component={LoginPage} />
      </Route>
      <Route path="/cadastro">
        <PublicOnlyRoute component={CadastroPage} />
      </Route>
      <Route path="/recuperar-senha">
        <PublicOnlyRoute component={RecuperarSenhaPage} />
      </Route>
      <Route path="/redefinir-senha" component={RedefinirSenhaPage} />
      <Route path="/auth/callback" component={AuthCallbackPage} />
      <Route path="/completar-perfil" component={SocialCompletePage} />

      {/* App routes */}
      <Route path="/app/eventos/:id">
        <PrivateRoute component={EventoDetalhe} />
      </Route>
      {/* Literal sub-paths must come before :id wildcard */}
      <Route path="/app/oportunidades/vagas">
        <PrivateRoute component={OportunidadesPage} />
      </Route>
      <Route path="/app/oportunidades/eventos">
        <PrivateRoute component={OportunidadesPage} />
      </Route>
      <Route path="/app/oportunidades/:id">
        <PrivateRoute component={OportunidadeDetalhe} />
      </Route>
      <Route path="/app/oportunidades">
        <PrivateRoute component={OportunidadesPage} />
      </Route>
      <Route path="/app/adega">
        <PrivateRoute component={AdegaPage} />
      </Route>
      <Route path="/app/mercado">
        <PrivateRoute component={MercadoPage} />
      </Route>
      <Route path="/app/mensagens">
        <PrivateRoute component={MensagensPage} />
      </Route>
      <Route path="/app/grupos/:id/configuracoes">
        <PrivateRoute component={GrupoConfiguracoesPage} />
      </Route>
      <Route path="/app/grupos/:id">
        <PrivateRoute component={GrupoChatPage} />
      </Route>
      <Route path="/app/grupos">
        <PrivateRoute component={GruposPage} />
      </Route>
      <Route path="/app/notificacoes">
        <PrivateRoute component={NotificacoesPage} />
      </Route>
      <Route path="/app/busca">
        <PrivateRoute component={BuscaPage} />
      </Route>
      <Route path="/app/ranking-vinho">
        <PrivateRoute component={WineRankingPage} />
      </Route>
      <Route path="/app/conexoes">
        <PrivateRoute component={ConexoesPage} />
      </Route>
      <Route path="/app/posts/:id">
        <PrivateRoute component={PostDetalhePage} />
      </Route>
      <Route path="/app/certificacoes">
        <PrivateRoute component={CertificacoesPage} />
      </Route>
      <Route path="/app/bloqueados">
        <PrivateRoute component={UsuariosBloqueadosPage} />
      </Route>
      <Route path="/app/analytics">
        <PrivateRoute component={AnalyticsPage} />
      </Route>
      <Route path="/app/indicacoes">
        <PrivateRoute component={ReferralPage} />
      </Route>
      <Route path="/app/empresa/:id/editar">
        <PrivateRoute component={GerenciarEmpresaPage} />
      </Route>
      <Route path="/app/empresa/:id/admin">
        <PrivateRoute component={EmpresaAdminPage} />
      </Route>
      <Route path="/app/meus-eventos">
        <PrivateRoute component={MeusEventosPage} />
      </Route>
      <Route path="/app/eventos">
        <PrivateRoute component={EventosPage} />
      </Route>
      <Route path="/app/configuracoes/notificacoes">
        <PrivateRoute component={NotificationSettingsPage} />
      </Route>
      <Route path="/app/configuracoes/privacidade">
        <PrivateRoute component={PrivacySegurancaPage} />
      </Route>
      <Route path="/app/configuracoes/reportar-bug">
        <PrivateRoute component={ReportarBugPage} />
      </Route>
      <Route path="/app/configuracoes/contato">
        <PrivateRoute component={ContatoPage} />
      </Route>
      <Route path="/app/configuracoes/denuncias">
        <PrivateRoute component={MeusReportsPage} />
      </Route>
      <Route path="/app/configuracoes">
        <PrivateRoute component={SettingsPage} />
      </Route>
      <Route path="/app/salvos">
        <PrivateRoute component={ItensSalvosPage} />
      </Route>
      <Route path="/app/perfil">
        <PrivateRoute component={MeuPerfilPage} />
      </Route>
      <Route path="/app/usuario/:id">
        <PrivateRoute component={PerfilUsuarioPage} />
      </Route>
      <Route path="/app/empresa/:id">
        <PrivateRoute component={EmpresaPage} />
      </Route>
      <Route path="/app">
        <PrivateRoute component={AppFeedPage} />
      </Route>

      {/* Public pages — no auth required */}
      <Route path="/u/:id" component={PublicProfilePage} />
      <Route path="/p/:id" component={PublicPostPage} />
      <Route path="/politica-de-privacidade" component={PoliticaPrivacidadePage} />
      <Route path="/termos-de-uso" component={TermosUsoPage} />
      <Route path="/excluir-conta" component={ExcluirContaPage} />

      {/* Subscription & account */}
      <Route path="/assinar/sucesso" component={AssinarSucessoPage} />
      <Route path="/assinar/cancelado" component={AssinarCanceladoPage} />
      <Route path="/assinar">
        <AssinarPage />
      </Route>
      <Route path="/minha-conta">
        <PrivateRoute component={MinhaContaPage} />
      </Route>

      {/* Admin routes — AdminSubRouter uses direct location matching for reliability */}
      <Route path="/admin">
        <AdminRoute component={AdminDashboard} />
      </Route>
      <Route path="/admin/:rest*">
        <AdminSubRouter />
      </Route>

      <Route component={NotFound} />
    </Switch>
    </MaintenanceGuard>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <FeatureFlagsProvider>
          <PermissionsProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
          </PermissionsProvider>
        </FeatureFlagsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
