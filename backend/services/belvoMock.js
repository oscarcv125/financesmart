// belvoMock.js — soporte para múltiples tipos de tarjeta con transacciones propias

const INSTITUTION = "erebia_mx_retail";
const NOW         = () => new Date().toISOString();

// ─── Configuración por tipo de tarjeta ───────────────────────────────────────
const CARD_CONFIGS = {
  debito: {
    linkId:    "erebia-debit-v1",
    accountId: "acct-debit-0001",
    nombre:    "Erebia Débito",
    number:    "4056509190",
    category:  "CHECKING_ACCOUNT",
    type:      "CHECKING",
  },
  credito: {
    linkId:    "erebia-credit-v1",
    accountId: "acct-credit-0001",
    nombre:    "Erebia Crédito",
    number:    "5412750001",
    category:  "CREDIT_CARD",
    type:      "CREDIT_CARD",
  },
  amex: {
    linkId:    "erebia-amex-v1",
    accountId: "acct-amex-0001",
    nombre:    "American Express Oro",
    number:    "3782822463",
    category:  "CREDIT_CARD",
    type:      "CREDIT_CARD",
  },
  ahorro: {
    linkId:    "erebia-savings-v1",
    accountId: "acct-savings-0001",
    nombre:    "Erebia Ahorro",
    number:    "4791003820",
    category:  "SAVINGS_ACCOUNT",
    type:      "SAVINGS",
  },
};

