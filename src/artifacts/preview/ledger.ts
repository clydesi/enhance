// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

export const NOW = Date.UTC(2027, 0, 31, 18);
export const START = "2026-02-01";
export const PATTERNS_END = "2027-01-28";
export const NEW_SINCE = "2027-01-25";

export type AccountType = "Checking" | "Savings" | "Credit Card" | "Brokerage" | "IRA" | "Real Estate" | "Mortgage";

export interface AccountDescription {
  id: string;
  name: string;
  type: AccountType;
  balance?: number;
  owner?: string;
  asset?: true;
  closed?: true;
  empty?: true;
  sourceName?: string;
  cardDates?: true;
}

export interface BusinessDescription {
  id: string;
  name: string;
  kind: string;
  form: "C" | "E";
}

export const BUSINESSES: BusinessDescription[] = [{ id: "ent_1", name: "Design Studio LLC", kind: "Single-member LLC", form: "C" }];

export const ACCOUNTS: AccountDescription[] = [
  { id: "acct_1", name: "Everyday Checking", type: "Checking", balance: 18_450_32 },
  { id: "acct_2", name: "High-Yield Savings", type: "Savings", balance: 64_200_00 },
  { id: "acct_3", name: "Travel Rewards Card", type: "Credit Card", sourceName: "TRAVEL REWARDS VISA ...4421", cardDates: true },
  { id: "acct_4", name: "Premium Card", type: "Credit Card" },
  { id: "acct_5", name: "Cash Back Card", type: "Credit Card" },
  { id: "acct_6", name: "Brokerage", type: "Brokerage", balance: 182_400_00 },
  { id: "acct_7", name: "Rollover IRA", type: "IRA", balance: 96_800_00, empty: true },
  { id: "acct_8", name: "Business Checking", type: "Checking", balance: 24_600_00, owner: "ent_1" },
  { id: "acct_9", name: "Rental House", type: "Real Estate", balance: 485_000_00, asset: true },
  { id: "acct_10", name: "Rental House Mortgage", type: "Mortgage", balance: -312_400_00 },
  { id: "acct_11", name: "Holiday Savings", type: "Savings", balance: 3_100_00 },
  { id: "acct_12", name: "Store Card", type: "Credit Card", balance: 0, closed: true, empty: true },
  { id: "acct_13", name: "Old Brokerage", type: "Brokerage", closed: true, empty: true },
];

export type When = { days: number[]; months?: number[] } | { every: number; from: number } | { perMonth: number };

export interface Line {
  category: string;
  cents: number;
  scope?: string;
}

export interface Merchant {
  payee: string;
  statement: string;
  account: string;
  category: string;
  scope?: string;
  cents: number | [number, number];
  in?: true;
  when: When;
  tags?: string[];
  notes?: string;
  lines?: Line[];
  mirror?: { account: string; payee: string; statement: string; category: string; cents: number };
}

