import { Router, type IRouter, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { resolveUserId } from "../lib/planCheck.js";
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
  free:      0,
  premium:   3,
  business:  10,
  exclusive: 25,
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

  const brandName = await extractBrandName(q);

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
    .select("id, marca_completa, marca_relatorio, pais_de_origem, distribuidor")
    .or(`marca_completa.ilike.${pattern},marca_relatorio.ilike.${pattern}`)
    .order("marca_completa")
    .limit(20);

  if (error) {
    console.error("wine-imports search error", error);
    return res.status(500).json({ error: "Erro ao buscar dados" });
  }

  const rows = data ?? [];

  if (rows.length > 0) {
    const newRemaining = credits.credits_remaining - 1;
    await supabaseAdmin
      .from("ai_search_credits")
      .update({ credits_remaining: newRemaining, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    return res.json({
      data: rows,
      brand_extracted: brandName,
      credits_remaining: newRemaining,
      credits_total: credits.credits_total,
    });
  }

  return res.json({
    data: [],
    brand_extracted: brandName,
    credits_remaining: credits.credits_remaining,
    credits_total: credits.credits_total,
  });
});

export default router;
