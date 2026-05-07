import { Router, type IRouter, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { resolveUserId } from "../lib/planCheck.js";
import { sendPushToUser } from "../lib/pushUtils.js";
import OpenAI from "openai";

// Lazy singleton — prioriza OPENAI_API_KEY direto; cai para integração Replit se ausente
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    const directKey = process.env.OPENAI_API_KEY;
    const integKey  = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    const apiKey    = directKey ?? integKey;
    if (!apiKey) throw new Error("OpenAI API key não configurada (defina OPENAI_API_KEY nos secrets)");
    // Usa o proxy Replit apenas quando não há chave direta
    const baseURL = directKey ? undefined : process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    _openai = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
  }
  return _openai;
}

const router: IRouter = Router();

const supabaseAdmin = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const CREDITS_FALLBACK: Record<string, number> = {
  gratuito:     0,
  free:         0,
  profissional: 3,
  basico:       3,
  premium:      3,
  empresa:      10,
  empresas:     10,
  business:     10,
  executivo:    25,
  exclusive:    25,
};

function currentPeriodStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

async function getPlanCredits(userId: string): Promise<number> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .single();

  const planId = (profile?.plan as string | null)?.toLowerCase() ?? "free";

  const { data: planRow } = await supabaseAdmin
    .from("plans")
    .select("ai_search_credits")
    .eq("id", planId)
    .maybeSingle();

  if (planRow && typeof planRow.ai_search_credits === "number") {
    return planRow.ai_search_credits;
  }

  return CREDITS_FALLBACK[planId] ?? 0;
}

async function getOrCreateCredits(userId: string): Promise<{
  credits_remaining: number;
  credits_total: number;
  period_start: string;
}> {
  const period = currentPeriodStart();

  const { data: existing } = await supabaseAdmin
    .from("ai_search_credits")
    .select("credits_remaining, credits_total, period_start")
    .eq("user_id", userId)
    .single();

  if (!existing) {
    const total = await getPlanCredits(userId);
    await supabaseAdmin.from("ai_search_credits").insert({
      user_id: userId,
      credits_remaining: total,
      credits_total: total,
      period_start: period,
    });
    return { credits_remaining: total, credits_total: total, period_start: period };
  }

  if (existing.period_start < period) {
    const total = await getPlanCredits(userId);
    await supabaseAdmin
      .from("ai_search_credits")
      .update({ credits_remaining: total, credits_total: total, period_start: period, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    // Notify the user that their AI credits have been renewed for the new period
    if (total > 0) {
      void sendPushToUser({
        userId,
        title: "✨ Créditos de IA renovados!",
        body: `Você tem ${total} crédito${total === 1 ? "" : "s"} disponíve${total === 1 ? "l" : "is"} este mês na busca inteligente de vinhos.`,
        data: { type: "credits_renewed", deepLink: "/(tabs)/mercado" },
      });
    }

    return { credits_remaining: total, credits_total: total, period_start: period };
  }

  return existing as { credits_remaining: number; credits_total: number; period_start: string };
}

const EXTRACT_SYSTEM_PROMPT = `Você é um assistente especializado em extrair nomes de marcas de vinho de consultas de usuários para um banco de dados profissional da indústria vinícola brasileira.

Sua ÚNICA função é identificar e normalizar o nome da marca de vinho que o usuário está buscando.

REGRAS ESTRITAS:
1. Se o usuário digitou um nome de marca (mesmo com erros ortográficos, abreviações ou variações), retorne APENAS o nome normalizado da marca. Exemplos:
   - "chandon" → "Chandon"
   - "vuve clicot" → "Veuve Clicquot"
   - "moet" → "Moët & Chandon"
   - "penfolds bin 389" → "Penfolds"
   - "santa carolina cabernet" → "Santa Carolina"

2. Se a consulta NÃO for sobre uma marca específica (ex: perguntas sobre distribuidores, países, regiões, tipos de vinho, preços, ou qualquer outra coisa que não seja identificar uma marca), retorne exatamente: FORA_DO_ESCOPO

3. Retorne APENAS o nome da marca ou FORA_DO_ESCOPO — sem explicações, pontuação extra, aspas ou qualquer outro texto.

4. Mantenha o nome no idioma original da marca (francês, italiano, português, inglês etc.).`;

async function extractBrandName(userQuery: string): Promise<string | null> {
  const completion = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    max_completion_tokens: 64,
    messages: [
      { role: "system", content: EXTRACT_SYSTEM_PROMPT },
      { role: "user", content: userQuery },
    ],
  });

  const result = completion.choices[0]?.message?.content?.trim() ?? "";
  if (!result || result === "FORA_DO_ESCOPO") return null;
  return result;
}