// ─── Plantillas por tipo de tarjeta ──────────────────────────────────────────
const TEMPLATES = {
  debito: [
    { daysAgo:  2, amount: 320,   type: "OUTFLOW", desc: "Starbucks",             cat: "Comida y Bebida",         merchant: { name: "Starbucks",           business_type: "COFFEE",          city: "Monterrey", state: "Nuevo León", country: "MX" } },
    { daysAgo:  4, amount: 650,   type: "OUTFLOW", desc: "Uber Eats pedido",      cat: "Comida y Bebida",         merchant: { name: "Uber Eats",           business_type: "FOOD_DELIVERY",   city: "Monterrey", state: "Nuevo León", country: "MX" } },
    { daysAgo:  6, amount: 1250,  type: "OUTFLOW", desc: "Walmart Compras",       cat: "Supermercado",            merchant: { name: "Walmart",             business_type: "RETAIL",          city: "Monterrey", state: "Nuevo León", country: "MX" } },
    { daysAgo:  8, amount: 990,   type: "OUTFLOW", desc: "Pemex gasolina",        cat: "Transporte",              merchant: { name: "Pemex",               business_type: "GAS_STATION",     city: "Monterrey", state: "Nuevo León", country: "MX" } },
    { daysAgo: 10, amount: 3300,  type: "OUTFLOW", desc: "CFE",                   cat: "Servicios",               merchant: { name: "CFE",                 business_type: "UTILITIES",       city: null,        state: null,         country: "MX" } },
    { daysAgo: 12, amount: 2400,  type: "OUTFLOW", desc: "Telmex",                cat: "Servicios",               merchant: { name: "Telmex",              business_type: "UTILITIES",       city: null,        state: null,         country: "MX" } },
    { daysAgo: 14, amount: 480,   type: "OUTFLOW", desc: "McDonald's",            cat: "Comida y Bebida",         merchant: { name: "McDonald's",          business_type: "FAST_FOOD",       city: "Monterrey", state: "Nuevo León", country: "MX" } },
    { daysAgo: 16, amount: 380,   type: "OUTFLOW", desc: "Farmacia del Ahorro",   cat: "Salud",                   merchant: { name: "Farmacia del Ahorro", business_type: "PHARMACY",        city: "Monterrey", state: "Nuevo León", country: "MX" } },
    { daysAgo: 18, amount: 4200,  type: "OUTFLOW", desc: "OXXO",                  cat: "Supermercado",            merchant: { name: "OXXO",                business_type: "RETAIL",          city: "Monterrey", state: "Nuevo León", country: "MX" } },
    { daysAgo: 20, amount: 1540,  type: "OUTFLOW", desc: "Chedraui súper",        cat: "Supermercado",            merchant: { name: "Chedraui",            business_type: "SUPERMARKET",     city: "Monterrey", state: "Nuevo León", country: "MX" } },
    { daysAgo: 22, amount: 290,   type: "OUTFLOW", desc: "Domino's pizza",        cat: "Comida y Bebida",         merchant: { name: "Domino's",            business_type: "FAST_FOOD",       city: "Monterrey", state: "Nuevo León", country: "MX" } },
    { daysAgo: 25, amount: 24000, type: "INFLOW",  desc: "Nómina",                cat: "Depósito",                merchant: null },
    { daysAgo: 28, amount: 1200,  type: "OUTFLOW", desc: "TotalPlay internet",    cat: "Servicios",               merchant: { name: "TotalPlay",           business_type: "UTILITIES",       city: null,        state: null,         country: "MX" } },
    { daysAgo: 32, amount: 750,   type: "OUTFLOW", desc: "Cinépolis entradas",    cat: "Entretenimiento",         merchant: { name: "Cinépolis",           business_type: "ENTERTAINMENT",   city: "Monterrey", state: "Nuevo León", country: "MX" } },
    { daysAgo: 38, amount: 910,   type: "OUTFLOW", desc: "Uber viajes",           cat: "Transporte",              merchant: { name: "Uber",                business_type: "RIDE_SHARING",    city: "Monterrey", state: "Nuevo León", country: "MX" } },
    { daysAgo: 42, amount: 3500,  type: "OUTFLOW", desc: "Costco súper",          cat: "Supermercado",            merchant: { name: "Costco",              business_type: "WHOLESALE",       city: "Monterrey", state: "Nuevo León", country: "MX" } },
    { daysAgo: 48, amount: 6500,  type: "INFLOW",  desc: "SPEI recibido",         cat: "Depósito",                merchant: null },
    { daysAgo: 55, amount: 24000, type: "INFLOW",  desc: "Nómina",                cat: "Depósito",                merchant: null },
    { daysAgo: 60, amount: 1820,  type: "OUTFLOW", desc: "Amazon compra",         cat: "Compras en línea",        merchant: { name: "Amazon",              business_type: "E_COMMERCE",      city: null,        state: null,         country: "MX" } },
    { daysAgo: 70, amount: 3300,  type: "OUTFLOW", desc: "CFE",                   cat: "Servicios",               merchant: { name: "CFE",                 business_type: "UTILITIES",       city: null,        state: null,         country: "MX" } },
    { daysAgo: 85, amount: 24000, type: "INFLOW",  desc: "Nómina",                cat: "Depósito",                merchant: null },
  ],

  credito: [
    { daysAgo:  3, amount: 169,   type: "OUTFLOW", desc: "Netflix",               cat: "Entretenimiento",         merchant: { name: "Netflix",             business_type: "ENTERTAINMENT",   city: null,        state: null,         country: "MX" } },
    { daysAgo:  5, amount: 872,   type: "OUTFLOW", desc: "Spotify",               cat: "Entretenimiento",         merchant: { name: "Spotify",             business_type: "ENTERTAINMENT",   city: null,        state: null,         country: "MX" } },
    { daysAgo:  7, amount: 2800,  type: "OUTFLOW", desc: "Liverpool ropa",        cat: "Ropa y Accesorios",       merchant: { name: "Liverpool",           business_type: "DEPARTMENT_STORE",city: "Monterrey", state: "Nuevo León", country: "MX" } },
    { daysAgo:  9, amount: 1820,  type: "OUTFLOW", desc: "Amazon compra",         cat: "Compras en línea",        merchant: { name: "Amazon",              business_type: "E_COMMERCE",      city: null,        state: null,         country: "MX" } },
    { daysAgo: 11, amount: 620,   type: "OUTFLOW", desc: "Starbucks",             cat: "Comida y Bebida",         merchant: { name: "Starbucks",           business_type: "COFFEE",          city: "Monterrey", state: "Nuevo León", country: "MX" } },
    { daysAgo: 13, amount: 3800,  type: "OUTFLOW", desc: "Mercado Libre compra",  cat: "Compras en línea",        merchant: { name: "Mercado Libre",       business_type: "E_COMMERCE",      city: null,        state: null,         country: "MX" } },
    { daysAgo: 15, amount: 450,   type: "OUTFLOW", desc: "Apple Music",           cat: "Entretenimiento",         merchant: { name: "Apple Music",         business_type: "ENTERTAINMENT",   city: null,        state: null,         country: "MX" } },
    { daysAgo: 17, amount: 2100,  type: "OUTFLOW", desc: "Zara ropa",             cat: "Ropa y Accesorios",       merchant: { name: "Zara",                business_type: "APPAREL",         city: "Monterrey", state: "Nuevo León", country: "MX" } },
    { daysAgo: 19, amount: 560,   type: "OUTFLOW", desc: "Farmacia del Ahorro",   cat: "Salud",                   merchant: { name: "Farmacia del Ahorro", business_type: "PHARMACY",        city: "Monterrey", state: "Nuevo León", country: "MX" } },
    { daysAgo: 21, amount: 730,   type: "OUTFLOW", desc: "Sanborns restaurante",  cat: "Comida y Bebida",         merchant: { name: "Sanborns",            business_type: "RESTAURANT",      city: "Monterrey", state: "Nuevo León", country: "MX" } },
    { daysAgo: 25, amount: 12000, type: "INFLOW",  desc: "Pago de tarjeta",       cat: "Depósito",                merchant: null },
    { daysAgo: 30, amount: 1100,  type: "OUTFLOW", desc: "La Comer súper",        cat: "Supermercado",            merchant: { name: "La Comer",            business_type: "SUPERMARKET",     city: "Monterrey", state: "Nuevo León", country: "MX" } },
    { daysAgo: 33, amount: 560,   type: "OUTFLOW", desc: "Rappi entrega",         cat: "Comida y Bebida",         merchant: { name: "Rappi",               business_type: "FOOD_DELIVERY",   city: "Monterrey", state: "Nuevo León", country: "MX" } },
    { daysAgo: 36, amount: 4200,  type: "OUTFLOW", desc: "Amazon compra",         cat: "Compras en línea",        merchant: { name: "Amazon",              business_type: "E_COMMERCE",      city: null,        state: null,         country: "MX" } },
    { daysAgo: 40, amount: 1890,  type: "OUTFLOW", desc: "Sam's Club súper",      cat: "Supermercado",            merchant: { name: "Sam's Club",          business_type: "WHOLESALE",       city: "Monterrey", state: "Nuevo León", country: "MX" } },
    { daysAgo: 55, amount: 15000, type: "INFLOW",  desc: "Pago de tarjeta",       cat: "Depósito",                merchant: null },
    { daysAgo: 60, amount: 2100,  type: "OUTFLOW", desc: "Liverpool ropa",        cat: "Ropa y Accesorios",       merchant: { name: "Liverpool",           business_type: "DEPARTMENT_STORE",city: "Monterrey", state: "Nuevo León", country: "MX" } },
    { daysAgo: 65, amount: 750,   type: "OUTFLOW", desc: "Cinépolis entradas",    cat: "Entretenimiento",         merchant: { name: "Cinépolis",           business_type: "ENTERTAINMENT",   city: "Monterrey", state: "Nuevo León", country: "MX" } },
    { daysAgo: 70, amount: 3800,  type: "OUTFLOW", desc: "Mercado Libre compra",  cat: "Compras en línea",        merchant: { name: "Mercado Libre",       business_type: "E_COMMERCE",      city: null,        state: null,         country: "MX" } },
    { daysAgo: 85, amount: 13000, type: "INFLOW",  desc: "Pago de tarjeta",       cat: "Depósito",                merchant: null },
  ],

  amex: [
    { daysAgo:  4, amount: 3200,  type: "OUTFLOW", desc: "Hotel Presidente",      cat: "Viajes",                  merchant: { name: "Hotel Presidente",    business_type: "HOTEL",           city: "CDMX",      state: "CDMX",       country: "MX" } },
    { daysAgo:  6, amount: 1850,  type: "OUTFLOW", desc: "Aeromexico vuelo",      cat: "Viajes",                  merchant: { name: "Aeromexico",          business_type: "AIRLINE",         city: null,        state: null,         country: "MX" } },
    { daysAgo:  9, amount: 980,   type: "OUTFLOW", desc: "Sushi Itto",            cat: "Comida y Bebida",         merchant: { name: "Sushi Itto",          business_type: "RESTAURANT",      city: "Monterrey", state: "Nuevo León", country: "MX" } },
    { daysAgo: 12, amount: 4500,  type: "OUTFLOW", desc: "El Puerto de Liverpool",cat: "Ropa y Accesorios",       merchant: { name: "Liverpool",           business_type: "DEPARTMENT_STORE",city: "Monterrey", state: "Nuevo León", country: "MX" } },
    { daysAgo: 15, amount: 2200,  type: "OUTFLOW", desc: "Amazon EUA compra",     cat: "Compras en línea",        merchant: { name: "Amazon",              business_type: "E_COMMERCE",      city: null,        state: null,         country: "US" } },
    { daysAgo: 18, amount: 760,   type: "OUTFLOW", desc: "Chili's restaurante",   cat: "Comida y Bebida",         merchant: { name: "Chili's",             business_type: "RESTAURANT",      city: "Monterrey", state: "Nuevo León", country: "MX" } },
    { daysAgo: 22, amount: 6800,  type: "OUTFLOW", desc: "Apple Store",           cat: "Electrónica",             merchant: { name: "Apple Store",         business_type: "ELECTRONICS",     city: "Monterrey", state: "Nuevo León", country: "MX" } },
    { daysAgo: 25, amount: 25000, type: "INFLOW",  desc: "Pago Amex",             cat: "Depósito",                merchant: null },
    { daysAgo: 28, amount: 1400,  type: "OUTFLOW", desc: "Uber Eats premium",     cat: "Comida y Bebida",         merchant: { name: "Uber Eats",           business_type: "FOOD_DELIVERY",   city: "Monterrey", state: "Nuevo León", country: "MX" } },
    { daysAgo: 32, amount: 3600,  type: "OUTFLOW", desc: "Zara ropa viaje",       cat: "Ropa y Accesorios",       merchant: { name: "Zara",                business_type: "APPAREL",         city: "Monterrey", state: "Nuevo León", country: "MX" } },
    { daysAgo: 38, amount: 9500,  type: "OUTFLOW", desc: "Vuelos Copa Airlines",  cat: "Viajes",                  merchant: { name: "Copa Airlines",       business_type: "AIRLINE",         city: null,        state: null,         country: "PA" } },
    { daysAgo: 42, amount: 2100,  type: "OUTFLOW", desc: "Marriott Hotel",        cat: "Viajes",                  merchant: { name: "Marriott",            business_type: "HOTEL",           city: "Cancún",    state: "Quintana Roo",country: "MX" } },
    { daysAgo: 55, amount: 30000, type: "INFLOW",  desc: "Pago Amex",             cat: "Depósito",                merchant: null },
    { daysAgo: 60, amount: 5200,  type: "OUTFLOW", desc: "Palacio de Hierro",     cat: "Ropa y Accesorios",       merchant: { name: "Palacio de Hierro",   business_type: "DEPARTMENT_STORE",city: "CDMX",      state: "CDMX",       country: "MX" } },
    { daysAgo: 68, amount: 1200,  type: "OUTFLOW", desc: "Ruth's Chris Steak",    cat: "Comida y Bebida",         merchant: { name: "Ruth's Chris",        business_type: "RESTAURANT",      city: "Monterrey", state: "Nuevo León", country: "MX" } },
    { daysAgo: 75, amount: 3900,  type: "OUTFLOW", desc: "Aeromexico vuelo",      cat: "Viajes",                  merchant: { name: "Aeromexico",          business_type: "AIRLINE",         city: null,        state: null,         country: "MX" } },
    { daysAgo: 85, amount: 28000, type: "INFLOW",  desc: "Pago Amex",             cat: "Depósito",                merchant: null },
  ],

  ahorro: [
    { daysAgo:  5, amount: 3000,  type: "INFLOW",  desc: "Transferencia a ahorro",cat: "Depósito",                merchant: null },
    { daysAgo: 10, amount: 180,   type: "INFLOW",  desc: "Intereses generados",   cat: "Depósito",                merchant: null },
    { daysAgo: 20, amount: 5000,  type: "INFLOW",  desc: "Transferencia a ahorro",cat: "Depósito",                merchant: null },
    { daysAgo: 28, amount: 1500,  type: "OUTFLOW", desc: "Retiro efectivo",       cat: "Retiro",                  merchant: null },
    { daysAgo: 35, amount: 3000,  type: "INFLOW",  desc: "Transferencia a ahorro",cat: "Depósito",                merchant: null },
    { daysAgo: 40, amount: 210,   type: "INFLOW",  desc: "Intereses generados",   cat: "Depósito",                merchant: null },
    { daysAgo: 50, amount: 8000,  type: "INFLOW",  desc: "Transferencia a ahorro",cat: "Depósito",                merchant: null },
    { daysAgo: 60, amount: 3000,  type: "INFLOW",  desc: "Transferencia a ahorro",cat: "Depósito",                merchant: null },
    { daysAgo: 70, amount: 195,   type: "INFLOW",  desc: "Intereses generados",   cat: "Depósito",                merchant: null },
    { daysAgo: 85, amount: 5000,  type: "INFLOW",  desc: "Transferencia a ahorro",cat: "Depósito",                merchant: null },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function uid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
function ref() {
  return "REF" + String(Math.floor(1000000 + Math.random() * 9000000));
}
function randomize(base, pct = 0.25) {
  const factor = 1 + (Math.random() * 2 - 1) * pct;
  return parseFloat((base * factor).toFixed(2));
}
function daysAgo(n, jitter = 1) {
  const d = new Date();
  const offset = Math.floor((Math.random() * 2 - 1) * jitter);
  d.setDate(d.getDate() - n + offset);
  return d.toISOString().split("T")[0];
}

// ─── Generador de transacciones por tipo de tarjeta ───────────────────────────
function generateTransactionsForCard(cardType = "debito") {
  const config    = CARD_CONFIGS[cardType] || CARD_CONFIGS.debito;
  const templates = TEMPLATES[cardType]    || TEMPLATES.debito;
  const ts        = NOW();
  let runningBalance = randomize(45000, 0.35);

  return [...templates]
    .sort((a, b) => a.daysAgo - b.daysAgo)
    .map((t) => {
      const pct    = t.type === "INFLOW" ? 0.10 : 0.25;
      const amount = randomize(t.amount, pct);
      const date   = daysAgo(t.daysAgo, 1);

      const tx = {
        id: uid(),
        account: {
          id:           config.accountId,
          link:         config.linkId,
          institution:  INSTITUTION,
          category:     config.category,
          balance_type: "ASSET",
          type:         config.type,
          name:         config.nombre,
          number:       config.number,
          currency:     "MXN",
        },
        collected_at:    ts,
        created_at:      ts,
        value_date:      date,
        accounting_date: date,
        amount,
        balance:         parseFloat(runningBalance.toFixed(2)),
        currency:        "MXN",
        description:     t.desc,
        observations:    null,
        merchant:        t.merchant ? { ...t.merchant, logo: null, website: null } : null,
        category:        t.cat,
        subcategory:     null,
        reference:       ref(),
        type:            t.type,
        status:          "PROCESSED",
        gig_data:        null,
        credit_card_data: null,
      };

      runningBalance += t.type === "INFLOW" ? -amount : amount;
      return tx;
    });
}

// ─── Institución ficticia ─────────────────────────────────────────────────────
const MOCK_INSTITUTION = {
  name:             INSTITUTION,
  display_name:     "Erebia Banco (Demo)",
  country_codes:    ["MX"],
  primary_color:    "#1A73E8",
  logo:             null,
  features:         ["TRANSACTIONS_LAST_365_DAYS"],
  resources:        ["ACCOUNTS", "TRANSACTIONS"],
  integration_type: "CREDENTIALS",
  status:           "HEALTHY",
};

const MOCK_TOKEN = {
  access:  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.erebia_mock.erebia_mock_token",
  refresh: "erebia_mock_refresh",
};

// ─── Exports ──────────────────────────────────────────────────────────────────
function getMockInstitutions() {
  return { count: 1, next: null, previous: null, results: [MOCK_INSTITUTION] };
}
function getMockInstitution(name) {
  return name === INSTITUTION ? MOCK_INSTITUTION : null;
}
function getMockToken() { return MOCK_TOKEN; }

function getMockLink(cardType = "debito") {
  const config = CARD_CONFIGS[cardType] || CARD_CONFIGS.debito;
  return {
    id:              config.linkId,
    institution:     INSTITUTION,
    access_mode:     "recurrent",
    status:          "valid",
    created_by:      "erebia-mock",
    created_at:      NOW(),
    last_accessed_at: NOW(),
  };
}

function getMockTransactions({ cardType = "debito", page = 1, pageSize = 100, dateFrom, dateTo } = {}) {
  let results = generateTransactionsForCard(cardType);
  if (dateFrom) results = results.filter(t => t.value_date >= dateFrom);
  if (dateTo)   results = results.filter(t => t.value_date <= dateTo);

  const total   = results.length;
  const start   = (page - 1) * pageSize;
  const paged   = results.slice(start, start + pageSize);
  const hasNext = start + pageSize < total;

  return {
    count:    total,
    next:     hasNext  ? `?page=${page + 1}&page_size=${pageSize}` : null,
    previous: page > 1 ? `?page=${page - 1}&page_size=${pageSize}` : null,
    results:  paged,
  };
}

module.exports = {
  CARD_CONFIGS,
  INSTITUTION,
  getMockInstitutions,
  getMockInstitution,
  getMockToken,
  getMockLink,
  getMockTransactions,
  generateTransactionsForCard,
};
