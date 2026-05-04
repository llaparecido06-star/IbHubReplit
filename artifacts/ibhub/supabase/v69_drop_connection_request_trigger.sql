-- v69: Drop the DB trigger that creates connection-request in-app notifications.
--
-- Root cause of the duplicate notification bug:
--   1. connection_notification_trigger (INSERT on connections) — created in
--      migrations_v29 — inserts "quer se conectar com você" into notifications.
--   2. sendConnectionRequest() in the frontend (profiles.ts) — also inserts
--      "enviou um pedido de conexão" into notifications.
--
-- Both fire for every connection request → receiver gets 2 notifications.
--
-- Fix: drop the DB trigger and keep only the frontend insert, which produces
-- the canonical message "enviou um pedido de conexão" and is already idiomatic
-- with the rest of the notification patterns in this codebase.
--
-- NOTE: the UPDATE trigger (connection_accepted_notification_trigger) is
-- intentionally NOT touched — it handles the "aceitou sua solicitação" path
-- which has no frontend insert equivalent.

DROP TRIGGER IF EXISTS connection_notification_trigger ON public.connections;
DROP FUNCTION IF EXISTS public.notify_on_connection_request();
