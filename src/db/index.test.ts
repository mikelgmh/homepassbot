import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { unlinkSync, existsSync } from "fs";

const TEST_DB = "test.sqlite";

beforeAll(() => {
  process.env.DATABASE_PROVIDER = "sqlite";
  process.env.DATABASE_URL = TEST_DB;
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
});

afterAll(() => {
  try {
    const wal = TEST_DB + "-wal";
    const shm = TEST_DB + "-shm";
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
    if (existsSync(wal)) unlinkSync(wal);
    if (existsSync(shm)) unlinkSync(shm);
  } catch {}
});

describe("database operations", () => {
  let db: typeof import("./index");

  beforeAll(async () => {
    db = await import("./index");
  });

  it("should create and retrieve a user", async () => {
    await db.createUser(1, "Alice", "alice_bot", "en");
    const user = await db.getUser(1);
    expect(user).not.toBeNull();
    expect(user!.telegram_id).toBe(1);
    expect(user!.first_name).toBe("Alice");
    expect(user!.username).toBe("alice_bot");
    expect(user!.permission_status).toBe("pending");
    expect(user!.language_code).toBe("en");
  });

  it("should not duplicate users", async () => {
    await db.createUser(1, "Alice", "alice_bot", "en");
    const users = await db.getAllUsers();
    const matches = users.filter((u) => u.telegram_id === 1);
    expect(matches.length).toBe(1);
  });

  it("should approve a user", async () => {
    await db.approveUser(1, "2026-12-31T23:59:59.000Z");
    const user = await db.getUser(1);
    expect(user!.permission_status).toBe("allowed");
    expect(user!.access_expires_at).toBe("2026-12-31T23:59:59.000Z");
  });

  it("should deny a user", async () => {
    await db.denyUser(1);
    const user = await db.getUser(1);
    expect(user!.permission_status).toBe("denied");
    expect(user!.access_expires_at).toBeNull();
  });

  it("should reset (delete) a user and their permissions", async () => {
    await db.createUser(2, "Bob", null, "es");
    const ent = await db.createEntity("Test", "lock.test", "lock", "open");
    await db.setUserEntities(2, [ent.id]);
    await db.resetUser(2);
    const user = await db.getUser(2);
    expect(user).toBeNull();
    const userEnts = await db.getUserEntities(2);
    expect(userEnts.length).toBe(0);
  });

  it("should list users by status", async () => {
    await db.createUser(10, "Pending1", null, "en");
    await db.createUser(11, "Pending2", null, "en");
    const pending = await db.getUsersByStatus("pending");
    expect(pending.length).toBeGreaterThanOrEqual(2);
  });

  it("should update expiration", async () => {
    await db.approveUser(10, "2026-06-01T00:00:00.000Z");
    await db.updateExpiration(10, "2027-01-01T00:00:00.000Z");
    const user = await db.getUser(10);
    expect(user!.access_expires_at).toBe("2027-01-01T00:00:00.000Z");
  });

  it("should return expired users", async () => {
    await db.createUser(20, "Expired", null, "en");
    await db.approveUser(20, "2020-01-01T00:00:00.000Z");
    const expired = await db.getExpiredUsers();
    expect(expired.some((u) => u.telegram_id === 20)).toBe(true);
  });

  it("should expire a user", async () => {
    await db.createUser(30, "AboutToExpire", null, "en");
    await db.approveUser(30, "2026-12-31T00:00:00.000Z");
    await db.expireUser(30);
    const user = await db.getUser(30);
    expect(user!.permission_status).toBe("pending");
    expect(user!.access_expires_at).toBeNull();
  });

  it("should set and get language", async () => {
    await db.createUser(40, "LangTest", null, "en");
    await db.setUserLanguage(40, "es");
    const lang = await db.getUserLanguage(40);
    expect(lang).toBe("es");
  });
});

describe("entity operations", () => {
  let db: typeof import("./index");

  beforeAll(async () => {
    db = await import("./index");
  });

  it("should create and retrieve an entity", async () => {
    const ent = await db.createEntity("Front Door", "lock.front_door", "lock", "open");
    expect(ent.id).toBeGreaterThan(0);
    expect(ent.name).toBe("Front Door");
    expect(ent.entity_id).toBe("lock.front_door");
    expect(ent.domain).toBe("lock");
    expect(ent.service).toBe("open");
  });

  it("should get all entities", async () => {
    const all = await db.getAllEntities();
    expect(all.length).toBeGreaterThanOrEqual(1);
  });

  it("should get an entity by id", async () => {
    const all = await db.getAllEntities();
    const first = all[0];
    const found = await db.getEntity(first.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(first.id);
  });

  it("should update entity name", async () => {
    const ent = await db.createEntity("Old Name", "switch.test", "switch", "turn_on");
    await db.updateEntityName(ent.id, "New Name");
    const updated = await db.getEntity(ent.id);
    expect(updated!.name).toBe("New Name");
  });

  it("should delete an entity and its permissions", async () => {
    const ent = await db.createEntity("ToDelete", "button.to_delete", "button", "press");
    await db.createUser(50, "DelUser", null, "en");
    await db.setUserEntities(50, [ent.id]);
    await db.deleteEntity(ent.id);
    const deleted = await db.getEntity(ent.id);
    expect(deleted).toBeNull();
    const userEnts = await db.getUserEntities(50);
    expect(userEnts.some((e) => e.id === ent.id)).toBe(false);
  });
});

describe("user-entity permissions", () => {
  let db: typeof import("./index");

  beforeAll(async () => {
    db = await import("./index");
  });

  it("should grant and list user entities", async () => {
    await db.createUser(60, "GrantUser", null, "en");
    const ent = await db.createEntity("Grant Test", "lock.grant_test", "lock", "open");
    await db.grantUserEntity(60, ent.id);
    const userEnts = await db.getUserEntities(60);
    expect(userEnts.some((e) => e.id === ent.id)).toBe(true);
  });

  it("should revoke a user entity", async () => {
    await db.revokeUserEntity(60, (await db.getAllEntities()).find((e) => e.entity_id === "lock.grant_test")!.id);
    const userEnts = await db.getUserEntities(60);
    expect(userEnts.every((e) => e.entity_id !== "lock.grant_test")).toBe(true);
  });

  it("should set user entities (replace all)", async () => {
    await db.createUser(70, "SetUser", null, "en");
    const e1 = await db.createEntity("Set Test 1", "lock.set1", "lock", "open");
    const e2 = await db.createEntity("Set Test 2", "lock.set2", "lock", "open");
    await db.setUserEntities(70, [e1.id, e2.id]);
    let ents = await db.getUserEntities(70);
    expect(ents.length).toBe(2);
    await db.setUserEntities(70, [e1.id]);
    ents = await db.getUserEntities(70);
    expect(ents.length).toBe(1);
    expect(ents[0].id).toBe(e1.id);
  });
});

describe("config operations", () => {
  let db: typeof import("./index");

  beforeAll(async () => {
    db = await import("./index");
  });

  it("should have default receive_requests = false", async () => {
    const enabled = await db.getReceiveRequests();
    expect(enabled).toBe(false);
  });

  it("should set and get receive_requests", async () => {
    await db.setReceiveRequests(true);
    expect(await db.getReceiveRequests()).toBe(true);
    await db.setReceiveRequests(false);
    expect(await db.getReceiveRequests()).toBe(false);
  });

  it("should set and get arbitrary config", async () => {
    await db.setConfig("test_key", "test_value");
    const val = await db.getConfig("test_key");
    expect(val).toBe("test_value");
  });
});
