import { Router, type IRouter, type Request, type Response } from "express";
import { resolveUserId, checkAnyPlanFeature } from "../lib/planCheck.js";

const router: IRouter = Router();

interface ImportadorRecord {
  id: string;
  name: string;
  pais: string;
  segmentos: string;
  estado: string;
}

interface ExportadorRecord {
  id: string;
  name: string;
  paisDestino: string;
  produtos: string;
  caixas: string;
  valorVendido: string;
  precoMedio: string;
}

interface ProdutorRecord {
  id: string;
  name: string;
  regiao: string;
  tipos: string;
  fundado: string;
}

const IMPORTADORES: ImportadorRecord[] = [
  { id: "i1",  name: "Wine & Co Importações",  pais: "França",         segmentos: "Vinhos Tranquilos, Espumantes",       estado: "SP" },
  { id: "i2",  name: "Summit Wines",            pais: "Argentina",      segmentos: "Malbec, Cabernet Sauvignon",          estado: "RS" },
  { id: "i3",  name: "Expand Wines",            pais: "Portugal",       segmentos: "Vinhos Verdes, Porto",                estado: "RJ" },
  { id: "i4",  name: "Aquila Importações",      pais: "Espanha",        segmentos: "Rioja, Cava, Alvarinho",              estado: "SP" },
  { id: "i5",  name: "Eurovin Importadora",     pais: "Itália",         segmentos: "Barolo, Prosecco, Amarone",           estado: "SP" },
  { id: "i6",  name: "Decanter Importações",    pais: "Alemanha",       segmentos: "Riesling, Gewurztraminer",            estado: "PR" },
  { id: "i7",  name: "Grand Cru Seleções",      pais: "França",         segmentos: "Bordeaux, Borgonha, Champagne",       estado: "SP" },
  { id: "i8",  name: "Vinho e Arte",            pais: "Nova Zelândia",  segmentos: "Sauvignon Blanc, Pinot Noir",         estado: "SP" },
  { id: "i9",  name: "Andina Wines",            pais: "Chile",          segmentos: "Carmenère, Cabernet, Chardonnay",     estado: "MG" },
  { id: "i10", name: "New World Importações",   pais: "EUA",            segmentos: "Zinfandel, Cabernet, Chardonnay",    estado: "RJ" },
];

const EXPORTADORES: ExportadorRecord[] = [
  { id: "e1",  name: "Wines of Brasil",        paisDestino: "EUA, China, UK",            produtos: "Espumantes, Vinhos Finos",        caixas: "48.200", valorVendido: "R$ 8,2M",  precoMedio: "R$ 170,14" },
  { id: "e2",  name: "UVIBRA",                  paisDestino: "Múltiplos países",           produtos: "Vinhos Tranquilos, Sucos",        caixas: "32.800", valorVendido: "R$ 5,1M",  precoMedio: "R$ 155,49" },
  { id: "e3",  name: "Aurora Cooperativa",      paisDestino: "China, EUA, Japão",         produtos: "Espumantes, Sucos",               caixas: "28.400", valorVendido: "R$ 4,3M",  precoMedio: "R$ 151,41" },
  { id: "e4",  name: "Miolo Wine Group",        paisDestino: "UK, EUA, China",            produtos: "Vinhos Premium, Varietais",       caixas: "22.100", valorVendido: "R$ 6,7M",  precoMedio: "R$ 303,17" },
  { id: "e5",  name: "Casa Valduga",            paisDestino: "Suíça, Bélgica, UK",        produtos: "Espumantes Brut, Tranquilos",     caixas: "18.600", valorVendido: "R$ 5,2M",  precoMedio: "R$ 279,57" },
  { id: "e6",  name: "Salton",                  paisDestino: "Argentina, EUA, Paraguai",  produtos: "Vinhos Finos, Espumantes",        caixas: "15.200", valorVendido: "R$ 2,8M",  precoMedio: "R$ 184,21" },
  { id: "e7",  name: "Garibaldi Cooperativa",   paisDestino: "Japão, Suíça, Canadá",      produtos: "Espumantes Moscatel, Brut",       caixas: "12.800", valorVendido: "R$ 3,1M",  precoMedio: "R$ 242,19" },
  { id: "e8",  name: "Don Giovanni",            paisDestino: "Países Baixos, UK",         produtos: "Vinhos Varietais, Corte",         caixas: "10.400", valorVendido: "R$ 1,9M",  precoMedio: "R$ 182,69" },
  { id: "e9",  name: "Pizzato Vinhos",          paisDestino: "China, Alemanha, EUA",      produtos: "Merlot, Chardonnay, Pinot Noir",  caixas: "8.100",  valorVendido: "R$ 2,4M",  precoMedio: "R$ 296,30" },
  { id: "e10", name: "Boscato",                 paisDestino: "Canadá, EUA, Europa",       produtos: "Vinhos Premiados, Varietais",     caixas: "5.600",  valorVendido: "R$ 1,8M",  precoMedio: "R$ 321,43" },
];

