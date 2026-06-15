export interface BadgeDef {
  key: string;
  icon: string;
  label: string;
  description: string;
  type: "auto" | "admin";
}

export const ADMIN_BADGE_DEFS: BadgeDef[] = [
  { key: "representante",       icon: "🎖️", label: "Representante",        description: "Representante oficial da plataforma",  type: "admin" },
  { key: "embaixador",          icon: "🌍", label: "Embaixador",            description: "Embaixador da Rede do Vinho",          type: "admin" },
  { key: "comunidade",          icon: "👥", label: "Comunidade",            description: "Pilar da comunidade ibhub",            type: "admin" },
  { key: "especialista",        icon: "🍷", label: "Especialista",          description: "Especialista reconhecido em vinhos",   type: "admin" },
  { key: "produtor_verificado", icon: "✅", label: "Produtor Verificado",   description: "Produtor verificado pela equipe",      type: "admin" },
  { key: "sommelier",           icon: "🍾", label: "Sommelier Certificado", description: "Sommelier com certificação validada",  type: "admin" },
  { key: "destaque_editorial",  icon: "⭐", label: "Destaque Editorial",    description: "Destaque selecionado pela curadoria",  type: "admin" },
  { key: "parceiro",            icon: "🤝", label: "Parceiro",              description: "Parceiro oficial da plataforma",       type: "admin" },
];

export const AUTO_BADGE_DEFS: BadgeDef[] = [
  { key: "primeiro_post",    icon: "✍️",  label: "Primeiro Post",      description: "Publicou o primeiro post",       type: "auto" },
  { key: "publicador_ativo", icon: "📝",  label: "Publicador Ativo",   description: "10 publicações feitas",          type: "auto" },
  { key: "seguidores_10",    icon: "🌟",  label: "10 Seguidores",      description: "Alcançou 10 seguidores",         type: "auto" },
  { key: "seguidores_100",   icon: "🏆",  label: "100 Seguidores",     description: "Alcançou 100 seguidores",        type: "auto" },
  { key: "bem_conectado",    icon: "🤝",  label: "Bem Conectado",      description: "5 ou mais conexões",            type: "auto" },
  { key: "enologo",          icon: "🍷",  label: "Enólogo",            description: "5 vinhos na adega virtual",     type: "auto" },
  { key: "colecionador",     icon: "🥂",  label: "Colecionador",       description: "20 vinhos na adega virtual",    type: "auto" },
  { key: "perfil_completo",  icon: "💎",  label: "Perfil Completo",    description: "Perfil 100% preenchido",        type: "auto" },
  { key: "destaque_semana",  icon: "👁️",  label: "Destaque da Semana", description: "10+ visualizações no perfil",   type: "auto" },
  { key: "embaixador_ref",   icon: "🎁",  label: "Indicador Ativo",    description: "Tem código de indicação ativo", type: "auto" },
];

export const ALL_BADGE_DEFS: BadgeDef[] = [...ADMIN_BADGE_DEFS, ...AUTO_BADGE_DEFS];

export function getBadgeDef(key: string): BadgeDef | undefined {
  return ALL_BADGE_DEFS.find((b) => b.key === key);
}