const PERSONAL: Merchant[] = [
  { payee: "Employer Payroll", statement: "EMPLOYER PAYROLL DIR DEP", account: "acct_1", category: "personal.personal_income.paycheck", cents: 3_850_00, in: true, when: { days: [15, 31] } },
  { payee: "Oak Street Apartments", statement: "OAK STREET APTS RENT", account: "acct_1", category: "personal.home.rent", cents: 2_150_00, when: { days: [1] } },
  { payee: "City Electric", statement: "CITY ELECTRIC AUTOPAY", account: "acct_1", category: "personal.utilities.gas_electric", cents: [62_00, 138_00], when: { days: [18] } },
  { payee: "City Gas", statement: "CITY GAS CO", account: "acct_1", category: "personal.utilities.gas_electric", cents: [28_00, 115_00], when: { days: [21] } },
  { payee: "Internet Provider", statement: "INTERNET PROVIDER", account: "acct_1", category: "personal.utilities.internet_cable", cents: 79_99, when: { days: [12] } },
  { payee: "Mobile Carrier", statement: "MOBILE CARRIER", account: "acct_5", category: "personal.utilities.mobile_phone", cents: 85_40, when: { days: [22] } },
  { payee: "Streaming Video", statement: "STREAMING VIDEO", account: "acct_3", category: "personal.shopping.streaming_service", cents: 15_49, when: { days: [5] } },
  { payee: "Streaming Music", statement: "STREAMING MUSIC", account: "acct_5", category: "personal.shopping.streaming_service", cents: 10_99, when: { days: [9] } },
  { payee: "Cloud Storage", statement: "CLOUD STORAGE BILL", account: "acct_5", category: "personal.shopping.membership_fees", cents: 2_99, when: { days: [14] } },
  { payee: "Daily News", statement: "DAILY NEWS DIGITAL", account: "acct_3", category: "personal.shopping.books", cents: 17_00, when: { days: [3] } },
  { payee: "Fitness Club", statement: "FITNESS CLUB MONTHLY", account: "acct_4", category: "personal.fitness.gym", cents: 89_00, when: { days: [2] } },
  { payee: "Fresh Market", statement: "FRESH MARKET #1023", account: "acct_4", category: "personal.groceries", cents: [48_00, 165_00], when: { every: 7, from: 3 } },
  { payee: "Corner Grocery", statement: "CORNER GROCERY 0441", account: "acct_5", category: "personal.groceries", cents: [22_00, 68_00], when: { every: 9, from: 5 } },
  { payee: "Neighborhood Grocer", statement: "NEIGHBORHOOD GROCER", account: "acct_3", category: "personal.groceries", cents: [30_00, 92_00], when: { every: 16, from: 8 } },
  { payee: "Harvest Kitchen", statement: "HARVEST KITCHEN", account: "acct_3", category: "personal.dining_drinks.restaurants", cents: [58_00, 142_00], when: { perMonth: 2 } },
  { payee: "Diner on Main", statement: "DINER ON MAIN", account: "acct_3", category: "personal.dining_drinks.dining_out", cents: [24_00, 61_00], when: { perMonth: 2 } },
  { payee: "Salad Bar", statement: "SALAD BAR 118", account: "acct_5", category: "personal.dining_drinks.fast_food", cents: [12_50, 17_90], when: { perMonth: 4 } },
  { payee: "Roastery Cafe", statement: "SQ *ROASTERY CAFE", account: "acct_5", category: "personal.dining_drinks.coffee_shops", cents: [4_25, 11_80], when: { perMonth: 7 } },
  { payee: "Corner Lounge", statement: "CORNER LOUNGE", account: "acct_3", category: "personal.dining_drinks.bars", cents: [28_00, 84_00], when: { perMonth: 1 } },
  { payee: "Food Delivery Co", statement: "FOOD DELIVERY*ORDER", account: "acct_5", category: "personal.dining_drinks.food_delivery", cents: [26_00, 58_00], when: { perMonth: 3 } },
  { payee: "Gas Station", statement: "GAS STATION 4417", account: "acct_4", category: "personal.auto_transport.gas_fuel", cents: [36_00, 66_00], when: { every: 11, from: 4 } },
  { payee: "Rideshare Co", statement: "RIDESHARE *TRIP", account: "acct_3", category: "personal.auto_transport.rideshare", cents: [11_00, 34_00], when: { perMonth: 4 } },
  { payee: "Transit Card", statement: "TRANSIT CARD RELOAD", account: "acct_5", category: "personal.auto_transport.public_transportation", cents: 50_00, when: { days: [1] } },
  { payee: "City Parking", statement: "CITY PARKING", account: "acct_3", category: "personal.auto_transport.parking", cents: [9_00, 28_00], when: { perMonth: 2 } },
  { payee: "Online Marketplace", statement: "ONLINE MKTPLACE", account: "acct_4", category: "personal.shopping", cents: [14_00, 118_00], when: { perMonth: 3 } },
  { payee: "Home Goods Store", statement: "HOME GOODS STORE", account: "acct_4", category: "personal.home.home_supplies", cents: [28_00, 146_00], when: { perMonth: 1 } },
  { payee: "Department Store", statement: "DEPARTMENT STORE 0091", account: "acct_3", category: "personal.shopping.clothing", cents: [64_00, 248_00], when: { days: [19], months: [3, 5, 8, 11] } },
  { payee: "Department Store", statement: "DEPARTMENT STORE RETURN", account: "acct_3", category: "personal.shopping.clothing", cents: [30_00, 60_00], in: true, when: { days: [24], months: [5, 11] } },
  { payee: "Pharmacy", statement: "PHARMACY #2210", account: "acct_5", category: "personal.health.pharmacy", cents: [9_00, 44_00], when: { perMonth: 1 } },
  { payee: "Interest", statement: "INTEREST PAYMENT", account: "acct_2", category: "personal.personal_income.interest_earned", cents: [210_00, 260_00], in: true, when: { days: [28] } },
  { payee: "Dividend", statement: "DIVIDEND RECEIVED", account: "acct_6", category: "personal.personal_income.dividend_income", cents: [380_00, 720_00], in: true, when: { days: [27], months: [3, 6, 9, 12] } },
];

