import { Router, type IRouter, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";

const router: IRouter = Router();

const supabaseAdmin = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

router.get("/wine-imports/search", async (req: Request, res: Response) => {
  const q = (req.query.q as string | undefined)?.trim();
  if (!q || q.length < 2) {
    return res.json({ data: [] });
  }

  const pattern = `%${q}%`;

  const { data, error } = await supabaseAdmin
    .from("wine_imports")
    .select("id, marca_completa, marca_relatorio, distribuidor")
    .or(`marca_completa.ilike.${pattern},marca_relatorio.ilike.${pattern}`)
    .order("marca_completa")
    .limit(20);

  if (error) {
    console.error("wine-imports search error", error);
    return res.status(500).json({ error: "Erro ao buscar dados" });
  }

  return res.json({ data: data ?? [] });
});

export default router;
