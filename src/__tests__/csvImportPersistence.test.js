import { describe, expect, it } from "vitest";

function createFakeInvestmentStore(initialRows) {
  let rows = initialRows.map(row => ({ ...row }));

  return {
    persistence: {
      async deleteAllInvestments() {
        rows = [];
      },
      async upsertInvestments(importedRows) {
        for (const imported of importedRows) {
          const existingIndex = rows.findIndex(row => row.id === imported.id);
          if (existingIndex === -1) rows.push({ ...imported });
          else rows[existingIndex] = { ...imported };
        }
      },
    },
    readRows() {
      return rows;
    },
  };
}

describe("CSV import persistence", () => {
  it("replace removes the old open investments before storing the imported rows", async () => {
    const { persistCsvImport } = await import("../services/importPersistence.js");
    const store = createFakeInvestmentStore([{ id: "old-position", name: "Old" }]);
    const imported = [{ id: "new-position", name: "New" }];

    await persistCsvImport("replace", imported, store.persistence);

    expect(store.readRows()).toEqual(imported);
  });

  it("merge upserts imported rows without removing existing open investments", async () => {
    const { persistCsvImport } = await import("../services/importPersistence.js");
    const existing = { id: "existing-position", name: "Existing" };
    const imported = [{ id: "new-position", name: "New" }];
    const store = createFakeInvestmentStore([existing]);

    await persistCsvImport("merge", imported, store.persistence);

    expect(store.readRows()).toEqual([existing, ...imported]);
  });
});