const BUSINESS: Merchant[] = [
  { payee: "Client One", statement: "CLIENT ONE ACH PMT", account: "acct_8", category: "business.business_income.consulting_income", scope: "ent_1", cents: [2_200_00, 4_400_00], in: true, when: { days: [6] } },
  { payee: "Client Two", statement: "CLIENT TWO PAYMENT", account: "acct_8", category: "business.business_income.consulting_income", scope: "ent_1", cents: [1_200_00, 2_600_00], in: true, when: { days: [20], months: [2, 4, 6, 8, 10, 12] } },
  { payee: "Office Suite", statement: "OFFICE SUITE SUBSCR", account: "acct_8", category: "business.office_expenses.software", scope: "ent_1", cents: 14_40, when: { days: [4] } },
  { payee: "Code Hosting", statement: "CODE HOSTING", account: "acct_8", category: "business.office_expenses.web_services", scope: "ent_1", cents: 21_00, when: { days: [7] } },
  { payee: "Design Tool", statement: "DESIGN TOOL", account: "acct_8", category: "business.office_expenses.software", scope: "ent_1", cents: 45_00, when: { days: [10] } },
  { payee: "Coworking Space", statement: "COWORKING SPACE", account: "acct_8", category: "business.rent_or_lease.building_rent", scope: "ent_1", cents: 450_00, when: { days: [1] } },
  { payee: "Steakhouse", statement: "STEAKHOUSE", account: "acct_3", category: "business.meals_clients_or_travel", scope: "ent_1", cents: [92_00, 186_00], when: { perMonth: 1 }, notes: "Client lunch" },
  { payee: "Airline", statement: "AIRLINE TICKET", account: "acct_4", category: "business.travel.airfare", scope: "ent_1", cents: [380_00, 540_00], when: { days: [9], months: [4, 10] }, tags: ["conference"] },
  { payee: "Downtown Hotel", statement: "DOWNTOWN HOTEL", account: "acct_4", category: "business.travel.lodging", scope: "ent_1", cents: [410_00, 690_00], when: { days: [14], months: [4, 10] }, tags: ["conference"] },
];

