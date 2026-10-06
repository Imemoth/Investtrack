import { describe, expect, it } from "vitest";

function createFakeInvestmentStore(initialRows, { failUpsert = false } = {}) {
  let rows = initialRows.map(row => ({ ...row }));
  const userIds = [];

  return {
    persistence: {
      async upsertInvestments(importedRows, userId) {
        userIds.push(userId);
        if (failUpsert) throw new Error("upsert failed");
        for (const imported of importedRows) {
          const existingIndex = rows.findIndex(row => row.id === imported.id);
          if (existingIndex === -1) rows.push({ ...imported });
          else rows[existingIndex] = { ...imported };
        }
      },
      async deleteInvestmentsExcept(ids, userId) {
        userIds.push(userId);
        rows = rows.filter(row => ids.includes(row.id));
      },
    },
    readRows() {
      return rows;
    },
    readUserIds() {
      return userIds;
    },
  };
}

describe("CSV import persistence", () => {
  it("replace stores the import before pruning every old open investment", async () => {
    const { persistCsvImport } = await import("../services/importPersistence.js");
    const store = createFakeInvestmentStore([{ id: "old-position", name: "Old" }]);
    const imported = [{ id: "new-position", name: "New" }];

    await persistCsvImport({
      mode: "replace",
      investments: imported,
      userId: "user-a",
    }, store.persistence);

    expect(store.readRows()).toEqual(imported);
    expect(store.readUserIds()).toEqual(["user-a", "user-a"]);
  });

  it("replace preserves the old open investments when storing the import fails", async () => {
    const { persistCsvImport } = await import("../services/importPersistence.js");
    const existing = [{ id: "old-position", name: "Old" }];
    const store = createFakeInvestmentStore(existing, { failUpsert: true });

    await expect(
      persistCsvImport({
        mode: "replace",
        investments: [{ id: "new-position", name: "New" }],
        userId: "user-a",
      }, store.persistence),
    ).rejects.toThrow("upsert failed");

    expect(store.readRows()).toEqual(existing);
  });

  it("merge upserts imported rows without removing existing open investments", async () => {
    const { persistCsvImport } = await import("../services/importPersistence.js");
    const existing = { id: "existing-position", name: "Existing" };
    const imported = [{ id: "new-position", name: "New" }];
    const store = createFakeInvestmentStore([existing]);

    await persistCsvImport({
      mode: "merge",
      investments: imported,
      userId: "user-a",
    }, store.persistence);

    expect(store.readRows()).toEqual([existing, ...imported]);
    expect(store.readUserIds()).toEqual(["user-a"]);
  });
});

describe("CSV import mutex", () => {
  it("allows only one import until the active import releases the lock", async () => {
    const { createImportMutex } = await import("../services/importPersistence.js");
    const mutex = createImportMutex();

    expect(mutex.tryLock()).toBe(true);
    expect(mutex.tryLock()).toBe(false);

    mutex.unlock();

    expect(mutex.tryLock()).toBe(true);
  });
});