const PRODUTORES: ProdutorRecord[] = [
  { id: "p1",  name: "Miolo Wine Group",      regiao: "Serra Gaúcha",        tipos: "Espumantes, Vinhos Finos, Varietais",   fundado: "1989" },
  { id: "p2",  name: "Casa Valduga",          regiao: "Vale dos Vinhedos",   tipos: "Espumantes Brut, Tranquilos",           fundado: "1875" },
  { id: "p3",  name: "Aurora Cooperativa",    regiao: "Bento Gonçalves",     tipos: "Espumantes, Sucos, Graspa",             fundado: "1931" },
  { id: "p4",  name: "Salton",                regiao: "Bento Gonçalves",     tipos: "Vinhos Finos, Espumantes, Destilados",  fundado: "1910" },
  { id: "p5",  name: "Pizzato Vinhos",        regiao: "Vale dos Vinhedos",   tipos: "Merlot, Chardonnay, Pinot Noir",        fundado: "1999" },
  { id: "p6",  name: "Garibaldi Cooperativa", regiao: "Garibaldi",           tipos: "Espumantes Moscatel, Brut",             fundado: "1931" },
  { id: "p7",  name: "Boscato",              regiao: "Serra Gaúcha",        tipos: "Tintos Encorpados, Chardonnay",         fundado: "2000" },
  { id: "p8",  name: "Don Giovanni",          regiao: "Serra Gaúcha",        tipos: "Varietais, Corte, Reserva",             fundado: "1979" },
  { id: "p9",  name: "Lidio Carraro",         regiao: "Vale dos Vinhedos",   tipos: "Merlot, Cabernet, Vinho Natural",       fundado: "1988" },
  { id: "p10", name: "Família Bebber",        regiao: "Planalto Catarinense",tipos: "Pinot Noir, Chardonnay, Espumante",     fundado: "2000" },
];

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 50;

function parseQueryParams(req: Request): { q: string; limit: number; offset: number } {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
  return { q, limit, offset };
}

/**
 * GET /market/search/importadores
 * Server-side filtered + paginated list of importadores.
 * Query: q (search string), limit (default 5, max 50), offset (default 0)
 */
router.get("/market/search/importadores", async (req: Request, res: Response): Promise<void> => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;

  const { q, limit, offset } = parseQueryParams(req);
  const ql = q.toLowerCase();

  const filtered = q
    ? IMPORTADORES.filter(
        m =>
          m.name.toLowerCase().includes(ql) ||
          m.pais.toLowerCase().includes(ql) ||
          m.segmentos.toLowerCase().includes(ql)
      )
    : IMPORTADORES;

  const total = filtered.length;
  const items = filtered.slice(offset, offset + limit);

  res.json({ items, total, offset, limit });
});

/**
 * GET /market/search/exportadores
 * Server-side filtered + paginated list of exportadores.
 * Public fields (id, name, paisDestino, produtos) are returned to any authenticated user.
 * Premium KPI fields (caixas, valorVendido, precoMedio) are included only for users with
 * the "mercado:idealbi" feature; otherwise they are null.
 * Query: q, limit, offset
 */
router.get("/market/search/exportadores", async (req: Request, res: Response): Promise<void> => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;

  const hasPremium = await checkAnyPlanFeature(userId, ["mercado:idealbi", "mercado:busca"]);

  const { q, limit, offset } = parseQueryParams(req);
  const ql = q.toLowerCase();

  const filtered = q
    ? EXPORTADORES.filter(
        m =>
          m.name.toLowerCase().includes(ql) ||
          m.paisDestino.toLowerCase().includes(ql) ||
          m.produtos.toLowerCase().includes(ql)
      )
    : EXPORTADORES;

  const total = filtered.length;
  const page = filtered.slice(offset, offset + limit);

  const items = page.map(m => ({
    id: m.id,
    name: m.name,
    paisDestino: m.paisDestino,
    produtos: m.produtos,
    caixas:       hasPremium ? m.caixas       : null,
    valorVendido: hasPremium ? m.valorVendido : null,
    precoMedio:   hasPremium ? m.precoMedio   : null,
  }));

  res.json({ items, total, offset, limit, hasPremium });
});

/**
 * GET /market/search/produtores
 * Server-side filtered + paginated list of produtores nacionais.
 * Query: q, limit, offset
 */
router.get("/market/search/produtores", async (req: Request, res: Response): Promise<void> => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;

  const { q, limit, offset } = parseQueryParams(req);
  const ql = q.toLowerCase();

  const filtered = q
    ? PRODUTORES.filter(
        m =>
          m.name.toLowerCase().includes(ql) ||
          m.regiao.toLowerCase().includes(ql) ||
          m.tipos.toLowerCase().includes(ql)
      )
    : PRODUTORES;

  const total = filtered.length;
  const items = filtered.slice(offset, offset + limit);

  res.json({ items, total, offset, limit });
});

export default router;
