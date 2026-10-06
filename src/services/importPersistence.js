import { deleteAllInvestments, upsertInvestments } from "./supabase";

const supabaseInvestmentPersistence = {
  deleteAllInvestments,
  upsertInvestments,
};

export async function persistCsvImport(mode, investments, persistence = supabaseInvestmentPersistence) {
  if (mode === "replace") {
    await persistence.deleteAllInvestments();
  } else if (mode !== "merge") {
    throw new Error(`Ismeretlen CSV import mód: ${mode}`);
  }

  await persistence.upsertInvestments(investments);
}
