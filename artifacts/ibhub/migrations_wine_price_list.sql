-- wine_price_list: tabela para busca de preço de rótulo de vinho
-- Criada para o buscador em Mercados > Ideal.BI > IA

CREATE TABLE IF NOT EXISTS public.wine_price_list (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  descricao_detalhada text,
  codigo_barras       text,
  marca_completa      text,
  distribuidor        text,
  pais_de_origem      text,
  preco_medio         text,
  fonte               text,
  created_at          timestamptz DEFAULT now()
);

-- Índices para buscas rápidas
CREATE INDEX IF NOT EXISTS wine_price_list_descricao_idx
  ON public.wine_price_list USING gin(to_tsvector('portuguese', coalesce(descricao_detalhada, '')));

CREATE INDEX IF NOT EXISTS wine_price_list_codigo_idx
  ON public.wine_price_list (codigo_barras);

CREATE INDEX IF NOT EXISTS wine_price_list_marca_idx
  ON public.wine_price_list USING gin(to_tsvector('portuguese', coalesce(marca_completa, '')));

-- RLS: somente usuários autenticados podem ler (controle de plano feito na camada app)
ALTER TABLE public.wine_price_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wine_price_list_read" ON public.wine_price_list
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Apenas service role pode inserir/atualizar/deletar (importação de dados pelo admin)
CREATE POLICY "wine_price_list_admin_write" ON public.wine_price_list
  FOR ALL USING (auth.role() = 'service_role');
