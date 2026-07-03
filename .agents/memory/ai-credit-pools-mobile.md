---
name: AI credit pools (Mercado > Inteligência)
description: Two distinct AI credit pools and which UI action spends which — keep separate on every client.
---

# Two separate AI credit pools

The wine-import "Inteligência" BI feature has TWO independent credit balances. They are NOT interchangeable and must be tracked/displayed separately on every client.

- **COMMON pool** — endpoint `GET /wine-imports/credits`. Spent by: importadores reveal, produtores search, marca/rótulo *search*, and **exportadores "Ver" (who-imports)** via `GET /wine-imports/exportador-importadores` (this endpoint deducts 1 common credit server-side and returns `credits_remaining`).
- **SPECIAL / reveal pool** — endpoint `GET /wine-imports/bi/reveal-credits`. Spent by: exportador "Revelar dados financeiros" (`POST /wine-imports/bi/exportadores/reveal`) and retail "Ver dados" (`POST /wine-imports/bi/retail-prices/reveal`).

**Why:** mobile originally treated everything as one pool — special-reveal responses were written into the common counter and the ⭐ "Especiais" chip was derived as `max(0, common - commonTotal)` instead of the real special balance, so credits looked wrong/free.

**How to apply:**
- Fetch BOTH endpoints (parallel) to populate the two chips; never derive one balance from the other.
- Route each action's `credits_remaining` / 402 back to the matching pool's setter only.
- Gate reveal buttons on the SPECIAL pool; gate/label search + exportador "Ver" on the COMMON pool.
- Exportador "Ver" is NOT free — on 402 show an inline "sem créditos" message, not an empty importers list.