/**
 * GET /wine-imports/bi-search/importadores?q=&limit=&offset=
 * GET /wine-imports/bi-search/exportadores?q=&limit=&offset=
 * GET /wine-imports/bi-search/produtores?q=&limit=&offset=
 * Credit-gated search for BI tables. Consumes 1 credit per search (not per "load more").
 * "Load more" calls pass offset>0 and do NOT consume credits.
 */
async function consumeCredit(userId: string): Promise<{ credits_remaining: number; credits_total: number } | null> {
  const current = await getOrCreateCredits(userId);
  if (current.credits_remaining <= 0) return null;
  const newRemaining = current.credits_remaining - 1;
  await supabaseAdmin
    .from("ai_search_credits")
    .update({ credits_remaining: newRemaining, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  return { credits_remaining: newRemaining, credits_total: current.credits_total };
}

router.get("/wine-imports/bi-search/importadores", async (req: Request, res: Response) => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;

  const q = (req.query.q as string | undefined)?.trim() ?? "";
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

  let credits = await getOrCreateCredits(userId);

  // Only consume a credit on the initial search (offset === 0)
  if (offset === 0) {
    if (credits.credits_remaining <= 0) {
      return res.status(402).json({ error: "Sem créditos", credits_remaining: 0, credits_total: credits.credits_total });
    }
    const consumed = await consumeCredit(userId);
    if (consumed) credits = { ...credits, ...consumed };
  }

  type RawRow = { id: string; name: string; pais: string; segmentos: string; exportador: string | null };
  type GroupedItem = { id: string; name: string; segmentos: string; exportadores: { exportador: string; pais: string }[] };

  let query = supabaseAdmin
    .from("bi_importadores")
    .select("id, name, pais, segmentos, exportador")
    .order("name", { ascending: true });

  if (q) query = query.or(`name.ilike.%${q}%,pais.ilike.%${q}%,segmentos.ilike.%${q}%,exportador.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // Group rows by distribuidor name — one importador may import from many exportadores
  const grouped = new Map<string, GroupedItem>();
  for (const row of (data ?? []) as RawRow[]) {
    const key = row.name.trim();
    if (!grouped.has(key)) {
      grouped.set(key, { id: row.id, name: row.name, segmentos: row.segmentos ?? "", exportadores: [] });
    }
    if (row.exportador) {
      grouped.get(key)!.exportadores.push({ exportador: row.exportador, pais: row.pais ?? "" });
    }
  }

  const allGroups = Array.from(grouped.values());
  const total = allGroups.length;
  const items = allGroups.slice(offset, offset + limit);

  return res.json({ items, total, limit, offset, credits_remaining: credits.credits_remaining, credits_total: credits.credits_total });
});

router.get("/wine-imports/bi-search/exportadores", async (req: Request, res: Response) => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;

  const q = (req.query.q as string | undefined)?.trim() ?? "";
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

  let credits = await getOrCreateCredits(userId);

  if (offset === 0) {
    if (credits.credits_remaining <= 0) {
      return res.status(402).json({ error: "Sem créditos", credits_remaining: 0, credits_total: credits.credits_total });
    }
    const consumed = await consumeCredit(userId);
    if (consumed) credits = { ...credits, ...consumed };
  }

  // Fetch all matching rows (financial data NOT sent — requires reveal credit)
  // One exportador may have many rows (one per distribuidor), so we dedup by name
  let query = supabaseAdmin
    .from("bi_exportadores")
    .select("id, name, origem_exportador")
    .order("name", { ascending: true });

  if (q) query = query.or(`name.ilike.%${q}%,origem_exportador.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // Dedup by exportador name — keep first occurrence of each name
  const seen = new Map<string, { id: string; name: string; origem_exportador: string }>();
  for (const row of (data ?? []) as { id: string; name: string; origem_exportador: string | null }[]) {
    const key = row.name.trim();
    if (!seen.has(key)) seen.set(key, { id: row.id, name: row.name, origem_exportador: row.origem_exportador ?? "" });
  }

  const allGroups = Array.from(seen.values());
  const total = allGroups.length;
  const items = allGroups.slice(offset, offset + limit).map(g => ({
    id: g.id,
    name: g.name,
    origem_exportador: g.origem_exportador,
    distribuidor: null as string | null,
    fob_usd: null as string | null,
    cx9l: null as string | null,
    usd_por_cx9l: null as string | null,
  }));

  return res.json({ items, total, limit, offset, credits_remaining: credits.credits_remaining, credits_total: credits.credits_total });
});

router.get("/wine-imports/bi-search/produtores", async (req: Request, res: Response) => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;

  const q = (req.query.q as string | undefined)?.trim() ?? "";
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

  let credits = await getOrCreateCredits(userId);

  if (offset === 0) {
    if (credits.credits_remaining <= 0) {
      return res.status(402).json({ error: "Sem créditos", credits_remaining: 0, credits_total: credits.credits_total });
    }
    const consumed = await consumeCredit(userId);
    if (consumed) credits = { ...credits, ...consumed };
  }

  let query = supabaseAdmin
    .from("bi_produtores")
    .select("id, name, name_fantasia, regiao, estado, municipio, created_at", { count: "exact" })
    .order("name", { ascending: true })
    .range(offset, offset + limit - 1);

  if (q) query = query.or(`name.ilike.%${q}%,name_fantasia.ilike.%${q}%,regiao.ilike.%${q}%,estado.ilike.%${q}%,municipio.ilike.%${q}%`);

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });

  return res.json({ items: data ?? [], total: count ?? 0, limit, offset, credits_remaining: credits.credits_remaining, credits_total: credits.credits_total });
});