const RENTAL: Merchant[] = [
  { payee: "Vacation Rentals", statement: "VACATION RENTALS PAYOUT", account: "acct_1", category: "business.business_income.rents_received", scope: "acct_9", cents: [920_00, 1_840_00], in: true, when: { perMonth: 2 } },
  { payee: "Lakeside Cleaning", statement: "LAKESIDE CLEANING", account: "acct_1", category: "business.repairs_maintenance.cleaning", scope: "acct_9", cents: [95_00, 140_00], when: { perMonth: 2 }, notes: "Turnover between guests" },
  { payee: "Lake Power & Light", statement: "LAKE POWER LIGHT", account: "acct_1", category: "business.utilities.gas_electric", scope: "acct_9", cents: [58_00, 132_00], when: { days: [16] } },
  { payee: "Lake Water Utility", statement: "LAKE WATER UTILITY", account: "acct_1", category: "business.utilities.water", scope: "acct_9", cents: [42_00, 71_00], when: { days: [24], months: [3, 6, 9, 12] } },
  { payee: "Lakeside Property Management", statement: "LAKESIDE PROP MGMT", account: "acct_1", category: "business.commissions_fees.property_management", scope: "acct_9", cents: [180_00, 265_00], when: { days: [5] } },
  { payee: "Home Insurance Co", statement: "HOME INSURANCE CO", account: "acct_1", category: "business.insurance_other_than_health", scope: "acct_9", cents: 640_00, when: { days: [11], months: [3, 9] } },
  { payee: "County Treasurer", statement: "COUNTY TREASURER", account: "acct_1", category: "business.taxes_licenses.property_tax", scope: "acct_9", cents: 2_150_00, when: { days: [15], months: [6, 12] } },
  {
    payee: "Mortgage Servicer",
    statement: "MORTGAGE SERVICER PMT",
    account: "acct_1",
    category: "business.debt_interest.mortgage_interest",
    cents: 2_278_29,
    when: { days: [1] },
    lines: [
      { category: "transfers.transfer.mortgage_principal", cents: 412_30 },
      { category: "business.debt_interest.mortgage_interest", cents: 1_865_99, scope: "acct_9" },
    ],
    mirror: { account: "acct_10", payee: "Payment received", statement: "PAYMENT RECEIVED", category: "transfers.transfer.mortgage_principal", cents: 412_30 },
  },
];

export const MERCHANTS: Merchant[] = [...PERSONAL, ...BUSINESS, ...RENTAL];

export interface Transfer {
  from: string;
  to: string;
  cents: number | "card";
  days: number[];
  linked: boolean;
  out: { payee?: string; statement: string; category: string };
  into: { payee?: string; statement: string; category: string };
}

const CARD_PAYMENT = (card: string, statement: string): Transfer => ({
  from: "acct_1",
  to: card,
  cents: "card",
  days: [25],
  linked: true,
  out: { statement, category: "transfers.transfer.transfer_out" },
  into: { payee: "Payment received", statement: "AUTOPAY PAYMENT - THANK YOU", category: "transfers.transfer.transfer_in" },
});

export const TRANSFERS: Transfer[] = [
  { from: "acct_1", to: "acct_2", cents: 2_500_00, days: [2], linked: true, out: { statement: "ONLINE TRANSFER TO SAV ...4410", category: "transfers.transfer.transfer_out" }, into: { statement: "ONLINE TRANSFER FROM CHK ...8812", category: "transfers.transfer.transfer_in" } },
  { from: "acct_1", to: "acct_11", cents: 200_00, days: [2], linked: true, out: { statement: "ONLINE TRANSFER TO SAV ...7735", category: "transfers.transfer.transfer_out" }, into: { statement: "ONLINE TRANSFER FROM CHK ...8812", category: "transfers.transfer.transfer_in" } },
  { from: "acct_1", to: "acct_6", cents: 2_000_00, days: [3], linked: true, out: { statement: "BROKERAGE DEPOSIT", category: "transfers.transfer.transfer_out" }, into: { statement: "DEPOSIT", category: "transfers.transfer.investment_deposit" } },
  {
    from: "acct_8",
    to: "acct_1",
    cents: 2_000_00,
    days: [15],
    linked: false,
    out: { payee: "Owner's draw", statement: "ONLINE TRANSFER TO CHK ...8812", category: "transfers.transfer.owner_s_draw" },
    into: { payee: "Owner's draw", statement: "ONLINE TRANSFER FROM CHK ...3307", category: "transfers.transfer.owner_s_draw" },
  },
  CARD_PAYMENT("acct_3", "TRAVEL REWARDS CARD AUTOPAY"),
  CARD_PAYMENT("acct_4", "PREMIUM CARD PAYMENT"),
  CARD_PAYMENT("acct_5", "CASH BACK CARD AUTOPAY"),
];

