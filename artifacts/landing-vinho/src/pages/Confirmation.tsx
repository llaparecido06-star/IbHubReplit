import { Mail, BookOpen, MonitorPlay, AlertCircle, ArrowRight } from "lucide-react";

export default function Confirmation() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30">
      <main className="max-w-4xl mx-auto px-6 pt-20 pb-24 md:pt-32">
        
        {/* Header */}
        <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-8">
            INTELIGÊNCIA ESTRATÉGICA PARA O MERCADO DE VINHOS
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4">
            INSCRIÇÃO CONFIRMADA!
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground">
            Você já está dentro.
          </p>
        </div>

        {/* Info Alert */}
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-6 flex items-start gap-4 mb-16 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-150 fill-mode-forwards">
          <Mail className="w-6 h-6 text-primary shrink-0 mt-1" />
          <p className="text-lg leading-relaxed text-primary-foreground/90 font-medium">
            O material preparatório foi enviado para o seu e-mail. Verifique sua caixa de entrada (e o spam, se necessário).
          </p>
        </div>

        {/* Content Details */}
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300 fill-mode-forwards">
          
          <div className="bg-card border border-border rounded-2xl p-8 md:p-10 shadow-2xl relative overflow-hidden">
            <h2 className="text-xl text-muted-foreground font-medium mb-2">Você acabou de receber:</h2>
            <h3 className="text-2xl md:text-3xl font-bold mb-4">O FUTURO NO MERCADO DE VINHOS – PARTE 1</h3>
            <p className="text-muted-foreground mb-8 text-lg">
              Esse material mostra como estamos lendo o mercado hoje.
            </p>
            
            <div className="border-l-4 border-amber-500 pl-6 py-2 mb-8 bg-amber-500/5 rounded-r-lg">
              <p className="text-amber-500 font-medium leading-relaxed">
                Mas presta atenção nisso: O que você recebeu NÃO é a parte mais importante. O material mostra o cenário. Mas não mostra como usar isso na prática.
              </p>
            </div>

            <div className="border-t border-border pt-8 mt-8">
              <h4 className="text-xl font-bold mb-6">No dia 18 de maio, vamos liberar a PARTE 2:</h4>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 text-lg">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  Como transformar essa leitura em decisão
                </li>
                <li className="flex items-center gap-3 text-lg">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  Onde está o dinheiro de verdade
                </li>
                <li className="flex items-center gap-3 text-lg">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  Como operar com mais clareza no mercado
                </li>
              </ul>
            </div>
          </div>

          {/* Event Meta Ribbon */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12 py-8 border-y border-border text-sm font-medium tracking-wide">
            <div className="text-foreground">18 de maio</div>
            <div className="hidden md:block w-px h-4 bg-border"></div>
            <div className="text-foreground">20h00</div>
            <div className="hidden md:block w-px h-4 bg-border"></div>
            <div className="text-foreground">Evento fechado — Para membros da comunidade</div>
          </div>

          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-6 flex gap-4">
            <AlertCircle className="w-6 h-6 text-destructive shrink-0 mt-0.5" />
            <p className="font-semibold text-destructive-foreground">
              IMPORTANTE: Se você não participar ao vivo, vai perder a parte mais importante.
            </p>
          </div>

          {/* Steps */}
          <div className="pt-8">
            <h3 className="text-2xl font-bold mb-8">Agora faça o seguinte:</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-card/50 border border-white/5 p-6 rounded-xl">
                <div className="text-4xl font-black text-primary/20 mb-4">1</div>
                <h4 className="font-bold mb-2">Verifique seu e-mail</h4>
                <p className="text-sm text-muted-foreground">O material já está a caminho.</p>
              </div>
              <div className="bg-card/50 border border-white/5 p-6 rounded-xl">
                <div className="text-4xl font-black text-primary/20 mb-4">2</div>
                <h4 className="font-bold mb-2">Leia o material</h4>
                <p className="text-sm text-muted-foreground">Com calma e atenção.</p>
              </div>
              <div className="bg-card/50 border border-white/5 p-6 rounded-xl relative overflow-hidden">
                <div className="absolute inset-0 bg-primary/5"></div>
                <div className="relative z-10">
                  <div className="text-4xl font-black text-primary/40 mb-4">3</div>
                  <h4 className="font-bold mb-2">Esteja presente no dia 18</h4>
                  <p className="text-sm text-muted-foreground">A Parte 2 será liberada exclusivamente ao vivo.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Closing Quote */}
          <div className="text-center pt-16 pb-8 px-4">
            <p className="text-xl md:text-2xl text-muted-foreground font-serif italic leading-relaxed">
              "Quem só consome informação continua no mesmo lugar.<br/>
              Quem entende como usar começa a operar diferente.<br/>
              <span className="text-foreground font-bold not-italic font-sans mt-4 block">Nos vemos no dia 18!"</span>
            </p>
          </div>

        </div>
      </main>

      <footer className="border-t border-border bg-card py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Dúvidas? Fale com a gente: <a href="mailto:atendimento@idealbi.com.br" className="text-primary hover:underline">atendimento@idealbi.com.br</a>
        </p>
      </footer>
    </div>
  );
}
