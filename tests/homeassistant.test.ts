import { describe, it, expect, beforeAll, afterAll, afterEach, mock } from "bun:test";

process.env.ADMIN_ID = "12345";
process.env.HA_URL = "https://ha.test";
process.env.HA_TOKEN = "fake_token";

const MOCK_STATES = [
  { entity_id: "lock.front_door", attributes: { friendly_name: "Front Door" } },
  { entity_id: "lock.back_door", attributes: { friendly_name: "Back Door" } },
  { entity_id: "button.gate", attributes: { friendly_name: "Gate" } },
  { entity_id: "switch.light", attributes: { friendly_name: "Light" } },
  { entity_id: "cover.garage", attributes: { friendly_name: "Garage" } },
  { entity_id: "scene.movie", attributes: { friendly_name: "Movie Mode" } },
  { entity_id: "automation.welcome", attributes: { friendly_name: "Welcome" } },
  { entity_id: "input_boolean.toggle", attributes: { friendly_name: "Toggle" } },
  { entity_id: "sensor.temperature", attributes: { friendly_name: "Temp" } },
  { entity_id: "light.living_room", attributes: { friendly_name: "Living Room" } },
  { entity_id: "climate.thermostat", attributes: { friendly_name: "Thermostat" } },
];

describe("discoverEntities", () => {
  let discoverEntities: typeof import("@/homeassistant")["discoverEntities"];

  beforeAll(async () => {
    const mod = await import("@/homeassistant");
    discoverEntities = mod.discoverEntities;
  });

  afterEach(() => {
    mock.restore();
  });

  it("should only return entities with known domains", async () => {
    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify(MOCK_STATES), { status: 200 })
    );
    const result = await discoverEntities();
    const ids = result.map((e: any) => e.entity_id);
    expect(ids).not.toContain("sensor.temperature");
    expect(ids).not.toContain("light.living_room");
    expect(ids).not.toContain("climate.thermostat");
  });

  it("should return lock entities first", async () => {
    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify(MOCK_STATES), { status: 200 })
    );
    const result = await discoverEntities();
    const lockIndex = result.findIndex((e: any) => e.entity_id === "lock.front_door");
    const buttonIndex = result.findIndex((e: any) => e.entity_id === "button.gate");
    expect(lockIndex).toBeLessThan(buttonIndex);
  });

  it("should include friendly_name from attributes", async () => {
    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify(MOCK_STATES), { status: 200 })
    );
    const result = await discoverEntities();
    const frontDoor = result.find((e: any) => e.entity_id === "lock.front_door");
    expect(frontDoor?.friendly_name).toBe("Front Door");
  });

  it("should fall back to entity_id when friendly_name missing", async () => {
    const withoutName = [{ entity_id: "lock.unnamed", attributes: {} }];
    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify(withoutName), { status: 200 })
    );
    const result = await discoverEntities();
    expect(result[0].friendly_name).toBe("lock.unnamed");
  });

  it("should return empty array on fetch error", async () => {
    globalThis.fetch = mock(async () => { throw new Error("Network error"); });
    const result = await discoverEntities();
    expect(result).toEqual([]);
  });

  it("should return empty array on non-200 response", async () => {
    globalThis.fetch = mock(async () =>
      new Response("Unauthorized", { status: 401 })
    );
    const result = await discoverEntities();
    expect(result).toEqual([]);
  });
});

describe("callEntityAction", () => {
  let callEntityAction: typeof import("@/homeassistant")["callEntityAction"];

  beforeAll(async () => {
    const mod = await import("@/homeassistant");
    callEntityAction = mod.callEntityAction;
  });

  afterEach(() => {
    mock.restore();
  });

  it("should return success on 200 response", async () => {
    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify({}), { status: 200 })
    );
    const result = await callEntityAction("lock.test", "lock", "open");
    expect(result.success).toBe(true);
  });

  it("should return error on non-200 response", async () => {
    globalThis.fetch = mock(async () =>
      new Response("Service unavailable", { status: 503 })
    );
    const result = await callEntityAction("lock.test", "lock", "open");
    expect(result.success).toBe(false);
    expect(result.error).toContain("HTTP 503");
  });

  it("should return fetch error on network failure", async () => {
    globalThis.fetch = mock(async () => { throw new Error("ECONNREFUSED"); });
    const result = await callEntityAction("lock.test", "lock", "open");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Fetch error");
  });
});

describe("checkConnection", () => {
  let checkConnection: typeof import("@/homeassistant")["checkConnection"];

  beforeAll(async () => {
    const mod = await import("@/homeassistant");
    checkConnection = mod.checkConnection;
  });

  afterEach(() => {
    mock.restore();
  });

  it("should return success on 200", async () => {
    globalThis.fetch = mock(async () => new Response("OK", { status: 200 }));
    const result = await checkConnection();
    expect(result.success).toBe(true);
  });

  it("should return error on non-200", async () => {
    globalThis.fetch = mock(async () => new Response("Unauthorized", { status: 401 }));
    const result = await checkConnection();
    expect(result.success).toBe(false);
    expect(result.error).toContain("HTTP 401");
  });

  it("should return error on fetch failure", async () => {
    globalThis.fetch = mock(async () => { throw new Error("Network error"); });
    const result = await checkConnection();
    expect(result.success).toBe(false);
    expect(result.error).toContain("Fetch error");
  });
});

describe("fetchFriendlyNames", () => {
  let fetchFriendlyNames: typeof import("@/homeassistant")["fetchFriendlyNames"];

  beforeAll(async () => {
    const mod = await import("@/homeassistant");
    fetchFriendlyNames = mod.fetchFriendlyNames;
  });

  afterEach(() => {
    mock.restore();
  });

  it("should return a map of entity_id to friendly_name", async () => {
    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify(MOCK_STATES), { status: 200 })
    );
    const map = await fetchFriendlyNames();
    expect(map["lock.front_door"]).toBe("Front Door");
    expect(map["sensor.temperature"]).toBe("Temp");
  });

  it("should skip entities without friendly_name", async () => {
    const data = [
      { entity_id: "lock.a", attributes: { friendly_name: "A" } },
      { entity_id: "lock.b", attributes: {} },
    ];
    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify(data), { status: 200 })
    );
    const map = await fetchFriendlyNames();
    expect(map["lock.a"]).toBe("A");
    expect(map["lock.b"]).toBeUndefined();
  });

  it("should return empty object on error", async () => {
    globalThis.fetch = mock(async () => { throw new Error("error"); });
    const map = await fetchFriendlyNames();
    expect(map).toEqual({});
  });
});