export interface Entry {
  date: string;
  account: string;
  payee: string;
  statement: string;
  lines: { category: string | null; cents: number; scope?: string }[];
  tags?: string[];
  notes?: string;
  new?: true;
  flagged?: true;
  duplicate?: true;
  transfer?: { to: string; payee: string; statement: string };
}

export const SHOWCASE: Entry[] = [
  { date: "2027-01-31", account: "acct_4", payee: "Warehouse Club", statement: "WAREHOUSE CLUB #0388", lines: [{ category: "personal.groceries", cents: -171_25 }, { category: "personal.home.home_supplies", cents: -65_15 }] },
  { date: "2027-01-31", account: "acct_3", payee: "Online Marketplace", statement: "ONLINE MKTPLACE*7Q2W", lines: [{ category: "business.office_supplies", cents: -129_99, scope: "ent_1" }, { category: "personal.home.home_supplies", cents: -54_98 }] },
  { date: "2027-01-31", account: "acct_8", payee: "Print Shop", statement: "PRINT SHOP 2291", lines: [{ category: "business.office_expenses.printing", cents: -68_75, scope: "ent_1" }] },
  { date: "2027-01-30", account: "acct_1", payee: "Lake Handyman", statement: "LAKE HANDYMAN SVC", lines: [{ category: "business.repairs_maintenance.repairs", cents: -260_00, scope: "acct_9" }] },
  { date: "2027-01-30", account: "acct_3", payee: "Department Store", statement: "DEPARTMENT STORE 0091", lines: [{ category: "personal.shopping.clothing", cents: -318_40 }], flagged: true },
  { date: "2027-01-30", account: "acct_3", payee: "Harvest Kitchen", statement: "HARVEST KITCHEN", lines: [{ category: "personal.dining_drinks.restaurants", cents: -86_40 }], new: true, duplicate: true },
  { date: "2027-01-30", account: "acct_3", payee: "Harvest Kitchen", statement: "HARVEST KITCHEN", lines: [{ category: "personal.dining_drinks.restaurants", cents: -86_40 }], new: true },
  { date: "2027-01-29", account: "acct_1", payee: "Employer Payroll", statement: "EMPLOYER PAYROLL DIR DEP", lines: [{ category: "personal.personal_income.paycheck", cents: 3_850_00 }] },
  { date: "2027-01-29", account: "acct_4", payee: "Downtown Hotel", statement: "DOWNTOWN HOTEL", lines: [{ category: "personal.travel.hotel", cents: -412_60 }], tags: ["anniversary", "trip"], notes: "Two nights for the anniversary weekend" },
  { date: "2027-01-29", account: "acct_5", payee: "PAYMENT *CRAFTMARKET", statement: "PAYMENT *CRAFTMARKET", lines: [{ category: null, cents: -38_00 }], new: true },
  { date: "2027-01-29", account: "acct_1", payee: "Holiday Savings", statement: "ONLINE TRANSFER TO SAV ...7735", lines: [{ category: "transfers.transfer.transfer_out", cents: -300_00 }], transfer: { to: "acct_11", payee: "Everyday Checking", statement: "ONLINE TRANSFER FROM CHK ...8812" } },
  {
    date: "2027-01-29",
    account: "acct_1",
    payee: "Lakeview Neighborhood Community Association Recreation and Facilities Fund",
    statement: "LAKEVIEW NBHD COMMUNITY ASSN",
    lines: [{ category: "personal.home.hoa_fees", cents: -480_00 }],
    notes: "Annual dues for the pool, the tennis courts, and the clubhouse, paid in full this year for the early discount before the board raises the rate in the spring",
  },
];

export const PENDING: { date: string; account: string; statement: string; cents: number; seen: string }[] = [
  { date: "2027-01-31", account: "acct_3", statement: "RIDESHARE *TRIP", cents: 24_10, seen: "2027-01-31" },
  { date: "2027-01-31", account: "acct_5", statement: "SQ *ROASTERY CAFE", cents: 6_25, seen: "2027-01-31" },
  { date: "2027-01-30", account: "acct_4", statement: "GAS STATION 4417", cents: 58_30, seen: "2027-01-31" },
];