router.get("/wine-imports/suggestions", async (req: Request, res: Response) => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;

  const q = (req.query.q as string | undefined)?.trim();
  if (!q || q.length < 2) {
    return res.json({ suggestions: [] });
  }

  const pattern = `%${q}%`;
  const { data, error } = await supabaseAdmin
    .from("wine_imports")
    .select("marca_completa")
    .ilike("marca_completa", pattern)
    .order("marca_completa")
    .limit(25);

  if (error) {
    return res.status(500).json({ suggestions: [] });
  }

  const seen = new Set<string>();
  const suggestions: string[] = [];
  for (const row of (data ?? []) as { marca_completa: string }[]) {
    const name = row.marca_completa?.trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      suggestions.push(name);
    }
  }

  return res.json({ suggestions });
});

/**
 * GET /wine-imports/bi-suggestions/exportadores?q=X
 * GET /wine-imports/bi-suggestions/importadores?q=X
 * GET /wine-imports/bi-suggestions/produtores?q=X
 * Lightweight autocomplete — no credit consumed.
 */
function makeBiSuggestions(table: string, column: string) {
  return async (req: Request, res: Response) => {
    const userId = await resolveUserId(req, res);
    if (!userId) return;
    const q = (req.query.q as string | undefined)?.trim();
    if (!q || q.length < 2) return res.json({ suggestions: [] });
    const pattern = `%${q}%`;
    const { data, error } = await supabaseAdmin
      .from(table)
      .select(column)
      .ilike(column, pattern)
      .order(column)
      .limit(20);
    if (error) return res.json({ suggestions: [] });
    const seen = new Set<string>();
    const suggestions: string[] = [];
    for (const row of (data ?? []) as Record<string, string>[]) {
      const name = row[column]?.trim();
      if (name && !seen.has(name)) { seen.add(name); suggestions.push(name); }
    }
    return res.json({ suggestions });
  };
}
router.get("/wine-imports/bi-suggestions/exportadores", makeBiSuggestions("bi_exportadores", "name"));
router.get("/wine-imports/bi-suggestions/importadores", makeBiSuggestions("bi_importadores", "name"));
router.get("/wine-imports/bi-suggestions/produtores", async (req: Request, res: Response) => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;
  const q = (req.query.q as string | undefined)?.trim();
  if (!q || q.length < 2) return res.json({ suggestions: [] });
  const { data, error } = await supabaseAdmin
    .from("bi_produtores")
    .select("name, name_fantasia, municipio")
    .or(`name.ilike.%${q}%,name_fantasia.ilike.%${q}%,municipio.ilike.%${q}%`)
    .order("name")
    .limit(30);
  if (error) return res.json({ suggestions: [] });
  const seen = new Set<string>();
  const suggestions: string[] = [];
  for (const row of (data ?? []) as { name: string | null; name_fantasia: string | null; municipio: string | null }[]) {
    for (const val of [row.name, row.name_fantasia]) {
      const v = val?.trim();
      if (v && v.toLowerCase().includes(q.toLowerCase()) && !seen.has(v.toLowerCase())) {
        seen.add(v.toLowerCase());
        suggestions.push(v);
        if (suggestions.length >= 20) break;
      }
    }
    if (suggestions.length >= 20) break;
  }
  return res.json({ suggestions });
});

