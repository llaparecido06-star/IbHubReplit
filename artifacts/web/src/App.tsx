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
import NotFound from "@/pages/not-found";
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
      <Route path="/app">
        <PrivateRoute component={AppFeedPage} />
      </Route>
      <Route path="/app/:rest*">
        <PrivateRoute component={AppFeedPage} />
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
