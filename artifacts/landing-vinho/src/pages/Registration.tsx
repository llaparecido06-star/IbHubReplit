import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Target, Database, TrendingUp, Users } from "lucide-react";

export default function Registration() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate processing
    setTimeout(() => {
      setLocation("/confirmacao");
    }, 800);
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 font-sans">
      <main className="max-w-6xl mx-auto px-6 pt-20 pb-24 md:pt-32 md:pb-32">
        {/* Header Section */}
        <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary uppercase tracking-widest mb-8">
            INTELIGÊNCIA ESTRATÉGICA PARA O MERCADO DE VINHOS
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 max-w-4xl mx-auto leading-[1.1]">
            O FUTURO NO MERCADO DE VINHOS
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            O que está acontecendo no mercado hoje e como isso impacta suas decisões.
          </p>
        </div>

        {/* Event Meta */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12 mb-24 text-sm font-medium tracking-wide text-muted-foreground animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-150 fill-mode-forwards">
          <div className="flex items-center gap-2 text-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
            18 DE MAIO / SEGUNDA-FEIRA
          </div>
          <div className="hidden md:block w-px h-4 bg-border"></div>
          <div className="flex items-center gap-2 text-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
            20H00 / DURAÇÃO: 60 MINUTOS
          </div>
          <div className="hidden md:block w-px h-4 bg-border"></div>
          <div className="flex items-center gap-2 text-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
            EVENTO FECHADO / APENAS PARA MEMBROS DA COMUNIDADE
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300 fill-mode-forwards">
          {/* Left Content */}
          <div className="lg:col-span-7 space-y-10">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-6">
                PARTICIPE E RECEBA O MATERIAL PREPARATÓRIO
              </h2>
              <div className="prose prose-invert prose-lg text-muted-foreground">
                <p>
                  Ao se inscrever, você receberá imediatamente a <strong>Parte 1 do Raio-X do Mercado de Vinhos 2026</strong>.
                </p>
                <p>
                  Um material estratégico com a base da nossa leitura de mercado.
                </p>
                <p className="text-foreground font-semibold border-l-2 border-primary pl-4 my-6">
                  Mas o mais importante não está nele. A aplicação prática será revelada no encontro.
                </p>
              </div>
            </div>

            <div className="relative group rounded-xl overflow-hidden border border-white/10 shadow-2xl shadow-primary/5 bg-card/50 p-2">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <img 
                src="/ebook-cover.png" 
                alt="Capa do material O Futuro no Mercado de Vinhos - Parte 1" 
                className="w-full h-auto rounded-lg shadow-inner object-cover max-h-[500px] object-top"
              />
            </div>
          </div>

          {/* Right Form Card */}
          <div className="lg:col-span-5">
            <div className="sticky top-8 bg-card border border-border rounded-2xl p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/40 via-primary to-primary/40"></div>
              
              <h3 className="text-xl font-bold mb-2">GARANTA SUA VAGA</h3>
              <p className="text-sm text-muted-foreground mb-8">
                Preencha seus dados para se inscrever e receber o material preparatório.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome completo</Label>
                  <Input id="name" required placeholder="Seu nome" className="bg-background/50 h-12" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" required placeholder="seu@email.com" className="bg-background/50 h-12" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp</Label>
                  <Input id="whatsapp" required placeholder="(00) 00000-0000" className="bg-background/50 h-12" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="company">Atuação / Empresa (opcional)</Label>
                  <Input id="company" placeholder="Sua empresa ou cargo" className="bg-background/50 h-12" />
                </div>

                <Button 
                  type="submit" 
                  size="lg" 
                  className="w-full h-14 text-[15px] font-bold mt-4 shadow-[0_0_40px_-10px_rgba(37,99,235,0.5)] hover:shadow-[0_0_60px_-10px_rgba(37,99,235,0.7)] transition-all duration-300"
                  disabled={loading}
                >
                  {loading ? "PROCESSANDO..." : "QUERO PARTICIPAR E RECEBER O MATERIAL PREPARATÓRIO"}
                </Button>

                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-4">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Seus dados estão seguros conosco.</span>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-32 pt-20 border-t border-white/5 animate-in fade-in duration-1000 delay-500 fill-mode-forwards">
          <h2 className="text-3xl font-bold text-center mb-16">POR QUE PARTICIPAR?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-card/40 border border-white/5 p-6 rounded-xl hover:bg-card transition-colors">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                <Target className="w-6 h-6 text-primary" />
              </div>
              <h4 className="font-bold mb-3 text-lg">Conteúdo prático e direto ao ponto</h4>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Nada de teoria. Só o que realmente importa.
              </p>
            </div>

            <div className="bg-card/40 border border-white/5 p-6 rounded-xl hover:bg-card transition-colors">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                <Database className="w-6 h-6 text-primary" />
              </div>
              <h4 className="font-bold mb-3 text-lg">Baseado em dados e inteligência real</h4>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Informação confiável para decisões melhores.
              </p>
            </div>

            <div className="bg-card/40 border border-white/5 p-6 rounded-xl hover:bg-card transition-colors">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <h4 className="font-bold mb-3 text-lg">Visão estratégica do mercado</h4>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Entenda o todo para agir melhor no detalhe.
              </p>
            </div>

            <div className="bg-card/40 border border-white/5 p-6 rounded-xl hover:bg-card transition-colors">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <h4 className="font-bold mb-3 text-lg">Comunidade que pensa à frente</h4>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Conecte-se com quem está construindo o futuro do vinho.
              </p>
            </div>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-12 text-center mt-12">
        <p className="text-sm font-bold tracking-widest text-muted-foreground">
          VAGAS LIMITADAS. GARANTE SUA PARTICIPAÇÃO.
        </p>
      </footer>
    </div>
  );
}