/**
 * GET /wine-imports/exportador-importadores?nome=X
 * Returns distinct distribuidores (importadores no Brasil) for the given
 * exportador name, sourced from bi_exportadores.distribuidor.
 * No credit consumed — read-only, open information.
 */
router.get("/wine-imports/exportador-importadores", async (req: Request, res: Response) => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;

  const nome = (req.query.nome as string | undefined)?.trim();
  if (!nome || nome.length < 2) {
    return res.json({ importadores: [] });
  }

  const { data, error } = await supabaseAdmin
    .from("bi_exportadores")
    .select("distribuidor")
    .ilike("name", nome)
    .not("distribuidor", "is", null)
    .limit(200);

  if (error) {
    req.log.error({ err: error }, "exportador-importadores query failed");
    return res.status(500).json({ importadores: [] });
  }

  const seen = new Set<string>();
  const importadores: { name: string; company_page_id: string | null }[] = [];
  for (const r of (data ?? []) as { distribuidor: string | null }[]) {
    const raw = (r.distribuidor ?? "").trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      importadores.push({ name: raw, company_page_id: null });
    }
  }

  // Resolve company_pages links
  if (importadores.length > 0) {
    try {
      const lookups = await Promise.all(
        importadores.slice(0, 20).map(async (d) => {
          const { data } = await supabaseAdmin
            .from("company_pages")
            .select("id")
            .ilike("name", d.name)
            .limit(1)
            .maybeSingle();
          return { key: d.name.toLowerCase(), id: (data as { id?: string } | null)?.id ?? null };
        })
      );
      const pageMap = new Map(lookups.filter(l => l.id).map(l => [l.key, l.id!]));
      for (const d of importadores) {
        const link = pageMap.get(d.name.toLowerCase());
        if (link) d.company_page_id = link;
      }
    } catch {}
  }

  return res.json({ importadores });
});

router.get("/wine-imports/credits", async (req: Request, res: Response) => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;

  const credits = await getOrCreateCredits(userId);
  return res.json(credits);
});

