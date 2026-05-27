export const STORAGE_KEY = "investtrack_v2"; // v2 - új adatmodell

export const CATEGORIES = ["Részvény", "ETF", "Kötvény", "Kriptó", "Árupiaci", "Ingatlan", "Egyéb"];
export const CURRENCIES = ["HUF", "EUR", "USD", "GBP"];

export const CATEGORY_COLORS = {
  "Részvény": "#6EE7B7",
  "ETF":      "#93C5FD",
  "Kötvény":  "#FDE68A",
  "Kriptó":   "#F9A8D4",
  "Árupiaci": "#FCA5A5",
  "Ingatlan": "#C4B5FD",
  "Egyéb":    "#94A3B8",
};

export const POSITION_PALETTE = [
  "#6EE7B7","#93C5FD","#FDE68A","#F9A8D4","#FCA5A5","#C4B5FD","#6EE7F7",
  "#86EFAC","#FCD34D","#FDA4AF","#A5B4FC","#67E8F9","#BEF264","#FDBA74",
];

// Egy "lot" = egy vétel esemény
export const EMPTY_LOT = {
  id: "",
  price: "",
  quantity: "",
  date: "",
  notes: "",
};

// Pozíció alap – lots tömbbel
export const EMPTY_FORM = {
  name: "", ticker: "", category: "Részvény",
  currency: "HUF", currentPrice: "",
  targetPrice: "", dividendYield: "",
  notes: "",
  // lots: [{id, price, quantity, date, notes}] – a form kezeli
};

// Realizált eladás rekord
export const EMPTY_SALE = {
  id: "",
  invId: "",
  name: "", ticker: "",
  sellPrice: "",
  quantity: "",
  avgCostBasis: "", // FIFO átlag vételár az eladáskor
  currency: "",
  date: "",
  notes: "",
};
