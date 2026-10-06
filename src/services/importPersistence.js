import { deleteInvestmentsExcept, upsertInvestments } from "./supabase";

const supabaseInvestmentPersistence = {
  deleteInvestmentsExcept,
  upsertInvestments,
};

export async function persistCsvImport({
  mode,
  investments,
  userId,
}, persistence = supabaseInvestmentPersistence) {
  if (mode !== "replace" && mode !== "merge") {
    throw new Error(`Ismeretlen CSV import mód: ${mode}`);
  }
  if (!userId) throw new Error("A CSV importhoz bejelentkezett felhasználó szükséges");

  // Upsert first so a failed write can never erase the existing portfolio.
  await persistence.upsertInvestments(investments, userId);

  if (mode === "replace") {
    await persistence.deleteInvestmentsExcept(investments.map(inv => inv.id), userId);
  }
}

export function createImportMutex() {
  let locked = false;
  return {
    tryLock() {
      if (locked) return false;
      locked = true;
      return true;
    },
    unlock() {
      locked = false;
    },
  };
}
