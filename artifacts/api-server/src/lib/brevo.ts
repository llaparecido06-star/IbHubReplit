import { BrevoClient } from "@getbrevo/brevo";
import { logger } from "./logger.js";
import { config } from "./config.js";

/**
 * Shared Brevo (transactional email + contacts) client and helpers.
 *
 * Lazy-initialized so the BrevoClient is only built once `config` has been
 * parsed and BREVO_API_KEY is confirmed non-empty — a module-level
 * `new BrevoClient(...)` would run before config has a chance to throw on
 * missing vars, letting `apiKey` end up `undefined` and fail silently at
 * send time instead of at boot.
 */
let _brevo: BrevoClient | null = null;
export function getBrevoClient(): BrevoClient | null {
  if (!config.BREVO_API_KEY) {
    logger.warn("BREVO_API_KEY is not set — skipping Brevo operation");
    return null;
  }
  if (!_brevo) {
    _brevo = new BrevoClient({ apiKey: config.BREVO_API_KEY });
  }
  return _brevo;
}

/** Verified Brevo sender, shared across all ibhub transactional emails. */
export const BREVO_SENDER = { name: "ibhub", email: "atendimento@idealbi.com.br" };

const FOLDER_NAME = "ibhub";
const LIST_NAME = "ibhub - Usuários";

let _listIdPromise: Promise<number | null> | null = null;

/**
 * Finds (or creates) the "ibhub - Usuários" contact list inside an "ibhub"
 * folder in Brevo, and returns its id. Result is cached in-memory for the
 * life of the process — Brevo folders/lists are fully manageable via API,
 * no dashboard setup required.
 */
export async function getOrCreateIbhubListId(): Promise<number | null> {
  if (_listIdPromise) return _listIdPromise;

  _listIdPromise = (async () => {
    const brevo = getBrevoClient();
    if (!brevo) return null;

    try {
      const folders = await brevo.contacts.getFolders({ limit: 50 });
      let folder = folders.folders?.find((f) => f.name === FOLDER_NAME);
      let folderId = folder?.id;

      if (!folderId) {
        const created = await brevo.contacts.createFolder({ name: FOLDER_NAME });
        folderId = created.id;
      }

      if (!folderId) {
        logger.warn("Brevo: could not resolve or create the ibhub contacts folder");
        return null;
      }

      const lists = await brevo.contacts.getFolderLists({ folderId, limit: 50 });
      const list = lists.lists?.find((l) => l.name === LIST_NAME);
      if (list) return list.id;

      const createdList = await brevo.contacts.createList({ folderId, name: LIST_NAME });
      return createdList.id;
    } catch (err) {
      const e = err as Record<string, unknown>;
      logger.error(
        { brevoStatus: e.statusCode, brevoBody: e.body, brevoMessage: e.message ?? String(err) },
        "Brevo: failed to resolve the ibhub contacts list",
      );
      return null;
    }
  })();

  return _listIdPromise;
}

export interface BrevoContactInput {
  email: string;
  fullName: string | null;
  username: string | null;
  plan: string | null;
  signupDate: string | null;
}

/**
 * Upserts a contact in Brevo (create-or-update, never throws). Safe to call
 * repeatedly — Brevo's updateEnabled flag makes this idempotent.
 */
export async function upsertBrevoContact(contact: BrevoContactInput): Promise<boolean> {
  const brevo = getBrevoClient();
  if (!brevo) return false;

  const listId = await getOrCreateIbhubListId();

  try {
    await brevo.contacts.createContact({
      email: contact.email,
      updateEnabled: true,
      listIds: listId ? [listId] : undefined,
      attributes: {
        NOME: contact.fullName ?? "",
        USERNAME: contact.username ?? "",
        PLAN: contact.plan ?? "",
        SIGNUP_DATE: contact.signupDate ?? "",
      },
    });
    return true;
  } catch (err) {
    const e = err as Record<string, unknown>;
    logger.error(
      { email: contact.email, brevoStatus: e.statusCode, brevoBody: e.body, brevoMessage: e.message ?? String(err) },
      "Brevo: failed to upsert contact",
    );
    return false;
  }
}