router.get("/wine-imports/search", async (req: Request, res: Response) => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;

  const credits = await getOrCreateCredits(userId);
  if (credits.credits_remaining <= 0) {
    return res.status(402).json({
      error: "Sem créditos",
      credits_remaining: 0,
      credits_total: credits.credits_total,
    });
  }

  const q = (req.query.q as string | undefined)?.trim();
  if (!q || q.length < 2) {
    return res.json({ data: [], credits_remaining: credits.credits_remaining, credits_total: credits.credits_total });
  }

  // direct=true skips AI extraction (used when user clicks a DB suggestion)
  const direct = req.query.direct === "true";

  let brandName: string | null = null;

  if (direct) {
    brandName = q;
  } else {
    brandName = await extractBrandName(q);

    // Fallback: if AI doesn't recognise the term, try it directly in the DB.
    // If records are found we treat the query as a valid brand name.
    if (!brandName) {
      const fallbackPattern = `%${q}%`;
      const { data: fallbackCheck } = await supabaseAdmin
        .from("wine_imports")
        .select("id")
        .ilike("marca_completa", fallbackPattern)
        .limit(1);

      if (fallbackCheck && fallbackCheck.length > 0) {
        brandName = q; // treat original query as the brand name
      }
    }
  }

  if (!brandName) {
    return res.status(422).json({
      error: "Consulta fora do escopo",
      message: "Por favor, pesquise pelo nome de uma marca específica de vinho.",
      credits_remaining: credits.credits_remaining,
      credits_total: credits.credits_total,
    });
  }

  const pattern = `%${brandName}%`;
  const { data, error } = await supabaseAdmin
    .from("wine_imports")
    .select("id, marca_completa, exportador, pais_de_origem, importador")
    .ilike("marca_completa", pattern)
    .order("marca_completa")
    .limit(50);

  if (error) {
    console.error("wine-imports search error", error);
    return res.status(500).json({ error: "Erro ao buscar dados" });
  }

  let rows = data ?? [];

  // Fallback: if AI extracted a brand but nothing matched, try progressively shorter
  // prefixes of the original query (word by word) until we get a hit.
  // This handles cases where AI hallucinates a wrong brand name.
  if (rows.length === 0 && !direct && brandName !== q) {
    const words = q.split(/\s+/).filter(Boolean);
    for (let len = words.length - 1; len >= 2; len--) {
      const prefix = words.slice(0, len).join(" ");
      const prefixPattern = `%${prefix}%`;
      const { data: prefixData } = await supabaseAdmin
        .from("wine_imports")
        .select("id, marca_completa, exportador, pais_de_origem, importador")
        .ilike("marca_completa", prefixPattern)
        .order("marca_completa")
        .limit(50);
      if (prefixData && prefixData.length > 0) {
        rows = prefixData as typeof rows;
        brandName = prefix; // use the effective prefix, not the AI's wrong extraction
        break;
      }
    }
  }

  // Build deduplicated distributor list (case-insensitive on trimmed name)
  // and try to resolve a company_pages link for each distributor name.
  const distribuidoresMap = new Map<string, { name: string; company_page_id: string | null }>();
  for (const r of rows as { importador: string | null }[]) {
    const raw = (r.importador ?? "").trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    if (!distribuidoresMap.has(key)) {
      distribuidoresMap.set(key, { name: raw, company_page_id: null });
    }
  }

  const distribuidoresList = Array.from(distribuidoresMap.values());

  if (distribuidoresList.length > 0) {
    try {
      const lookups = await Promise.all(
        distribuidoresList.map(async (d): Promise<{ key: string; id: string | null }> => {
          try {
            const { data } = await supabaseAdmin
              .from("company_pages")
              .select("id, name")
              .ilike("name", d.name)
              .limit(1)
              .maybeSingle();
            return { key: d.name.toLowerCase(), id: (data as { id?: string } | null)?.id ?? null };
          } catch {
            return { key: d.name.toLowerCase(), id: null };
          }
        })
      );
      const pagesByName = new Map<string, string>();
      for (const r of lookups) {
        if (r.id) pagesByName.set(r.key, r.id);
      }
      for (const d of distribuidoresList) {
        const link = pagesByName.get(d.name.toLowerCase());
        if (link) d.company_page_id = link;
      }
    } catch (e) {
      console.error("wine-imports company_pages lookup error", e);
    }
  }

  if (rows.length > 0) {
    const newRemaining = credits.credits_remaining - 1;
    await supabaseAdmin
      .from("ai_search_credits")
      .update({ credits_remaining: newRemaining, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    return res.json({
      data: rows,
      distribuidores: distribuidoresList,
      brand_extracted: brandName,
      credits_remaining: newRemaining,
      credits_total: credits.credits_total,
    });
  }

  return res.json({
    data: [],
    distribuidores: [],
    brand_extracted: brandName,
    credits_remaining: credits.credits_remaining,
    credits_total: credits.credits_total,
  });
});

/* ─── Reveal Credit System ───────────────────────────────────────────────── */

const REVEAL_CREDITS_FALLBACK: Record<string, number> = {
  gratuito: 0, free: 0, basico: 0, profissional: 0,
  premium: 3, empresa: 5, empresas: 5, business: 5,
  executivo: 15, exclusive: 15,
};

async function getRevealPlanCredits(userId: string): Promise<number> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("plan, reveal_credits_override")
    .eq("id", userId)
    .single();
  const overrideVal = (profile as { reveal_credits_override?: number | null } | null)?.reveal_credits_override;
  if (overrideVal != null) return overrideVal;
  const planId = ((profile as { plan?: string | null } | null)?.plan ?? "free").toLowerCase();
  const { data: planRow } = await supabaseAdmin
    .from("plans")
    .select("reveal_credits")
    .eq("id", planId)
    .maybeSingle();
  const rc = (planRow as { reveal_credits?: number } | null)?.reveal_credits;
  if (typeof rc === "number") return rc;
  return REVEAL_CREDITS_FALLBACK[planId] ?? 0;
}

