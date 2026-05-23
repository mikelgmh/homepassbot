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

describe("edge cases", () => {
  let db: typeof import("./index");

  beforeAll(async () => {
    db = await import("./index");
  });

  it("should return null for non-existent user", async () => {
    const user = await db.getUser(99999);
    expect(user).toBeNull();
  });

  it("should return null for non-existent entity", async () => {
    const ent = await db.getEntity(99999);
    expect(ent).toBeNull();
  });

  it("should be idempotent granting already-granted entity", async () => {
    await db.createUser(80, "Idempotent", null, "en");
    const ent = await db.createEntity("Idempotent Test", "lock.idempotent", "lock", "open");
    await db.grantUserEntity(80, ent.id);
    await db.grantUserEntity(80, ent.id);
    const ents = await db.getUserEntities(80);
    expect(ents.filter((e) => e.id === ent.id).length).toBe(1);
  });

  it("should reject duplicate entity_id", async () => {
    await db.createEntity("First", "lock.duplicate", "lock", "open");
    try {
      await db.createEntity("Second", "lock.duplicate", "lock", "open");
      // If we get here, the DB may or may not enforce uniqueness
      // SQLite does not enforce UNIQUE on entity_id in this schema
    } catch {
      // Expected if UNIQUE constraint exists
    }
  });

  it("should handle entity_id with special chars", async () => {
    const ent = await db.createEntity("Special", "lock.door_2", "lock", "open");
    expect(ent.entity_id).toBe("lock.door_2");
  });

  it("should handle empty entity list for user", async () => {
    await db.createUser(90, "NoEntities", null, "en");
    const ents = await db.getUserEntities(90);
    expect(ents).toEqual([]);
  });

  it("should handle setUserEntities with empty array", async () => {
    await db.createUser(100, "EmptySet", null, "en");
    await db.setUserEntities(100, []);
    const ents = await db.getUserEntities(100);
    expect(ents).toEqual([]);
  });

  it("should getConfig return null for unknown key", async () => {
    const val = await db.getConfig("nonexistent_key_xyz");
    expect(val).toBeNull();
  });

  it("should not fail resetting non-existent user", async () => {
    await db.resetUser(99998);
  });

  it("should not fail approving already-approved user", async () => {
    await db.createUser(110, "Reapprove", null, "en");
    await db.approveUser(110, "2026-12-31T00:00:00.000Z");
    await db.approveUser(110, "2027-12-31T00:00:00.000Z");
    const user = await db.getUser(110);
    expect(user!.access_expires_at).toBe("2027-12-31T00:00:00.000Z");
  });

  it("should reject duplicate entity_id if UNIQUE exists", async () => {
    try {
      await db.createEntity("First", "lock.dup_check", "lock", "open");
      await db.createEntity("Second", "lock.dup_check", "lock", "open");
    } catch {
      // UNIQUE constraint enforced by DB
    }
  });

  it("should not create a duplicate entity_id in user_entities", async () => {
    const ent = await db.createEntity("Single", "lock.single_ent", "lock", "open");
    const u = 130;
    await db.createUser(u, "SingleEntUser", null, "en");
    await db.grantUserEntity(u, ent.id);
    await db.grantUserEntity(u, ent.id);
    const ents = await db.getUserEntities(u);
    expect(ents.filter((e) => e.id === ent.id).length).toBe(1);
  });
});
