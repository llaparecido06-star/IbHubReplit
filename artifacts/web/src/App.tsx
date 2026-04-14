import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/context/AuthContext";
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
import ItensSalvosPage from "@/pages/app/ItensSalvosPage";
import MeuPerfilPage from "@/pages/app/MeuPerfilPage";
import EventoDetalhe from "@/pages/app/EventoDetalhe";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsuarios from "@/pages/admin/AdminUsuarios";
import AdminModeracao from "@/pages/admin/AdminModeracao";
import AdminNotificacoes from "@/pages/admin/AdminNotificacoes";
import AssinarPage from "@/pages/AssinarPage";
import AssinarSucessoPage from "@/pages/AssinarSucessoPage";
import AssinarCanceladoPage from "@/pages/AssinarCanceladoPage";
import MinhaContaPage from "@/pages/MinhaContaPage";
import NotFound from "@/pages/not-found";
import { AdminShell } from "@/components/layout/AdminShell";
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
  const { session, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !session) {
      setLocation("/login");
    }
  }, [loading, session, setLocation]);

  if (loading) return <LoadingScreen />;
  if (!session) return null;

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

function Router() {
  return (
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
      <Route path="/app/grupos">
        <PrivateRoute component={GruposPage} />
      </Route>
      <Route path="/app/salvos">
        <PrivateRoute component={ItensSalvosPage} />
      </Route>
      <Route path="/app/perfil">
        <PrivateRoute component={MeuPerfilPage} />
      </Route>
      <Route path="/app">
        <PrivateRoute component={AppFeedPage} />
      </Route>

      {/* Subscription & account */}
      <Route path="/assinar/sucesso" component={AssinarSucessoPage} />
      <Route path="/assinar/cancelado" component={AssinarCanceladoPage} />
      <Route path="/assinar">
        <AssinarPage />
      </Route>
      <Route path="/minha-conta">
        <PrivateRoute component={MinhaContaPage} />
      </Route>

      {/* Admin routes */}
      <Route path="/admin/usuarios">
        <AdminRoute component={AdminUsuarios} />
      </Route>
      <Route path="/admin/moderacao">
        <AdminRoute component={AdminModeracao} />
      </Route>
      <Route path="/admin/notificacoes">
        <AdminRoute component={AdminNotificacoes} />
      </Route>
      <Route path="/admin">
        <AdminRoute component={AdminDashboard} />
      </Route>
      {/* Catch-all for unknown /admin/* paths: enforce admin guard, show 404 inside admin shell */}
      <Route path="/admin/:rest*">
        <AdminRoute component={AdminNotFound} />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