async function getOrCreateRevealCredits(userId: string): Promise<{ credits_remaining: number; credits_total: number; period_start: string }> {
  const period = currentPeriodStart();
  const { data: existing } = await supabaseAdmin
    .from("bi_reveal_credits")
    .select("credits_remaining, credits_total, period_start")
    .eq("user_id", userId)
    .single();
  if (!existing) {
    const total = await getRevealPlanCredits(userId);
    await supabaseAdmin.from("bi_reveal_credits").insert({
      user_id: userId, credits_remaining: total, credits_total: total, period_start: period,
    });
    return { credits_remaining: total, credits_total: total, period_start: period };
  }
  const row = existing as { credits_remaining: number; credits_total: number; period_start: string };
  if (row.period_start < period) {
    const total = await getRevealPlanCredits(userId);
    await supabaseAdmin.from("bi_reveal_credits")
      .update({ credits_remaining: total, credits_total: total, period_start: period, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    return { credits_remaining: total, credits_total: total, period_start: period };
  }
  return row;
}

/**
 * GET /wine-imports/bi/reveal-credits
 * Returns user's monthly reveal-credit balance for financial data.
 */
router.get("/wine-imports/bi/reveal-credits", async (req: Request, res: Response) => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;
  const credits = await getOrCreateRevealCredits(userId);
  return res.json(credits);
});

/**
 * POST /wine-imports/bi/exportadores/:id/reveal
 * Consumes 1 reveal credit to return fob_usd / cx9l / usd_por_cx9l.
 * If the same record was already revealed this month, it's free.
 * Admins bypass the credit check entirely.
 */
/**
 * POST /wine-imports/bi/exportadores/reveal
 * Body: { name: string }
 * Consumes 1 reveal credit; free if already revealed this month or admin.
 * Returns aggregated totals + per-distribuidor breakdown.
 */
router.post("/wine-imports/bi/exportadores/reveal", async (req: Request, res: Response) => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;

  const { name } = req.body as { name?: string };
  if (!name?.trim()) return res.status(400).json({ error: "name é obrigatório" });
  const exportadorName = name.trim();

  // Fetch all rows for this exportador (one per distribuidor)
  type ExpRow = { distribuidor: string | null; fob_usd: string | null; cx9l: string | null; usd_por_cx9l: string | null };
  const { data: rows, error: fetchError } = await supabaseAdmin
    .from("bi_exportadores")
    .select("distribuidor, fob_usd, cx9l, usd_por_cx9l")
    .eq("name", exportadorName)
    .order("fob_usd", { ascending: false, nullsFirst: false });

  if (fetchError) return res.status(500).json({ error: fetchError.message });
  if (!rows || rows.length === 0) return res.status(404).json({ error: "Exportador não encontrado" });

  // Group rows by distribuidor — merge duplicates (same exportador+distribuidor can have multiple rows)
  const distMap = new Map<string, { distribuidor: string | null; fob: number; cx9l: number }>();
  for (const r of rows as ExpRow[]) {
    const key = (r.distribuidor ?? "").toLowerCase().trim();
    const fob = r.fob_usd ? parseFloat(r.fob_usd) : 0;
    const cx  = r.cx9l   ? parseFloat(r.cx9l)     : 0;
    const existing = distMap.get(key);
    if (existing) { existing.fob += fob; existing.cx9l += cx; }
    else distMap.set(key, { distribuidor: r.distribuidor, fob, cx9l: cx });
  }
  const merged = Array.from(distMap.values());

  // Compute aggregated totals from merged (deduplicated) distribuidores
  let fob_sum = 0, cx9l_sum = 0;
  for (const d of merged) { fob_sum += d.fob; cx9l_sum += d.cx9l; }
  const totals = {
    fob_usd:      fob_sum  > 0                    ? fob_sum.toFixed(2)                   : null,
    cx9l:         cx9l_sum > 0                    ? cx9l_sum.toFixed(2)                  : null,
    usd_por_cx9l: fob_sum  > 0 && cx9l_sum > 0   ? (fob_sum / cx9l_sum).toFixed(2)      : null,
  };
  const distribuidores = merged
    .sort((a, b) => b.fob - a.fob)
    .map(d => ({
      distribuidor: d.distribuidor,
      fob_usd:      d.fob  > 0               ? d.fob.toFixed(2)             : null,
      cx9l:         d.cx9l > 0               ? d.cx9l.toFixed(2)            : null,
      usd_por_cx9l: d.fob  > 0 && d.cx9l > 0 ? (d.fob / d.cx9l).toFixed(2) : null,
    }));

  // Admins bypass credit check
  const { data: profile } = await supabaseAdmin.from("profiles").select("role").eq("id", userId).single();
  const isAdmin = (profile as { role?: string } | null)?.role === "admin";
  if (isAdmin) {
    return res.json({ totals, distribuidores, already_revealed: true, credits_remaining: null, credits_total: 0 });
  }

  // Check if already revealed this month (keyed by exportador name)
  const { data: logEntry } = await supabaseAdmin
    .from("bi_reveal_log")
    .select("id")
    .eq("user_id", userId)
    .eq("record_type", "exportador")
    .eq("record_key", exportadorName)
    .maybeSingle();

  if (logEntry) {
    const credits = await getOrCreateRevealCredits(userId);
    return res.json({ totals, distribuidores, already_revealed: true, credits_remaining: credits.credits_remaining, credits_total: credits.credits_total });
  }

  const credits = await getOrCreateRevealCredits(userId);
  if (credits.credits_remaining <= 0) {
    return res.status(402).json({ error: "Sem créditos de revelação", credits_remaining: 0, credits_total: credits.credits_total });
  }

  const newRemaining = credits.credits_remaining - 1;
  await supabaseAdmin.from("bi_reveal_credits")
    .update({ credits_remaining: newRemaining, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  await supabaseAdmin.from("bi_reveal_log").insert({
    user_id: userId, record_type: "exportador", record_key: exportadorName,
  });

  return res.json({ totals, distribuidores, already_revealed: false, credits_remaining: newRemaining, credits_total: credits.credits_total });
});

// ── POST /wine-imports/spell-correct ─────────────────────────────────────────
router.post("/wine-imports/spell-correct", async (req: Request, res: Response) => {
  const { query, context } = req.body as { query?: string; context?: string };
  if (!query || typeof query !== "string" || query.trim().length < 2) {
    return res.json({ corrected: null });
  }
  const sq = query.trim().slice(0, 200);

  const contextHint =
    context === "marca"
      ? "nomes de vinhos e marcas (ex: Châteauneuf-du-Pape, Penfolds, Casillero del Diablo)"
      : context === "importador"
      ? "nomes de importadores e distribuidores de vinho no Brasil"
      : context === "produtor"
      ? "nomes de vinícolas e produtores nacionais"
      : "nomes de exportadores de vinho e países de origem";

  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Você é especialista em ortografia para o mercado de vinhos brasileiro.
O usuário buscou por ${contextHint}.
Corrija apenas erros de ortografia evidentes (letras trocadas, acento errado, etc).
Se a busca estiver correta, responda apenas: OK
Se houver correção necessária, responda SOMENTE o texto corrigido, sem explicações.
Preserve maiúsculas/minúsculas e o idioma original (português, inglês, espanhol, francês, italiano).
Exemplos: "Concha y Toro" → OK | "Conca y Toro" → Concha y Toro | "malbek" → malbec | "Borgonha" → OK`,
        },
        { role: "user", content: sq },
      ],
      temperature: 0,
      max_tokens: 80,
    });
    const raw = (completion.choices[0]?.message?.content ?? "").trim();
    if (!raw || raw === "OK" || raw.toLowerCase() === sq.toLowerCase()) {
      return res.json({ corrected: null });
    }
    return res.json({ corrected: raw });
  } catch {
    return res.json({ corrected: null });
  }
});

export default router;
