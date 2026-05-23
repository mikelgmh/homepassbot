const HA_URL = process.env.HA_URL ?? "";
const HA_TOKEN = process.env.HA_TOKEN ?? "";

export interface HaResult {
  success: boolean;
  error?: string;
}

export interface HaEntityInfo {
  entity_id: string;
  friendly_name: string;
  domain: string;
  service: string;
}

const DOMAIN_SERVICE_MAP: Record<string, string> = {
  button: "press",
  lock: "open",
  switch: "turn_on",
  cover: "open",
  scene: "turn_on",
  automation: "trigger",
  input_boolean: "turn_on",
};

export async function callEntityAction(
  entityId: string,
  domain: string,
  service: string,
): Promise<HaResult> {
  if (!HA_URL) return { success: false, error: "HA_URL is not set" };
  try {
    const res = await fetch(`${HA_URL}/api/services/${domain}/${service}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HA_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ entity_id: entityId }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) return { success: true };
    const body = await res.text().catch(() => "");
    return { success: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
  } catch (e) {
    return { success: false, error: `Fetch error: ${(e as Error).message || e}` };
  }
}

export async function fetchFriendlyNames(): Promise<Record<string, string>> {
  if (!HA_URL) return {};
  try {
    const res = await fetch(`${HA_URL}/api/states`, {
      headers: { Authorization: `Bearer ${HA_TOKEN}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return {};
    const states = await res.json() as any[];
    const result: Record<string, string> = {};
    for (const s of states) {
      const name = s.attributes?.friendly_name;
      if (name) result[s.entity_id] = name;
    }
    return result;
  } catch {
    return {};
  }
}

export async function checkConnection(): Promise<HaResult> {
  if (!HA_URL) {
    return { success: false, error: "HA_URL is not set" };
  }
  try {
    const res = await fetch(`${HA_URL}/api/`, {
      headers: { Authorization: `Bearer ${HA_TOKEN}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "(no body)");
      return { success: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: `Fetch error: ${(e as Error).message || e}` };
  }
}

export async function discoverEntities(): Promise<HaEntityInfo[]> {
  if (!HA_URL) return [];
  try {
    const res = await fetch(`${HA_URL}/api/states`, {
      headers: { Authorization: `Bearer ${HA_TOKEN}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.warn(`⚠️  HA entity discovery failed: HTTP ${res.status}`);
      return [];
    }

    const states = await res.json() as any[];
    const relevant = states.filter((s) => {
      const domain = s.entity_id?.split(".")[0];
      return domain && DOMAIN_SERVICE_MAP[domain];
    });

    return relevant
      .map((s) => {
        const domain = s.entity_id.split(".")[0];
        return {
          entity_id: s.entity_id,
          friendly_name: s.attributes?.friendly_name ?? s.entity_id,
          domain,
          service: DOMAIN_SERVICE_MAP[domain],
        };
      })
      .sort((a, b) => {
        if (a.domain === "lock" && b.domain !== "lock") return -1;
        if (a.domain !== "lock" && b.domain === "lock") return 1;
        return 0;
      });
  } catch (e) {
    console.warn(`⚠️  HA entity discovery failed: ${(e as Error).message || e}`);
    return [];
  }
}
