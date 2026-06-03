"use client";

import Image from "next/image";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

type TimeMode = "normal" | "peak";
type CashEntryKind = "income" | "expense";
type PaymentMode =
  | "cash"
  | "uber_cash"
  | "galicia_paul_bank"
  | "mercado_pago_transfer"
  | "posnet"
  | "pending"
  | "advance";
type CashBox = "cash" | "uber_cash" | "mercado_pago" | "galicia_paul";
type StatusTone = "default" | "success" | "error";
type IncomeReason = "manual" | "pending_payment";
type ExpenseReason = "manual" | "commission_payment";
type AppTab =
  | "calculator"
  | "pending"
  | "dashboard"
  | "accounts"
  | "cash"
  | "cashMovements"
  | "settings"
  | "audits";

type PricingConfig = {
  minimumFare: number;
  rates: {
    tier1: number;
    tier2: number;
    tier3: number;
  };
  peakMultiplier: number;
  cardSurcharge: number;
  hotelSurcharge: number;
  defaultTolls: number;
  hotelClientId: string;
};

type PermissionSet = {
  dashboard: boolean;
  accounts: boolean;
  cash: boolean;
  settings: boolean;
  audits: boolean;
};

type AppUser = {
  id: string;
  name: string;
  username: string;
  password: string;
  permissions: PermissionSet;
};

type Driver = {
  id: string;
  name: string;
  commissionRate: number;
};

type CorporateClient = {
  id: string;
  name: string;
};

type Passenger = {
  id: string;
  name: string;
};

type PendingTrip = {
  id: string;
  createdAt: string;
  driverId: string;
  driverName: string;
  passengerId: string;
  passengerName: string;
  clientId: string;
  clientName: string;
  origin: string;
  destination: string;
  kilometers: number;
  durationSeconds: number;
  paymentMode: PaymentMode;
  timeMode: TimeMode;
  hotelTrip: boolean;
  waitCharge: number;
  tolls: number;
  baseTotal: number;
  cardSurcharge: number;
  hotelFee: number;
  totalAmount: number;
  notes: string;
};

type ConfirmedTrip = PendingTrip & {
  confirmedAt: string;
};

type ClientLedgerEntry = {
  id: string;
  createdAt: string;
  clientId: string;
  clientName: string;
  amount: number;
  concept: string;
  source: "trip" | "pending_payment" | "hotel" | "manual";
};

type PassengerLedgerEntry = {
  id: string;
  createdAt: string;
  passengerId: string;
  passengerName: string;
  amount: number;
  concept: string;
  source: "trip" | "pending_payment" | "manual";
};

type DriverLedgerEntry = {
  id: string;
  createdAt: string;
  driverId: string;
  driverName: string;
  amount: number;
  concept: string;
  source: "trip_commission" | "commission_payment" | "manual";
};

type CashEntry = {
  id: string;
  createdAt: string;
  concept: string;
  amount: number;
  kind: CashEntryKind;
  reason: "manual" | "pending_payment" | "commission_payment" | "trip_payment";
  box: CashBox;
  linkedName?: string;
};

type AuditEntry = {
  id: string;
  createdAt: string;
  userName: string;
  action: string;
};

type RemoteAppState = {
  config?: Partial<PricingConfig>;
  users?: AppUser[];
  drivers?: Driver[];
  clients?: CorporateClient[];
  passengers?: Passenger[];
  pendingTrips?: PendingTrip[];
  confirmedTrips?: ConfirmedTrip[];
  clientLedger?: ClientLedgerEntry[];
  passengerLedger?: PassengerLedgerEntry[];
  driverLedger?: DriverLedgerEntry[];
  cashEntries?: CashEntry[];
  audits?: AuditEntry[];
};

type RouteSummary = {
  distanceKm: number;
  durationSeconds: number;
  includesTolls: boolean;
};

type DirectionsLeg = {
  distance?: { value?: number };
  duration?: { value?: number };
  duration_in_traffic?: { value?: number };
};

type DirectionsResponse = {
  routes?: Array<{
    legs?: DirectionsLeg[];
    warnings?: string[];
  }>;
};

type DirectionsServiceInstance = {
  route: (
    request: Record<string, unknown>,
    callback: (response: DirectionsResponse | null, status: string) => void
  ) => void;
};

type DirectionsRendererInstance = {
  setDirections: (response: DirectionsResponse) => void;
};

type GoogleMapsApi = {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => unknown;
  DirectionsService: new () => DirectionsServiceInstance;
  DirectionsRenderer: new (options: Record<string, unknown>) => DirectionsRendererInstance;
  TravelMode: { DRIVING: string };
  TrafficModel: { BEST_GUESS: string };
  places?: {
    Autocomplete: new (input: HTMLInputElement, options: Record<string, unknown>) => unknown;
  };
};

declare global {
  interface Window {
    google?: { maps: GoogleMapsApi };
    initMiChoferMaps?: () => void;
  }
}

const STORAGE_KEYS = {
  config: "miChoferPricingConfig",
  users: "miChoferUsers",
  drivers: "miChoferDrivers",
  clients: "miChoferClients",
  passengers: "miChoferPassengers",
  pendingTrips: "miChoferPendingTrips",
  confirmedTrips: "miChoferConfirmedTrips",
  clientLedger: "miChoferClientLedger",
  passengerLedger: "miChoferPassengerLedger",
  driverLedger: "miChoferDriverLedger",
  audits: "miChoferAudits",
  cash: "miChoferCashEntries",
  maps: "miChoferGoogleMapsApiKey"
};

const DEFAULT_PUBLIC_GOOGLE_MAPS_API_KEY = "AIzaSyCbcYMbdwfcfrGFPQKs3qwKCNR0o53baJ0";

const PAYMENT_OPTIONS: Array<{ value: PaymentMode; title: string; subtitle: string }> = [
  { value: "cash", title: "Cobro efectivo", subtitle: "Se acredita en caja efectivo" },
  { value: "uber_cash", title: "Cobro efectivo Uber", subtitle: "Se acredita en caja efectivo Uber" },
  { value: "galicia_paul_bank", title: "Cobro Banco Galicia Paul", subtitle: "Se acredita en caja Banco Galicia Paul" },
  {
    value: "mercado_pago_transfer",
    title: "Cobro transferencia Mercado Pago",
    subtitle: "Se acredita en Caja Mercado Pago sin descuento"
  },
  { value: "posnet", title: "Cobro posnet", subtitle: "Se acredita en Mercado Pago con descuento 12%" },
  { value: "pending", title: "Saldo pendiente", subtitle: "Se adeuda en cuenta corriente" },
  { value: "advance", title: "Saldo adelantado", subtitle: "Se descuenta del saldo a favor" }
];

const CASH_BOX_OPTIONS: Array<{ value: CashBox; label: string }> = [
  { value: "cash", label: "Caja efectivo" },
  { value: "uber_cash", label: "Caja efectivo Uber" },
  { value: "mercado_pago", label: "Caja Mercado Pago" },
  { value: "galicia_paul", label: "Caja Banco Galicia Paul" }
];

const MERCADO_PAGO_DISCOUNT_RATE = 0.12;

const DEFAULT_CONFIG: PricingConfig = {
  minimumFare: 15000,
  rates: {
    tier1: 1850,
    tier2: 1700,
    tier3: 1600
  },
  peakMultiplier: 1.15,
  cardSurcharge: 0.15,
  hotelSurcharge: 0.05,
  defaultTolls: 0,
  hotelClientId: "client-2"
};

const DEFAULT_USERS: AppUser[] = [
  {
    id: "admin",
    name: "Administrador",
    username: "admin",
    password: "Michofer2026",
    permissions: {
      dashboard: true,
      accounts: true,
      cash: true,
      settings: true,
      audits: true
    }
  },
  {
    id: "operador",
    name: "Operador",
    username: "operador",
    password: "Chofer2026",
    permissions: {
      dashboard: false,
      accounts: false,
      cash: false,
      settings: false,
      audits: false
    }
  }
];

const DEFAULT_DRIVERS: Driver[] = [
  { id: "driver-1", name: "Franco Diaz", commissionRate: 0.65 },
  { id: "driver-2", name: "Martin Rojas", commissionRate: 0.65 }
];

const DEFAULT_CLIENTS: CorporateClient[] = [
  { id: "client-1", name: "Mi Chofer" },
  { id: "client-2", name: "Wyndham" }
];

const DEFAULT_PASSENGERS: Passenger[] = [
  { id: "passenger-1", name: "Pasajero particular" },
  { id: "passenger-2", name: "Wyndham pasajero" }
];

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 11)}`;
}

function safeNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function normalizePassword(value: string) {
  return value.trim();
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2
  }).format(value);
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.max(1, Math.round(totalSeconds / 60));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (!hours) return `${minutes} min`;
  if (!remainingMinutes) return `${hours} h`;
  return `${hours} h ${remainingMinutes} min`;
}

function mergeConfig(raw: Partial<PricingConfig> | null): PricingConfig {
  if (!raw) {
    return {
      ...DEFAULT_CONFIG,
      rates: { ...DEFAULT_CONFIG.rates }
    };
  }

  return {
    minimumFare: Math.max(0, safeNumber(raw.minimumFare, DEFAULT_CONFIG.minimumFare)),
    rates: {
      tier1: Math.max(0, safeNumber(raw.rates?.tier1, DEFAULT_CONFIG.rates.tier1)),
      tier2: Math.max(0, safeNumber(raw.rates?.tier2, DEFAULT_CONFIG.rates.tier2)),
      tier3: Math.max(0, safeNumber(raw.rates?.tier3, DEFAULT_CONFIG.rates.tier3))
    },
    peakMultiplier: Math.max(1, safeNumber(raw.peakMultiplier, DEFAULT_CONFIG.peakMultiplier)),
    cardSurcharge: Math.max(0, safeNumber(raw.cardSurcharge, DEFAULT_CONFIG.cardSurcharge)),
    hotelSurcharge: Math.max(0, safeNumber(raw.hotelSurcharge, DEFAULT_CONFIG.hotelSurcharge)),
    defaultTolls: Math.max(0, safeNumber(raw.defaultTolls, DEFAULT_CONFIG.defaultTolls)),
    hotelClientId: raw.hotelClientId || DEFAULT_CONFIG.hotelClientId
  };
}

function normalizeUsers(rawUsers: AppUser[]): AppUser[] {
  const normalized = rawUsers
    .map((user) => ({
      ...user,
      id: user.id || makeId("user"),
      name: normalizeName(user.name || user.username || "Usuario"),
      username: normalizeUsername(user.username || ""),
      password: normalizePassword(user.password || ""),
      permissions: {
        dashboard: Boolean(user.permissions?.dashboard),
        accounts: Boolean((user.permissions as Partial<PermissionSet>)?.accounts),
        cash: Boolean(user.permissions?.cash),
        settings: Boolean(user.permissions?.settings),
        audits: Boolean(user.permissions?.audits)
      }
    }))
    .filter((user) => Boolean(user.username) && Boolean(user.password));

  const defaultAdmin = DEFAULT_USERS.find((user) => user.username === "admin") || DEFAULT_USERS[0];
  const adminIndex = normalized.findIndex((user) => normalizeUsername(user.username) === defaultAdmin.username);

  if (adminIndex === -1) {
    normalized.push(defaultAdmin);
  } else {
    normalized[adminIndex] = {
      ...normalized[adminIndex],
      id: normalized[adminIndex].id || defaultAdmin.id,
      name: normalized[adminIndex].name || defaultAdmin.name,
      username: defaultAdmin.username,
      password: defaultAdmin.password,
      permissions: { ...defaultAdmin.permissions }
    };
  }

  return normalized;
}

function normalizeDrivers(rawDrivers: Driver[]): Driver[] {
  return rawDrivers.map((driver) => ({
    ...driver,
    commissionRate: Math.min(1, Math.max(0, safeNumber(driver.commissionRate, 0.65)))
  }));
}

function normalizePassengers(rawPassengers: Passenger[]): Passenger[] {
  return rawPassengers
    .map((passenger) => ({
      ...passenger,
      id: passenger.id || makeId("passenger"),
      name: normalizeName(passenger.name || "Pasajero")
    }))
    .filter((passenger) => Boolean(passenger.name));
}

function normalizeCashEntries(rawEntries: CashEntry[]): CashEntry[] {
  return rawEntries.map((entry) => ({
    ...entry,
    box: entry.box || "cash"
  }));
}

function mergePassengerLists(...lists: Passenger[][]) {
  const seen = new Set<string>();
  const merged: Passenger[] = [];

  lists.flat().forEach((passenger) => {
    const name = normalizeName(passenger.name || "");
    const key = name.toLowerCase();
    if (!name || seen.has(key)) return;
    seen.add(key);
    merged.push({ id: passenger.id || makeId("passenger"), name });
  });

  return merged.length ? merged : DEFAULT_PASSENGERS;
}

function normalizeTripsWithPassengers<T extends PendingTrip | ConfirmedTrip>(rawTrips: T[], fallbackPassengers: Passenger[]) {
  return rawTrips.map((trip) => {
    const legacyPassengerName = normalizeName(trip.passengerName || trip.clientName || "Pasajero");
    const passenger =
      fallbackPassengers.find((item) => item.id === trip.passengerId) ||
      fallbackPassengers.find((item) => item.name.toLowerCase() === legacyPassengerName.toLowerCase());

    return {
      ...trip,
      passengerId: trip.passengerId || passenger?.id || trip.clientId || makeId("passenger"),
      passengerName: trip.passengerName || passenger?.name || legacyPassengerName
    };
  });
}

function calculateTieredDistancePrice(distanceKm: number, config: PricingConfig) {
  const firstTierKm = Math.min(distanceKm, 10);
  const secondTierKm = Math.min(Math.max(distanceKm - 10, 0), 15);
  const thirdTierKm = Math.max(distanceKm - 25, 0);

  return (
    firstTierKm * config.rates.tier1 +
    secondTierKm * config.rates.tier2 +
    thirdTierKm * config.rates.tier3
  );
}

function getRouteError(status: string) {
  const messages: Record<string, string> = {
    ZERO_RESULTS: "No se encontro una ruta manejable entre esas direcciones.",
    NOT_FOUND: "Alguna direccion no pudo reconocerse.",
    OVER_QUERY_LIMIT: "Se alcanzo el limite de consultas de Google Maps.",
    REQUEST_DENIED: "Google Maps rechazo la solicitud. Revisa la API key.",
    INVALID_REQUEST: "La solicitud de ruta esta incompleta."
  };
  return messages[status] || "No se pudo calcular la ruta en este momento.";
}

function getPaymentUsesCardSurcharge(paymentMode: PaymentMode) {
  return paymentMode === "posnet";
}

function getCashBoxLabel(box: CashBox) {
  return CASH_BOX_OPTIONS.find((item) => item.value === box)?.label || box;
}

function slugifyName(value: string) {
  return normalizeName(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getLocalDateTimeInputValue(date = new Date()) {
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function escapeCsvValue(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]);
  const csv = [
    headers.map(escapeCsvValue).join(";"),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(";"))
  ].join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [config, setConfig] = useState<PricingConfig>({ ...DEFAULT_CONFIG, rates: { ...DEFAULT_CONFIG.rates } });
  const [users, setUsers] = useState<AppUser[]>(DEFAULT_USERS);
  const [drivers, setDrivers] = useState<Driver[]>(DEFAULT_DRIVERS);
  const [clients, setClients] = useState<CorporateClient[]>(DEFAULT_CLIENTS);
  const [passengers, setPassengers] = useState<Passenger[]>(DEFAULT_PASSENGERS);

  const [pendingTrips, setPendingTrips] = useState<PendingTrip[]>([]);
  const [confirmedTrips, setConfirmedTrips] = useState<ConfirmedTrip[]>([]);
  const [clientLedger, setClientLedger] = useState<ClientLedgerEntry[]>([]);
  const [passengerLedger, setPassengerLedger] = useState<PassengerLedgerEntry[]>([]);
  const [driverLedger, setDriverLedger] = useState<DriverLedgerEntry[]>([]);
  const [cashEntries, setCashEntries] = useState<CashEntry[]>([]);
  const [audits, setAudits] = useState<AuditEntry[]>([]);

  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>("calculator");
  const [hasHydrated, setHasHydrated] = useState(false);

  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [mapsReady, setMapsReady] = useState(false);
  const [needsApiKey, setNeedsApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [activeApiKey, setActiveApiKey] = useState("");
  const [loadingRoute, setLoadingRoute] = useState(false);

  const [message, setMessage] = useState("Completa origen y destino para calcular el viaje.");
  const [messageType, setMessageType] = useState<StatusTone>("default");

  const [selectedDriverId, setSelectedDriverId] = useState(DEFAULT_DRIVERS[0].id);
  const [selectedClientId, setSelectedClientId] = useState(DEFAULT_CLIENTS[0].id);
  const [passengerInput, setPassengerInput] = useState(DEFAULT_PASSENGERS[0].name);
  const [manualKm, setManualKm] = useState(0);
  const [useManualAmount, setUseManualAmount] = useState(false);
  const [manualTripAmount, setManualTripAmount] = useState(0);
  const [waitValue, setWaitValue] = useState(0);
  const [manualTolls, setManualTolls] = useState(0);
  const [includeTolls, setIncludeTolls] = useState(true);
  const [hotelTrip, setHotelTrip] = useState(false);
  const [timeMode, setTimeMode] = useState<TimeMode>("normal");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);

  const [cashConcept, setCashConcept] = useState("");
  const [cashAmount, setCashAmount] = useState(0);
  const [cashDate, setCashDate] = useState(getLocalDateTimeInputValue());
  const [cashKind, setCashKind] = useState<CashEntryKind>("income");
  const [cashBox, setCashBox] = useState<CashBox>("cash");
  const [incomeReason, setIncomeReason] = useState<IncomeReason>("manual");
  const [expenseReason, setExpenseReason] = useState<ExpenseReason>("manual");
  const [cashPassengerId, setCashPassengerId] = useState(DEFAULT_PASSENGERS[0].id);
  const [cashDriverId, setCashDriverId] = useState(DEFAULT_DRIVERS[0].id);
  const [selectedCashBoxFilter, setSelectedCashBoxFilter] = useState<CashBox | "all">("all");

  const [newUserName, setNewUserName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newUserDashboard, setNewUserDashboard] = useState(false);
  const [newUserAccounts, setNewUserAccounts] = useState(false);
  const [newUserCash, setNewUserCash] = useState(false);
  const [newUserSettings, setNewUserSettings] = useState(false);
  const [newUserAudits, setNewUserAudits] = useState(false);

  const [newDriverName, setNewDriverName] = useState("");
  const [newDriverRatePercent, setNewDriverRatePercent] = useState(65);
  const [newClientName, setNewClientName] = useState("");
  const [newPassengerName, setNewPassengerName] = useState("");
  const [activeNumberField, setActiveNumberField] = useState<string | null>(null);

  const mapRef = useRef<HTMLDivElement | null>(null);
  const originRef = useRef<HTMLInputElement | null>(null);
  const stop1Ref = useRef<HTMLInputElement | null>(null);
  const stop2Ref = useRef<HTMLInputElement | null>(null);
  const destinationRef = useRef<HTMLInputElement | null>(null);
  const directionsServiceRef = useRef<DirectionsServiceInstance | null>(null);
  const directionsRendererRef = useRef<DirectionsRendererInstance | null>(null);

  const currentUser = useMemo(
    () => users.find((item) => item.id === sessionUserId) ?? null,
    [sessionUserId, users]
  );

  const canDashboard = currentUser?.permissions.dashboard ?? false;
  const canAccounts = currentUser?.permissions.accounts ?? false;
  const canCash = currentUser?.permissions.cash ?? false;
  const canSettings = currentUser?.permissions.settings ?? false;
  const canAudits = currentUser?.permissions.audits ?? false;

  const selectedDriver = useMemo(
    () => drivers.find((driver) => driver.id === selectedDriverId) ?? null,
    [drivers, selectedDriverId]
  );
  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) ?? null,
    [clients, selectedClientId]
  );
  const selectedPassenger = useMemo(
    () => passengers.find((passenger) => passenger.name.toLowerCase() === normalizeName(passengerInput).toLowerCase()) ?? null,
    [passengerInput, passengers]
  );

  const quote = useMemo(() => {
    const distanceKm = routeSummary?.distanceKm ?? Math.max(0, manualKm);
    const distancePrice = calculateTieredDistancePrice(distanceKm, config);
    const subtotal = Math.max(config.minimumFare, distancePrice);
    const peakSurcharge = timeMode === "peak" ? subtotal * (config.peakMultiplier - 1) : 0;
    const afterPeak = subtotal + peakSurcharge;
    const hotelFee = hotelTrip ? afterPeak * config.hotelSurcharge : 0;
    const tolls = includeTolls ? Math.max(0, manualTolls) + config.defaultTolls : 0;
    const waitCharge = Math.max(0, waitValue);
    const baseTotal = afterPeak + hotelFee + tolls + waitCharge;
    const cardSurcharge = baseTotal * config.cardSurcharge;
    const cardTotal = baseTotal + cardSurcharge;
    const calculatedTotal = getPaymentUsesCardSurcharge(paymentMode) ? cardTotal : baseTotal;
    const selectedTotal = useManualAmount ? Math.max(0, manualTripAmount) : calculatedTotal;

    return {
      distanceKm,
      distancePrice,
      subtotal,
      peakSurcharge,
      hotelFee,
      tolls,
      waitCharge,
      baseTotal,
      cardSurcharge,
      cardTotal,
      selectedTotal,
      calculatedTotal,
      minimumApplied: distancePrice < config.minimumFare ? config.minimumFare : 0
    };
  }, [
    config,
    hotelTrip,
    includeTolls,
    manualKm,
    manualTripAmount,
    manualTolls,
    paymentMode,
    routeSummary,
    timeMode,
    useManualAmount,
    waitValue
  ]);

  const clientBalances = useMemo(() => {
    const amounts = new Map<string, number>();
    clients.forEach((client) => amounts.set(client.id, 0));
    clientLedger.forEach((entry) => {
      amounts.set(entry.clientId, (amounts.get(entry.clientId) || 0) + entry.amount);
    });
    return clients.map((client) => ({
      ...client,
      balance: amounts.get(client.id) || 0
    }));
  }, [clientLedger, clients]);

  const passengerBalances = useMemo(() => {
    const amounts = new Map<string, { id: string; name: string; balance: number }>();
    passengers.forEach((passenger) => amounts.set(passenger.id, { ...passenger, balance: 0 }));
    passengerLedger.forEach((entry) => {
      const current = amounts.get(entry.passengerId) || {
        id: entry.passengerId,
        name: entry.passengerName,
        balance: 0
      };
      amounts.set(entry.passengerId, {
        ...current,
        name: current.name || entry.passengerName,
        balance: current.balance + entry.amount
      });
    });
    return Array.from(amounts.values());
  }, [passengerLedger, passengers]);

  const driverBalances = useMemo(() => {
    const amounts = new Map<string, number>();
    drivers.forEach((driver) => amounts.set(driver.id, 0));
    driverLedger.forEach((entry) => {
      amounts.set(entry.driverId, (amounts.get(entry.driverId) || 0) + entry.amount);
    });
    return drivers.map((driver) => ({
      ...driver,
      balance: amounts.get(driver.id) || 0
    }));
  }, [driverLedger, drivers]);

  const totalIncome = cashEntries.filter((entry) => entry.kind === "income").reduce((sum, entry) => sum + entry.amount, 0);
  const totalExpense = cashEntries.filter((entry) => entry.kind === "expense").reduce((sum, entry) => sum + entry.amount, 0);
  const cashBalance = totalIncome - totalExpense;
  const boxBalances = useMemo(() => {
    const balances: Record<CashBox, number> = {
      cash: 0,
      uber_cash: 0,
      mercado_pago: 0,
      galicia_paul: 0
    };

    cashEntries.forEach((entry) => {
      const sign = entry.kind === "income" ? 1 : -1;
      balances[entry.box] += sign * entry.amount;
    });

    return balances;
  }, [cashEntries]);
  const totalBilled = confirmedTrips.reduce((sum, trip) => sum + trip.totalAmount, 0);

  const filteredCashEntries = useMemo(
    () =>
      selectedCashBoxFilter === "all"
        ? cashEntries
        : cashEntries.filter((entry) => entry.box === selectedCashBoxFilter),
    [cashEntries, selectedCashBoxFilter]
  );

  function readStorage<T>(key: string, fallback: T): T {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  function writeStorage(key: string, value: unknown) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  function readLocalState(): RemoteAppState {
    return {
      config: readStorage<Partial<PricingConfig> | null>(STORAGE_KEYS.config, null) || undefined,
      users: readStorage<AppUser[]>(STORAGE_KEYS.users, DEFAULT_USERS),
      drivers: readStorage<Driver[]>(STORAGE_KEYS.drivers, DEFAULT_DRIVERS),
      clients: readStorage<CorporateClient[]>(STORAGE_KEYS.clients, DEFAULT_CLIENTS),
      passengers: readStorage<Passenger[]>(STORAGE_KEYS.passengers, []),
      pendingTrips: readStorage<PendingTrip[]>(STORAGE_KEYS.pendingTrips, []),
      confirmedTrips: readStorage<ConfirmedTrip[]>(STORAGE_KEYS.confirmedTrips, []),
      clientLedger: readStorage<ClientLedgerEntry[]>(STORAGE_KEYS.clientLedger, []),
      passengerLedger: readStorage<PassengerLedgerEntry[]>(STORAGE_KEYS.passengerLedger, []),
      driverLedger: readStorage<DriverLedgerEntry[]>(STORAGE_KEYS.driverLedger, []),
      cashEntries: readStorage<CashEntry[]>(STORAGE_KEYS.cash, []),
      audits: readStorage<AuditEntry[]>(STORAGE_KEYS.audits, [])
    };
  }

  function getStateWeight(state: RemoteAppState | null) {
    if (!state) return 0;

    return (
      (state.users?.length || 0) +
      (state.drivers?.length || 0) +
      (state.clients?.length || 0) +
      (state.passengers?.length || 0) +
      (state.pendingTrips?.length || 0) * 4 +
      (state.confirmedTrips?.length || 0) * 4 +
      (state.clientLedger?.length || 0) * 3 +
      (state.passengerLedger?.length || 0) * 3 +
      (state.driverLedger?.length || 0) * 3 +
      (state.cashEntries?.length || 0) * 4 +
      (state.audits?.length || 0)
    );
  }

  async function readRemoteState(): Promise<RemoteAppState | null> {
    try {
      const response = await fetch("/api/state", {
        cache: "no-store"
      });

      if (!response.ok) return null;

      const payload = (await response.json()) as { data?: RemoteAppState | null };
      return payload.data || null;
    } catch {
      return null;
    }
  }

  async function writeRemoteState(data: RemoteAppState) {
    try {
      await fetch("/api/state", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ data })
      });
    } catch {
      // Si Neon no esta disponible, localStorage sigue funcionando como respaldo.
    }
  }

  function getPersistedState(): RemoteAppState {
    return {
      config,
      users,
      drivers,
      clients,
      passengers,
      pendingTrips,
      confirmedTrips,
      clientLedger,
      passengerLedger,
      driverLedger,
      cashEntries,
      audits
    };
  }

  function getNumberInputValue(fieldName: string, value: number) {
    return activeNumberField === fieldName && value === 0 ? "" : value;
  }

  function parseNumberInput(rawValue: string, fallback = 0) {
    if (rawValue.trim() === "") return fallback;
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function registerAudit(action: string, actorName?: string) {
    const entry: AuditEntry = {
      id: makeId("audit"),
      createdAt: new Date().toISOString(),
      userName: actorName || currentUser?.name || "Sistema",
      action
    };
    setAudits((current) => [entry, ...current].slice(0, 600));
  }

  function addClientLedgerEntry(entry: Omit<ClientLedgerEntry, "id" | "createdAt">) {
    setClientLedger((current) => [
      {
        id: makeId("client-ledger"),
        createdAt: new Date().toISOString(),
        ...entry
      },
      ...current
    ]);
  }

  function addPassengerLedgerEntry(entry: Omit<PassengerLedgerEntry, "id" | "createdAt">) {
    setPassengerLedger((current) => [
      {
        id: makeId("passenger-ledger"),
        createdAt: new Date().toISOString(),
        ...entry
      },
      ...current
    ]);
  }

  function addDriverLedgerEntry(entry: Omit<DriverLedgerEntry, "id" | "createdAt">) {
    setDriverLedger((current) => [
      {
        id: makeId("driver-ledger"),
        createdAt: new Date().toISOString(),
        ...entry
      },
      ...current
    ]);
  }

  function addCashEntry(entry: Omit<CashEntry, "id" | "createdAt"> & { createdAt?: string }) {
    const { createdAt, ...cashEntry } = entry;

    setCashEntries((current) => [
      {
        id: makeId("cash"),
        createdAt: createdAt || new Date().toISOString(),
        ...cashEntry
      },
      ...current
    ]);
  }

  useEffect(() => {
    async function hydrateApp() {
      const remoteState = await readRemoteState();
      const localState = readLocalState();
      const savedState = getStateWeight(localState) > getStateWeight(remoteState) ? localState : remoteState || localState;
      const savedConfig = savedState.config || null;
      const savedUsers = savedState.users || DEFAULT_USERS;
      const savedDrivers = savedState.drivers || DEFAULT_DRIVERS;
      const savedClients = savedState.clients || DEFAULT_CLIENTS;
      const savedPassengers = savedState.passengers || [];
      const savedPendingTrips = savedState.pendingTrips || [];
      const savedConfirmedTrips = savedState.confirmedTrips || [];
      const savedClientLedger = savedState.clientLedger || [];
      const savedPassengerLedger = savedState.passengerLedger || [];
      const savedDriverLedger = savedState.driverLedger || [];
      const savedCash = savedState.cashEntries || [];
      const savedAudits = savedState.audits || [];
      const normalizedClients = savedClients.length ? savedClients : DEFAULT_CLIENTS;
      const normalizedPassengers = mergePassengerLists(
        normalizePassengers(savedPassengers),
        savedPassengers.length
          ? []
          : normalizedClients.map((client) => ({ id: client.id, name: client.name })),
        DEFAULT_PASSENGERS
      );
      const legacyPassengerLedger = savedClientLedger
        .filter((entry) => entry.source !== "hotel")
        .map((entry) => ({
          id: entry.id,
          createdAt: entry.createdAt,
          passengerId: entry.clientId,
          passengerName: entry.clientName,
          amount: entry.amount,
          concept: entry.concept,
          source:
            entry.source === "trip" || entry.source === "pending_payment"
              ? entry.source
              : ("manual" as PassengerLedgerEntry["source"])
        }));

      setConfig(mergeConfig(savedConfig));
      setUsers(normalizeUsers(savedUsers.length ? savedUsers : DEFAULT_USERS));
      setDrivers(normalizeDrivers(savedDrivers.length ? savedDrivers : DEFAULT_DRIVERS));
      setClients(normalizedClients);
      setPassengers(normalizedPassengers);
      setPendingTrips(normalizeTripsWithPassengers(savedPendingTrips, normalizedPassengers));
      setConfirmedTrips(normalizeTripsWithPassengers(savedConfirmedTrips, normalizedPassengers));
      setClientLedger(savedPassengerLedger.length ? savedClientLedger : savedClientLedger.filter((entry) => entry.source === "hotel"));
      setPassengerLedger(savedPassengerLedger.length ? savedPassengerLedger : legacyPassengerLedger);
      setDriverLedger(savedDriverLedger);
      setCashEntries(normalizeCashEntries(savedCash));
      setAudits(savedAudits);

      const envApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
      const storedApiKey = window.localStorage.getItem(STORAGE_KEYS.maps)?.trim();
      const chosenApiKey = envApiKey || storedApiKey || DEFAULT_PUBLIC_GOOGLE_MAPS_API_KEY;

      if (chosenApiKey) {
        setApiKeyInput(chosenApiKey);
        setActiveApiKey(chosenApiKey);
      } else {
        setNeedsApiKey(true);
        setMessage("Google Maps esta en modo manual. Carga una API key para rutas reales.");
        setMessageType("default");
      }

      setHasHydrated(true);
    }

    hydrateApp();
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    writeStorage(STORAGE_KEYS.config, config);
  }, [config, hasHydrated]);

  useEffect(() => {
    if (!hasHydrated) return;
    writeStorage(STORAGE_KEYS.users, users);
  }, [hasHydrated, users]);

  useEffect(() => {
    if (!hasHydrated) return;
    writeStorage(STORAGE_KEYS.drivers, drivers);
  }, [drivers, hasHydrated]);

  useEffect(() => {
    if (!hasHydrated) return;
    writeStorage(STORAGE_KEYS.clients, clients);
  }, [clients, hasHydrated]);

  useEffect(() => {
    if (!hasHydrated) return;
    writeStorage(STORAGE_KEYS.passengers, passengers);
  }, [hasHydrated, passengers]);

  useEffect(() => {
    if (!hasHydrated) return;
    writeStorage(STORAGE_KEYS.pendingTrips, pendingTrips);
  }, [hasHydrated, pendingTrips]);

  useEffect(() => {
    if (!hasHydrated) return;
    writeStorage(STORAGE_KEYS.confirmedTrips, confirmedTrips);
  }, [confirmedTrips, hasHydrated]);

  useEffect(() => {
    if (!hasHydrated) return;
    writeStorage(STORAGE_KEYS.clientLedger, clientLedger);
  }, [clientLedger, hasHydrated]);

  useEffect(() => {
    if (!hasHydrated) return;
    writeStorage(STORAGE_KEYS.passengerLedger, passengerLedger);
  }, [hasHydrated, passengerLedger]);

  useEffect(() => {
    if (!hasHydrated) return;
    writeStorage(STORAGE_KEYS.driverLedger, driverLedger);
  }, [driverLedger, hasHydrated]);

  useEffect(() => {
    if (!hasHydrated) return;
    writeStorage(STORAGE_KEYS.cash, cashEntries);
  }, [cashEntries, hasHydrated]);

  useEffect(() => {
    if (!hasHydrated) return;
    writeStorage(STORAGE_KEYS.audits, audits);
  }, [audits, hasHydrated]);

  useEffect(() => {
    if (!hasHydrated) return;

    const timeout = window.setTimeout(() => {
      writeRemoteState(getPersistedState());
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [
    audits,
    cashEntries,
    clientLedger,
    clients,
    config,
    confirmedTrips,
    drivers,
    driverLedger,
    hasHydrated,
    passengerLedger,
    passengers,
    pendingTrips,
    users
  ]);

  useEffect(() => {
    if (!drivers.length) return;
    if (drivers.some((driver) => driver.id === selectedDriverId)) return;
    setSelectedDriverId(drivers[0].id);
  }, [drivers, selectedDriverId]);

  useEffect(() => {
    if (!clients.length) return;
    if (clients.some((client) => client.id === selectedClientId)) return;
    setSelectedClientId(clients[0].id);
  }, [clients, selectedClientId]);

  useEffect(() => {
    if (!drivers.length) return;
    if (drivers.some((driver) => driver.id === cashDriverId)) return;
    setCashDriverId(drivers[0].id);
  }, [cashDriverId, drivers]);

  useEffect(() => {
    if (!passengerBalances.length) return;
    if (passengerBalances.some((passenger) => passenger.id === cashPassengerId)) return;
    setCashPassengerId(passengerBalances[0].id);
  }, [cashPassengerId, passengerBalances]);

  useEffect(() => {
    if (!clients.length) return;
    if (clients.some((client) => client.id === config.hotelClientId)) return;
    setConfig((current) => ({ ...current, hotelClientId: clients[0].id }));
  }, [clients, config.hotelClientId]);

  useEffect(() => {
    if (!currentUser) return;
    if (!activeApiKey) {
      setNeedsApiKey(true);
      return;
    }
    loadGoogleMaps(activeApiKey);
  }, [activeApiKey, currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    const allowedTabs: AppTab[] = ["calculator", "pending"];
    if (canDashboard) allowedTabs.push("dashboard");
    if (canAccounts) allowedTabs.push("accounts");
    if (canCash) allowedTabs.push("cash");
    if (canCash) allowedTabs.push("cashMovements");
    if (canSettings) allowedTabs.push("settings");
    if (canAudits) allowedTabs.push("audits");

    if (!allowedTabs.includes(activeTab)) setActiveTab("calculator");
  }, [activeTab, canAccounts, canAudits, canCash, canDashboard, canSettings, currentUser]);

  function loadGoogleMaps(apiKey: string) {
    const initMaps = () => {
      if (!window.google?.maps || !mapRef.current) return;

      const maps = window.google.maps;
      const map = new maps.Map(mapRef.current, {
        center: { lat: -34.6037, lng: -58.3816 },
        zoom: 11,
        disableDefaultUI: true,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false
      });

      directionsServiceRef.current = new maps.DirectionsService();
      directionsRendererRef.current = new maps.DirectionsRenderer({
        map,
        suppressMarkers: false,
        polylineOptions: {
          strokeColor: "#06163e",
          strokeOpacity: 0.95,
          strokeWeight: 6
        }
      });

      [originRef.current, stop1Ref.current, stop2Ref.current, destinationRef.current]
        .filter((input): input is HTMLInputElement => Boolean(input))
        .forEach((input) => {
          if (!maps.places?.Autocomplete) return;
          new maps.places.Autocomplete(input, {
            fields: ["formatted_address", "geometry", "name"],
            componentRestrictions: { country: "ar" }
          });
        });

      setMapsReady(true);
      setNeedsApiKey(false);
      setMessage("Completa origen y destino para calcular el viaje.");
      setMessageType("default");
    };

    if (window.google?.maps) {
      initMaps();
      return;
    }

    window.initMiChoferMaps = initMaps;
    document.querySelector("#mi-chofer-google-maps")?.remove();

    const script = document.createElement("script");
    script.id = "mi-chofer-google-maps";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&libraries=places&callback=initMiChoferMaps`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      setMapsReady(false);
      setNeedsApiKey(true);
      setMessage("No se pudo cargar Google Maps. Revisa API key y APIs habilitadas.");
      setMessageType("error");
    };
    document.head.appendChild(script);
  }

  function activateApiKey() {
    const key = apiKeyInput.trim();
    if (!key) {
      setMessage("Pega una API key valida.");
      setMessageType("error");
      return;
    }

    window.localStorage.setItem(STORAGE_KEYS.maps, key);
    setActiveApiKey(key);
    setMessage("Cargando Google Maps...");
    setMessageType("default");
    registerAudit("Google Maps API key actualizada.");
  }

  function collectAddressValues() {
    return {
      origin: originRef.current?.value.trim() || "",
      destination: destinationRef.current?.value.trim() || ""
    };
  }

  async function handleCalculateRoute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { origin, destination } = collectAddressValues();

    if (useManualAmount) {
      if (manualTripAmount <= 0) {
        setMessage("Ingresa un monto manual mayor a 0.");
        setMessageType("error");
        return;
      }

      setRouteSummary(null);
      setMessage("Monto manual cargado. Puedes enviar el viaje a pendientes.");
      setMessageType("success");
      registerAudit("Calculadora: monto manual cargado.");
      return;
    }

    if (!mapsReady) {
      if (manualKm > 0) {
        setRouteSummary(null);
        setMessage("Tarifa calculada con kilometros manuales.");
        setMessageType("success");
        registerAudit("Calculadora: calculo manual.");
        return;
      }

      setMessage("Sin Google Maps debes cargar kilometros manuales.");
      setMessageType("error");
      return;
    }

    if (origin.length < 4 || destination.length < 4) {
      setMessage("Completa origen y destino con direcciones mas especificas.");
      setMessageType("error");
      return;
    }

    setLoadingRoute(true);
    setMessage("Calculando ruta real...");
    setMessageType("default");

    try {
      const summary = await requestRoute(origin, destination);
      setRouteSummary(summary);
      setManualKm(Number(summary.distanceKm.toFixed(1)));
      setMessage(
        summary.includesTolls
          ? "Ruta calculada. La ruta incluye peajes y puedes ajustar el monto manual."
          : "Ruta calculada correctamente."
      );
      setMessageType("success");
      registerAudit("Calculadora: ruta calculada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo calcular la ruta.");
      setMessageType("error");
    } finally {
      setLoadingRoute(false);
    }
  }

  function requestRoute(origin: string, destination: string) {
    const maps = window.google?.maps;
    const directionsService = directionsServiceRef.current;
    const directionsRenderer = directionsRendererRef.current;

    if (!maps || !directionsService || !directionsRenderer) {
      return Promise.reject(new Error("Google Maps todavia no esta listo."));
    }

    const waypoints = [stop1Ref.current?.value.trim(), stop2Ref.current?.value.trim()]
      .filter((value): value is string => Boolean(value))
      .map((value) => ({ location: value, stopover: true }));

    return new Promise<RouteSummary>((resolve, reject) => {
      directionsService.route(
        {
          origin,
          destination,
          waypoints,
          travelMode: maps.TravelMode.DRIVING,
          provideRouteAlternatives: false,
          drivingOptions: {
            departureTime: new Date(),
            trafficModel: maps.TrafficModel.BEST_GUESS
          }
        },
        (response, status) => {
          if (status !== "OK" || !response?.routes?.length) {
            reject(new Error(getRouteError(status)));
            return;
          }

          const route = response.routes[0];
          const totals = (route.legs || []).reduce(
            (accumulator, leg) => ({
              distanceMeters: accumulator.distanceMeters + (leg.distance?.value || 0),
              durationSeconds:
                accumulator.durationSeconds + (leg.duration_in_traffic?.value || leg.duration?.value || 0)
            }),
            { distanceMeters: 0, durationSeconds: 0 }
          );

          directionsRenderer.setDirections(response);

          resolve({
            distanceKm: totals.distanceMeters / 1000,
            durationSeconds: totals.durationSeconds,
            includesTolls: route.warnings?.some((warning) => /peaje|toll/i.test(warning)) || false
          });
        }
      );
    });
  }

  function resolvePassengerForTrip() {
    const name = normalizeName(passengerInput);
    if (!name) return null;

    const savedPassenger = passengers.find((passenger) => passenger.name.toLowerCase() === name.toLowerCase());
    if (savedPassenger) return savedPassenger;

    return {
      id: `sporadic-passenger-${slugifyName(name) || makeId("passenger")}`,
      name
    };
  }

  function handleQueueTrip() {
    const passenger = resolvePassengerForTrip();

    if (!selectedDriver || !passenger) {
      setMessage("Selecciona chofer y pasajero validos.");
      setMessageType("error");
      return;
    }

    const { origin, destination } = collectAddressValues();
    if (origin.length < 3 || destination.length < 3) {
      setMessage("Para cargar el viaje debes completar origen y destino.");
      setMessageType("error");
      return;
    }

    if (useManualAmount && quote.selectedTotal <= 0) {
      setMessage("Si usas monto manual, ingresa un total mayor a 0.");
      setMessageType("error");
      return;
    }

    const trip: PendingTrip = {
      id: makeId("pending-trip"),
      createdAt: new Date().toISOString(),
      driverId: selectedDriver.id,
      driverName: selectedDriver.name,
      passengerId: passenger.id,
      passengerName: passenger.name,
      clientId: selectedClient?.id || DEFAULT_CLIENTS[0].id,
      clientName: selectedClient?.name || DEFAULT_CLIENTS[0].name,
      origin,
      destination,
      kilometers: Number(quote.distanceKm.toFixed(2)),
      durationSeconds: routeSummary?.durationSeconds || 0,
      paymentMode,
      timeMode,
      hotelTrip,
      waitCharge: Math.round(quote.waitCharge),
      tolls: Math.round(quote.tolls),
      baseTotal: Math.round(useManualAmount ? quote.selectedTotal : quote.baseTotal),
      cardSurcharge: Math.round(useManualAmount ? 0 : quote.cardSurcharge),
      hotelFee: Math.round(useManualAmount ? 0 : quote.hotelFee),
      totalAmount: Math.round(quote.selectedTotal),
      notes: useManualAmount
        ? "Viaje cargado con monto manual"
        : routeSummary
          ? "Ruta real calculada"
          : "Viaje cargado con km manual"
    };

    setPendingTrips((current) => [trip, ...current]);
    setMessage("Viaje cargado en pendientes.");
    setMessageType("success");
    registerAudit(`Viaje cargado en pendientes para ${trip.driverName} - ${trip.passengerName}.`);
  }

  function applyTripAccounting(trip: PendingTrip) {
    const driver = drivers.find((item) => item.id === trip.driverId);
    const driverRate = driver?.commissionRate ?? 0;
    const driverCommission = Math.round(trip.totalAmount * driverRate);

    if (driverCommission > 0) {
      addDriverLedgerEntry({
        driverId: trip.driverId,
        driverName: trip.driverName,
        amount: driverCommission,
        concept: `Comision viaje confirmado ${trip.id}`,
        source: "trip_commission"
      });
    }

    if (trip.paymentMode === "pending" || trip.paymentMode === "advance") {
      addPassengerLedgerEntry({
        passengerId: trip.passengerId,
        passengerName: trip.passengerName,
        amount: -Math.round(trip.totalAmount),
        concept:
          trip.paymentMode === "pending"
            ? `Viaje pendiente de pago ${trip.id}`
            : `Consumo de saldo adelantado ${trip.id}`,
        source: "trip"
      });
    }

    if (trip.paymentMode === "cash") {
      addCashEntry({
        concept: `Cobro viaje confirmado ${trip.id}`,
        amount: Math.round(trip.totalAmount),
        kind: "income",
        reason: "trip_payment",
        box: "cash",
        linkedName: `${trip.passengerName} / ${trip.driverName}`
      });
    }

    if (trip.paymentMode === "uber_cash") {
      addCashEntry({
        concept: `Cobro efectivo Uber viaje ${trip.id}`,
        amount: Math.round(trip.totalAmount),
        kind: "income",
        reason: "trip_payment",
        box: "uber_cash",
        linkedName: `${trip.passengerName} / ${trip.driverName}`
      });
    }

    if (trip.paymentMode === "galicia_paul_bank") {
      addCashEntry({
        concept: `Cobro Banco Galicia Paul viaje ${trip.id}`,
        amount: Math.round(trip.totalAmount),
        kind: "income",
        reason: "trip_payment",
        box: "galicia_paul",
        linkedName: `${trip.passengerName} / ${trip.driverName}`
      });
    }

    if (trip.paymentMode === "mercado_pago_transfer") {
      addCashEntry({
        concept: `Cobro transferencia Mercado Pago viaje ${trip.id}`,
        amount: Math.round(trip.totalAmount),
        kind: "income",
        reason: "trip_payment",
        box: "mercado_pago",
        linkedName: `${trip.passengerName} / ${trip.driverName}`
      });
    }

    if (trip.paymentMode === "posnet") {
      const netMercadoPago = Math.round(trip.totalAmount * (1 - MERCADO_PAGO_DISCOUNT_RATE));
      addCashEntry({
        concept: `Cobro posnet viaje ${trip.id} (-12%)`,
        amount: netMercadoPago,
        kind: "income",
        reason: "trip_payment",
        box: "mercado_pago",
        linkedName: `${trip.passengerName} / ${trip.driverName}`
      });
    }

    if (trip.hotelTrip && trip.hotelFee > 0) {
      const hotelClient = clients.find((item) => item.id === trip.clientId) || clients.find((item) => item.id === config.hotelClientId);
      if (hotelClient) {
        addClientLedgerEntry({
          clientId: hotelClient.id,
          clientName: hotelClient.name,
          amount: Math.round(trip.hotelFee),
          concept: `Comision hotel viaje ${trip.id}`,
          source: "hotel"
        });
      }
    }
  }

  function confirmPendingTrip(tripId: string) {
    const trip = pendingTrips.find((item) => item.id === tripId);
    if (!trip) return;

    setPendingTrips((current) => current.filter((item) => item.id !== tripId));
    setConfirmedTrips((current) => [
      {
        ...trip,
        confirmedAt: new Date().toISOString()
      },
      ...current
    ]);

    applyTripAccounting(trip);
    registerAudit(`Viaje confirmado ${trip.id}.`);
  }

  function declinePendingTrip(tripId: string) {
    const trip = pendingTrips.find((item) => item.id === tripId);
    setPendingTrips((current) => current.filter((item) => item.id !== tripId));
    registerAudit(`Viaje declinado ${trip?.id || tripId}.`);
  }

  function updatePendingTripPayment(tripId: string, nextPaymentMode: PaymentMode) {
    setPendingTrips((current) =>
      current.map((trip) =>
        trip.id === tripId
          ? {
              ...trip,
              paymentMode: nextPaymentMode
            }
          : trip
      )
    );
    registerAudit(`Forma de cobro modificada en viaje pendiente ${tripId}.`);
  }

  function updatePendingTripAmount(tripId: string, rawAmount: string) {
    const amount = Math.max(0, parseNumberInput(rawAmount));

    setPendingTrips((current) =>
      current.map((trip) => {
        if (trip.id !== tripId) return trip;

        const currentNotes = trip.notes || "Viaje pendiente";

        return {
          ...trip,
          baseTotal: amount,
          totalAmount: amount,
          notes: currentNotes.includes("monto editado manualmente")
            ? currentNotes
            : `${currentNotes} - monto editado manualmente`
        };
      })
    );
  }

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");
    const username = normalizeUsername(loginUsername);
    const password = normalizePassword(loginPassword);
    const user = users.find((item) => normalizeUsername(item.username) === username);

    if (!user || normalizePassword(user.password) !== password) {
      setLoginError("Usuario o contrasena incorrecta.");
      return;
    }

    setSessionUserId(user.id);
    setActiveTab("calculator");
    setLoginPassword("");
    registerAudit("Sesion iniciada.", user.name);
  }

  function handleLogout() {
    if (!currentUser) return;
    registerAudit("Sesion cerrada.", currentUser.name);
    setSessionUserId(null);
    setActiveTab("calculator");
  }

  function updatePermission(userId: string, key: keyof PermissionSet, value: boolean) {
    setUsers((current) =>
      current.map((user) =>
        user.id === userId
          ? {
              ...user,
              permissions: {
                ...user.permissions,
                [key]: value
              }
            }
          : user
      )
    );
    registerAudit(`Permiso ${key} ${value ? "habilitado" : "bloqueado"} para ${userId}.`);
  }

  function removeUser(userId: string) {
    const user = users.find((item) => item.id === userId);
    if (!user) return;

    if (user.id === currentUser?.id) {
      setMessage("No puedes eliminar el usuario con la sesion abierta.");
      setMessageType("error");
      return;
    }

    if (normalizeUsername(user.username) === "admin") {
      setMessage("El usuario admin principal no se puede eliminar.");
      setMessageType("error");
      return;
    }

    if (users.length <= 1) {
      setMessage("Debe quedar al menos un usuario.");
      setMessageType("error");
      return;
    }

    setUsers((current) => current.filter((item) => item.id !== userId));
    setMessage("Usuario eliminado.");
    setMessageType("success");
    registerAudit(`Usuario eliminado: ${user.username}.`);
  }

  function handleAddUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = normalizeName(newUserName);
    const username = normalizeUsername(newUsername);
    const password = normalizePassword(newPassword);

    if (!name || !username || !password) {
      setMessage("Completa nombre, usuario y contrasena.");
      setMessageType("error");
      return;
    }

    if (users.some((item) => normalizeUsername(item.username) === username)) {
      setMessage("Ese usuario ya existe.");
      setMessageType("error");
      return;
    }

    const newUser: AppUser = {
      id: makeId("user"),
      name,
      username,
      password,
      permissions: {
        dashboard: newUserDashboard,
        accounts: newUserAccounts,
        cash: newUserCash,
        settings: newUserSettings,
        audits: newUserAudits
      }
    };

    setUsers((current) => [...current, newUser]);
    setNewUserName("");
    setNewUsername("");
    setNewPassword("");
    setNewUserDashboard(false);
    setNewUserAccounts(false);
    setNewUserCash(false);
    setNewUserSettings(false);
    setNewUserAudits(false);
    setMessage("Usuario creado.");
    setMessageType("success");
    registerAudit(`Usuario creado: ${username}.`);
  }

  function handleAddDriver(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = normalizeName(newDriverName);
    const rate = Math.min(100, Math.max(0, Number(newDriverRatePercent) || 0));

    if (!name) return;
    if (drivers.some((driver) => driver.name.toLowerCase() === name.toLowerCase())) {
      setMessage("Ese chofer ya existe.");
      setMessageType("error");
      return;
    }

    const newDriver: Driver = {
      id: makeId("driver"),
      name,
      commissionRate: rate / 100
    };

    setDrivers((current) => [...current, newDriver]);
    setNewDriverName("");
    setNewDriverRatePercent(65);
    setMessage("Chofer agregado.");
    setMessageType("success");
    registerAudit(`Chofer agregado: ${name} (${rate}%).`);
  }

  function updateDriverRate(driverId: string, ratePercent: number) {
    const safePercent = Math.min(100, Math.max(0, ratePercent));
    setDrivers((current) =>
      current.map((driver) =>
        driver.id === driverId
          ? {
              ...driver,
              commissionRate: safePercent / 100
            }
          : driver
      )
    );
    registerAudit(`Comision de chofer actualizada (${driverId}) a ${safePercent}%.`);
  }

  function removeDriver(driverId: string) {
    if (drivers.length <= 1) {
      setMessage("Debe quedar al menos un chofer.");
      setMessageType("error");
      return;
    }
    if (pendingTrips.some((trip) => trip.driverId === driverId) || confirmedTrips.some((trip) => trip.driverId === driverId)) {
      setMessage("No puedes eliminar un chofer con viajes asociados.");
      setMessageType("error");
      return;
    }
    const deleted = drivers.find((driver) => driver.id === driverId);
    setDrivers((current) => current.filter((driver) => driver.id !== driverId));
    registerAudit(`Chofer eliminado: ${deleted?.name || driverId}.`);
  }

  function handleAddClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = normalizeName(newClientName);
    if (!name) return;

    if (clients.some((client) => client.name.toLowerCase() === name.toLowerCase())) {
      setMessage("Ese cliente ya existe.");
      setMessageType("error");
      return;
    }

    const newClient: CorporateClient = {
      id: makeId("client"),
      name
    };

    setClients((current) => [...current, newClient]);
    setNewClientName("");
    setMessage("Cliente agregado.");
    setMessageType("success");
    registerAudit(`Cliente agregado: ${name}.`);
  }

  function removeClient(clientId: string) {
    if (clients.length <= 1) {
      setMessage("Debe quedar al menos un cliente.");
      setMessageType("error");
      return;
    }

    const hasTrips =
      pendingTrips.some((trip) => trip.clientId === clientId) || confirmedTrips.some((trip) => trip.clientId === clientId);
    if (hasTrips) {
      setMessage("No puedes eliminar un cliente con viajes asociados.");
      setMessageType("error");
      return;
    }

    const hasMovements = clientLedger.some((entry) => entry.clientId === clientId);
    if (hasMovements) {
      setMessage("No puedes eliminar un cliente con movimientos de cuenta.");
      setMessageType("error");
      return;
    }

    const deleted = clients.find((client) => client.id === clientId);
    setClients((current) => current.filter((client) => client.id !== clientId));
    registerAudit(`Cliente eliminado: ${deleted?.name || clientId}.`);
  }

  function handleAddPassenger(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = normalizeName(newPassengerName);
    if (!name) return;

    if (passengers.some((passenger) => passenger.name.toLowerCase() === name.toLowerCase())) {
      setMessage("Ese pasajero ya existe.");
      setMessageType("error");
      return;
    }

    const newPassenger: Passenger = {
      id: makeId("passenger"),
      name
    };

    setPassengers((current) => [...current, newPassenger]);
    setNewPassengerName("");
    setMessage("Pasajero agregado.");
    setMessageType("success");
    registerAudit(`Pasajero agregado: ${name}.`);
  }

  function removePassenger(passengerId: string) {
    if (passengers.length <= 1) {
      setMessage("Debe quedar al menos un pasajero.");
      setMessageType("error");
      return;
    }

    const hasTrips =
      pendingTrips.some((trip) => trip.passengerId === passengerId) ||
      confirmedTrips.some((trip) => trip.passengerId === passengerId);
    if (hasTrips) {
      setMessage("No puedes eliminar un pasajero con viajes asociados.");
      setMessageType("error");
      return;
    }

    const hasMovements = passengerLedger.some((entry) => entry.passengerId === passengerId);
    if (hasMovements) {
      setMessage("No puedes eliminar un pasajero con movimientos de cuenta.");
      setMessageType("error");
      return;
    }

    const deleted = passengers.find((passenger) => passenger.id === passengerId);
    setPassengers((current) => current.filter((passenger) => passenger.id !== passengerId));
    registerAudit(`Pasajero eliminado: ${deleted?.name || passengerId}.`);
  }

  function handleAddCash(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const concept = normalizeName(cashConcept);
    const amount = Math.max(0, parseNumberInput(String(cashAmount)));
    const movementDate = cashDate ? new Date(cashDate) : new Date();

    if (!concept || amount <= 0) {
      setMessage("Completa concepto y monto.");
      setMessageType("error");
      return;
    }

    if (Number.isNaN(movementDate.getTime())) {
      setMessage("La fecha del movimiento no es valida.");
      setMessageType("error");
      return;
    }

    let reason: CashEntry["reason"] = "manual";
    let linkedName: string | undefined;

    if (cashKind === "income") {
      reason = incomeReason === "pending_payment" ? "pending_payment" : "manual";
      if (incomeReason === "pending_payment") {
        const passenger = passengerBalances.find((item) => item.id === cashPassengerId);
        if (!passenger) {
          setMessage("Selecciona un pasajero valido.");
          setMessageType("error");
          return;
        }
        linkedName = passenger.name;
        addPassengerLedgerEntry({
          passengerId: passenger.id,
          passengerName: passenger.name,
          amount,
          concept: `Ingreso aplicado a cuenta corriente: ${concept}`,
          source: "pending_payment"
        });
      }
    } else {
      reason = expenseReason === "commission_payment" ? "commission_payment" : "manual";
      if (expenseReason === "commission_payment") {
        const driver = drivers.find((item) => item.id === cashDriverId);
        if (!driver) {
          setMessage("Selecciona un chofer valido.");
          setMessageType("error");
          return;
        }
        linkedName = driver.name;
        addDriverLedgerEntry({
          driverId: driver.id,
          driverName: driver.name,
          amount: -amount,
          concept: `Pago de comisiones: ${concept}`,
          source: "commission_payment"
        });
      }
    }

    addCashEntry({
      concept,
      amount,
      kind: cashKind,
      reason,
      box: cashBox,
      linkedName,
      createdAt: movementDate.toISOString()
    });
    setCashConcept("");
    setCashAmount(0);
    setCashDate(getLocalDateTimeInputValue());
    registerAudit(
      `Caja (${getCashBoxLabel(cashBox)}): ${cashKind === "income" ? "ingreso" : "egreso"} ${formatCurrency(amount)}.`
    );
  }

  function handleConfigSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Configuracion guardada.");
    setMessageType("success");
    registerAudit("Configuracion de tarifas actualizada.");
  }

  function downloadPassengerAccountCsv(passenger: Passenger & { balance: number }) {
    const entries = passengerLedger
      .filter((entry) => entry.passengerId === passenger.id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    let balance = 0;
    const rows = entries.map((entry) => {
      balance += entry.amount;
      return {
        Fecha: new Date(entry.createdAt).toLocaleString("es-AR"),
        Pasajero: passenger.name,
        Concepto: entry.concept,
        Origen: entry.source,
        Debe: entry.amount < 0 ? Math.abs(entry.amount) : "",
        Haber: entry.amount > 0 ? entry.amount : "",
        Saldo: balance
      };
    });

    downloadCsv(
      `cuenta-pasajero-${slugifyName(passenger.name) || passenger.id}.csv`,
      rows.length
        ? rows
        : [
            {
              Fecha: "",
              Pasajero: passenger.name,
              Concepto: "Sin movimientos",
              Origen: "",
              Debe: "",
              Haber: "",
              Saldo: passenger.balance
            }
          ]
    );
  }

  function downloadClientAccountCsv(client: CorporateClient & { balance: number }) {
    const entries = clientLedger
      .filter((entry) => entry.clientId === client.id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    let balance = 0;
    const rows = entries.map((entry) => {
      balance += entry.amount;
      return {
        Fecha: new Date(entry.createdAt).toLocaleString("es-AR"),
        Cliente: client.name,
        Concepto: entry.concept,
        Origen: entry.source,
        Debe: entry.amount < 0 ? Math.abs(entry.amount) : "",
        Haber: entry.amount > 0 ? entry.amount : "",
        Saldo: balance
      };
    });

    downloadCsv(
      `cuenta-cliente-${slugifyName(client.name) || client.id}.csv`,
      rows.length
        ? rows
        : [
            {
              Fecha: "",
              Cliente: client.name,
              Concepto: "Sin movimientos",
              Origen: "",
              Debe: "",
              Haber: "",
              Saldo: client.balance
            }
          ]
    );
  }

  function downloadFullBackupCsv() {
    const rows = [
      ...confirmedTrips.map((trip) => ({
        Tipo: "viaje_confirmado",
        Fecha: new Date(trip.confirmedAt).toLocaleString("es-AR"),
        ID: trip.id,
        Nombre: trip.passengerName,
        Cliente: trip.clientName,
        Chofer: trip.driverName,
        Caja: "",
        Concepto: `${trip.origin} -> ${trip.destination}`,
        FormaCobro: PAYMENT_OPTIONS.find((option) => option.value === trip.paymentMode)?.title || trip.paymentMode,
        Monto: trip.totalAmount
      })),
      ...pendingTrips.map((trip) => ({
        Tipo: "viaje_pendiente",
        Fecha: new Date(trip.createdAt).toLocaleString("es-AR"),
        ID: trip.id,
        Nombre: trip.passengerName,
        Cliente: trip.clientName,
        Chofer: trip.driverName,
        Caja: "",
        Concepto: `${trip.origin} -> ${trip.destination}`,
        FormaCobro: PAYMENT_OPTIONS.find((option) => option.value === trip.paymentMode)?.title || trip.paymentMode,
        Monto: trip.totalAmount
      })),
      ...cashEntries.map((entry) => ({
        Tipo: "movimiento_caja",
        Fecha: new Date(entry.createdAt).toLocaleString("es-AR"),
        ID: entry.id,
        Nombre: entry.linkedName || "",
        Cliente: "",
        Chofer: "",
        Caja: getCashBoxLabel(entry.box),
        Concepto: entry.concept,
        FormaCobro: entry.kind === "income" ? "Ingreso" : "Egreso",
        Monto: entry.kind === "income" ? entry.amount : -entry.amount
      })),
      ...passengerLedger.map((entry) => ({
        Tipo: "cuenta_pasajero",
        Fecha: new Date(entry.createdAt).toLocaleString("es-AR"),
        ID: entry.id,
        Nombre: entry.passengerName,
        Cliente: "",
        Chofer: "",
        Caja: "",
        Concepto: entry.concept,
        FormaCobro: entry.source,
        Monto: entry.amount
      })),
      ...clientLedger.map((entry) => ({
        Tipo: "cuenta_cliente",
        Fecha: new Date(entry.createdAt).toLocaleString("es-AR"),
        ID: entry.id,
        Nombre: "",
        Cliente: entry.clientName,
        Chofer: "",
        Caja: "",
        Concepto: entry.concept,
        FormaCobro: entry.source,
        Monto: entry.amount
      })),
      ...driverLedger.map((entry) => ({
        Tipo: "cuenta_chofer",
        Fecha: new Date(entry.createdAt).toLocaleString("es-AR"),
        ID: entry.id,
        Nombre: "",
        Cliente: "",
        Chofer: entry.driverName,
        Caja: "",
        Concepto: entry.concept,
        FormaCobro: entry.source,
        Monto: entry.amount
      }))
    ];

    if (!rows.length) {
      setMessage("No hay viajes ni movimientos para exportar.");
      setMessageType("error");
      return;
    }

    downloadCsv(`backup-mi-chofer-${getLocalDateTimeInputValue().slice(0, 10)}.csv`, rows);
    registerAudit("Backup CSV descargado.");
  }

  if (!currentUser) {
    return (
      <main className="login-shell">
        <section className="login-card">
          <div className="login-brand">
            <Image src="/brand/mi-chofer-logo.jpeg" alt="Mi Chofer" width={300} height={426} priority />
          </div>
          <div className="login-content">
            <h1>Ingreso al sistema</h1>
            <p>Accede con tu usuario y contrasena.</p>
            <form className="login-form" onSubmit={handleLogin}>
              <label>
                Usuario
                <input
                  value={loginUsername}
                  onChange={(event) => setLoginUsername(event.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="username"
                  required
                />
              </label>
              <label>
                Contrasena
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="current-password"
                  required
                />
              </label>
              {loginError ? <p className="error-text">{loginError}</p> : null}
              <button type="submit">Entrar</button>
            </form>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-box">
          <Image src="/brand/mi-chofer-logo.jpeg" alt="Mi Chofer" width={64} height={91} priority />
          <div>
            <h1>Mi Chofer</h1>
            <p>Calculadora y gestion profesional</p>
          </div>
        </div>
        <div className="topbar-right">
          <span className="user-pill">{currentUser.name}</span>
          <button className="secondary" type="button" onClick={handleLogout}>
            Salir
          </button>
        </div>
      </header>

      <nav className="tabs">
        <button className={activeTab === "calculator" ? "active" : ""} type="button" onClick={() => setActiveTab("calculator")}>
          Calculadora
        </button>
        <button className={activeTab === "pending" ? "active" : ""} type="button" onClick={() => setActiveTab("pending")}>
          Viajes pendientes
        </button>
        {canDashboard ? (
          <button className={activeTab === "dashboard" ? "active" : ""} type="button" onClick={() => setActiveTab("dashboard")}>
            Dashboard
          </button>
        ) : null}
        {canAccounts ? (
          <button className={activeTab === "accounts" ? "active" : ""} type="button" onClick={() => setActiveTab("accounts")}>
            Cuentas corrientes
          </button>
        ) : null}
        {canCash ? (
          <button className={activeTab === "cash" ? "active" : ""} type="button" onClick={() => setActiveTab("cash")}>
            Registrar movimiento
          </button>
        ) : null}
        {canCash ? (
          <button
            className={activeTab === "cashMovements" ? "active" : ""}
            type="button"
            onClick={() => {
              setSelectedCashBoxFilter("all");
              setActiveTab("cashMovements");
            }}
          >
            Movimientos
          </button>
        ) : null}
        {canSettings ? (
          <button className={activeTab === "settings" ? "active" : ""} type="button" onClick={() => setActiveTab("settings")}>
            Configuracion
          </button>
        ) : null}
        {canAudits ? (
          <button className={activeTab === "audits" ? "active" : ""} type="button" onClick={() => setActiveTab("audits")}>
            Auditorias
          </button>
        ) : null}
      </nav>

      {activeTab === "calculator" ? (
        <section className="panel grid-two">
          <article className="card">
            <h2>Calculadora de viajes</h2>
            <form className="form-grid" onSubmit={handleCalculateRoute}>
              <label>
                Chofer
                <select value={selectedDriverId} onChange={(event) => setSelectedDriverId(event.target.value)}>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Pasajero
                <input
                  list="passenger-options"
                  value={passengerInput}
                  onChange={(event) => setPassengerInput(event.target.value)}
                  placeholder="Elegir o escribir pasajero"
                  required
                />
                <datalist id="passenger-options">
                  {passengers.map((passenger) => (
                    <option key={passenger.id} value={passenger.name} />
                  ))}
                </datalist>
              </label>
              <label>
                Cliente / comisionista
                <select value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)}>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Direccion de partida
                <input ref={originRef} placeholder="Ej: Av. Libertador 1000, CABA" autoComplete="off" />
              </label>
              <label>
                Direccion de destino
                <input ref={destinationRef} placeholder="Ej: Aeropuerto Ezeiza" autoComplete="off" />
              </label>
              <label>
                Parada opcional 1
                <input ref={stop1Ref} placeholder="Agregar parada" autoComplete="off" />
              </label>
              <label>
                Parada opcional 2
                <input ref={stop2Ref} placeholder="Agregar parada" autoComplete="off" />
              </label>
              <label>
                Km manuales
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={getNumberInputValue("manualKm", manualKm)}
                  onFocus={() => setActiveNumberField("manualKm")}
                  onBlur={() => setActiveNumberField(null)}
                  onChange={(event) => {
                    setManualKm(Math.max(0, parseNumberInput(event.target.value)));
                    setRouteSummary(null);
                  }}
                />
              </label>
              <label>
                Espera
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={getNumberInputValue("waitValue", waitValue)}
                  onFocus={() => setActiveNumberField("waitValue")}
                  onBlur={() => setActiveNumberField(null)}
                  onChange={(event) => setWaitValue(Math.max(0, parseNumberInput(event.target.value)))}
                />
              </label>
              <label>
                Peajes manuales
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={getNumberInputValue("manualTolls", manualTolls)}
                  onFocus={() => setActiveNumberField("manualTolls")}
                  onBlur={() => setActiveNumberField(null)}
                  onChange={(event) => setManualTolls(Math.max(0, parseNumberInput(event.target.value)))}
                />
              </label>
              <label>
                Horario
                <select value={timeMode} onChange={(event) => setTimeMode(event.target.value as TimeMode)}>
                  <option value="normal">Normal</option>
                  <option value="peak">Hora pico</option>
                </select>
              </label>

              <div className="inline-options">
                <label>
                  <input type="checkbox" checked={includeTolls} onChange={(event) => setIncludeTolls(event.target.checked)} />
                  Incluir peajes
                </label>
                <label>
                  <input type="checkbox" checked={hotelTrip} onChange={(event) => setHotelTrip(event.target.checked)} />
                  Viaje de hotel
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={useManualAmount}
                    onChange={(event) => setUseManualAmount(event.target.checked)}
                  />
                  Monto manual
                </label>
              </div>

              {useManualAmount ? (
                <label>
                  Monto total manual
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={getNumberInputValue("manualTripAmount", manualTripAmount)}
                    onFocus={() => setActiveNumberField("manualTripAmount")}
                    onBlur={() => setActiveNumberField(null)}
                    onChange={(event) => setManualTripAmount(Math.max(0, parseNumberInput(event.target.value)))}
                  />
                </label>
              ) : null}

              <div className="payment-grid">
                {PAYMENT_OPTIONS.map((option) => (
                  <label key={option.value} className={`payment-option ${paymentMode === option.value ? "active" : ""}`}>
                    <input
                      type="radio"
                      name="paymentMode"
                      checked={paymentMode === option.value}
                      onChange={() => setPaymentMode(option.value)}
                    />
                    <strong>{option.title}</strong>
                    <span>{option.subtitle}</span>
                  </label>
                ))}
              </div>

              <div className={`message ${messageType}`}>{message}</div>

              {needsApiKey ? (
                <div className="api-key-box">
                  <label>
                    API key Google Maps
                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={(event) => setApiKeyInput(event.target.value)}
                      placeholder="Pegar API key"
                    />
                  </label>
                  <button className="secondary" type="button" onClick={activateApiKey}>
                    Activar Maps
                  </button>
                </div>
              ) : null}

              <button type="submit" disabled={loadingRoute}>
                {loadingRoute ? "Calculando..." : "Calcular ruta y tarifa"}
              </button>
              <button className="secondary" type="button" onClick={handleQueueTrip}>
                Cargar viaje en pendientes
              </button>
            </form>

            <div className="map-wrap">
              <div ref={mapRef} className="map" />
            </div>
          </article>

          <article className="card">
            <h2>Resumen</h2>
            <div className="total primary">
              <span>Total segun forma de cobro</span>
              <strong>{formatCurrency(quote.selectedTotal)}</strong>
            </div>
            <div className="total">
              <span>Total calculado por sistema</span>
              <strong>{formatCurrency(quote.calculatedTotal)}</strong>
            </div>
            {useManualAmount ? (
              <div className="total">
                <span>Monto manual aplicado</span>
                <strong>{formatCurrency(quote.selectedTotal)}</strong>
              </div>
            ) : null}

            <dl className="summary-list">
              <div>
                <dt>Chofer</dt>
                <dd>{selectedDriver?.name || "-"}</dd>
              </div>
              <div>
                <dt>Pasajero</dt>
                <dd>{normalizeName(passengerInput) || selectedPassenger?.name || "-"}</dd>
              </div>
              <div>
                <dt>Cliente / comisionista</dt>
                <dd>{selectedClient?.name || "-"}</dd>
              </div>
              <div>
                <dt>Forma de cobro</dt>
                <dd>{PAYMENT_OPTIONS.find((option) => option.value === paymentMode)?.title || "-"}</dd>
              </div>
              <div>
                <dt>Modo de monto</dt>
                <dd>{useManualAmount ? "Manual" : "Calculado"}</dd>
              </div>
              <div>
                <dt>Distancia</dt>
                <dd>{quote.distanceKm.toFixed(1)} km</dd>
              </div>
              <div>
                <dt>Duracion</dt>
                <dd>{routeSummary ? formatDuration(routeSummary.durationSeconds) : "manual"}</dd>
              </div>
              <div>
                <dt>Precio por km</dt>
                <dd>{formatCurrency(quote.distancePrice)}</dd>
              </div>
              <div>
                <dt>Minimo aplicado</dt>
                <dd>{formatCurrency(quote.minimumApplied)}</dd>
              </div>
              <div>
                <dt>Subtotal</dt>
                <dd>{formatCurrency(quote.subtotal)}</dd>
              </div>
              <div>
                <dt>Recargo hora pico</dt>
                <dd>{formatCurrency(quote.peakSurcharge)}</dd>
              </div>
              <div>
                <dt>Recargo hotel</dt>
                <dd>{formatCurrency(quote.hotelFee)}</dd>
              </div>
              <div>
                <dt>Peajes</dt>
                <dd>{formatCurrency(quote.tolls)}</dd>
              </div>
              <div>
                <dt>Espera</dt>
                <dd>{formatCurrency(quote.waitCharge)}</dd>
              </div>
              <div>
                <dt>Recargo posnet</dt>
                <dd>{formatCurrency(quote.cardSurcharge)}</dd>
              </div>
            </dl>
          </article>
        </section>
      ) : null}

      {activeTab === "pending" ? (
        <section className="panel">
          <article className="card">
            <h2>Viajes pendientes de confirmacion</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Chofer</th>
                    <th>Pasajero</th>
                    <th>Cliente</th>
                    <th>Recorrido</th>
                    <th>Cobro</th>
                    <th>Total</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingTrips.map((trip) => (
                    <tr key={trip.id}>
                      <td>{new Date(trip.createdAt).toLocaleString("es-AR")}</td>
                      <td>{trip.driverName}</td>
                      <td>{trip.passengerName}</td>
                      <td>{trip.clientName}</td>
                      <td>{trip.origin} {" -> "} {trip.destination}</td>
                      <td>
                        <select
                          value={trip.paymentMode}
                          onChange={(event) => updatePendingTripPayment(trip.id, event.target.value as PaymentMode)}
                          aria-label={`Forma de cobro ${trip.id}`}
                        >
                          {PAYMENT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.title}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={trip.totalAmount}
                          onChange={(event) => updatePendingTripAmount(trip.id, event.target.value)}
                          aria-label={`Monto ${trip.id}`}
                        />
                      </td>
                      <td className="action-buttons">
                        <button type="button" onClick={() => confirmPendingTrip(trip.id)}>Confirmar</button>
                        <button className="secondary" type="button" onClick={() => declinePendingTrip(trip.id)}>
                          Declinar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === "dashboard" && canDashboard ? (
        <section className="panel">
          <div className="stats-grid">
            <article className="card stat">
              <h2>Facturacion confirmada</h2>
              <strong>{formatCurrency(totalBilled)}</strong>
            </article>
            <article className="card stat">
              <h2>Viajes confirmados</h2>
              <strong>{confirmedTrips.length}</strong>
            </article>
            <article className="card stat">
              <h2>Viajes pendientes</h2>
              <strong>{pendingTrips.length}</strong>
            </article>
            <article className="card stat">
              <h2>Saldo de caja</h2>
              <strong>{formatCurrency(cashBalance)}</strong>
            </article>
          </div>

          <div className="panel grid-two">
            <article className="card">
              <h2>Ultimos viajes confirmados</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Chofer</th>
                      <th>Pasajero</th>
                      <th>Cliente</th>
                      <th>Cobro</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {confirmedTrips.map((trip) => (
                      <tr key={trip.id}>
                        <td>{new Date(trip.confirmedAt).toLocaleString("es-AR")}</td>
                        <td>{trip.driverName}</td>
                        <td>{trip.passengerName}</td>
                        <td>{trip.clientName}</td>
                        <td>{PAYMENT_OPTIONS.find((option) => option.value === trip.paymentMode)?.title || "-"}</td>
                        <td>{formatCurrency(trip.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
            <article className="card">
              <h2>Resumen por chofer</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Chofer</th>
                      <th>Viajes</th>
                      <th>Facturado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drivers.map((driver) => {
                      const trips = confirmedTrips.filter((trip) => trip.driverId === driver.id);
                      const amount = trips.reduce((sum, trip) => sum + trip.totalAmount, 0);
                      return (
                        <tr key={driver.id}>
                          <td>{driver.name}</td>
                          <td>{trips.length}</td>
                          <td>{formatCurrency(amount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </article>
          </div>
        </section>
      ) : null}

      {activeTab === "accounts" && canAccounts ? (
        <section className="panel grid-two">
          <article className="card">
            <h2>Cuenta corriente de pasajeros</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Pasajero</th>
                    <th>Saldo</th>
                    <th>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {passengerBalances.map((passenger) => (
                    <tr key={passenger.id}>
                      <td>{passenger.name}</td>
                      <td className={passenger.balance >= 0 ? "balance-positive" : "balance-negative"}>
                        {formatCurrency(passenger.balance)}
                      </td>
                      <td>
                        <button className="secondary" type="button" onClick={() => downloadPassengerAccountCsv(passenger)}>
                          Descargar CSV
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="help-note">Saldo positivo: a favor del pasajero. Saldo negativo: pasajero adeuda.</p>
          </article>

          <article className="card">
            <h2>Comisiones de clientes</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Saldo</th>
                    <th>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {clientBalances.map((client) => (
                    <tr key={client.id}>
                      <td>{client.name}</td>
                      <td className={client.balance >= 0 ? "balance-positive" : "balance-negative"}>
                        {formatCurrency(client.balance)}
                      </td>
                      <td>
                        <button className="secondary" type="button" onClick={() => downloadClientAccountCsv(client)}>
                          Descargar CSV
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="help-note">Estos saldos corresponden a comisiones o movimientos del cliente/comisionista.</p>
          </article>

          <article className="card">
            <h2>Cuenta corriente de choferes</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Chofer</th>
                    <th>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {driverBalances.map((driver) => (
                    <tr key={driver.id}>
                      <td>{driver.name}</td>
                      <td className={driver.balance >= 0 ? "balance-positive" : "balance-negative"}>
                        {formatCurrency(driver.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="help-note">Saldo positivo: a favor del chofer. Saldo negativo: se pago de mas.</p>
          </article>
        </section>
      ) : null}

      {activeTab === "cash" && canCash ? (
        <section className="panel">
          <article className="card">
            <h2>Registrar movimiento</h2>
            <form className="form-grid" onSubmit={handleAddCash}>
              <label>
                Fecha del movimiento
                <input
                  type="datetime-local"
                  value={cashDate}
                  onChange={(event) => setCashDate(event.target.value)}
                  required
                />
              </label>
              <label>
                Caja destino
                <select value={cashBox} onChange={(event) => setCashBox(event.target.value as CashBox)}>
                  {CASH_BOX_OPTIONS.map((box) => (
                    <option key={box.value} value={box.value}>
                      {box.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tipo
                <select
                  value={cashKind}
                  onChange={(event) => {
                    const value = event.target.value as CashEntryKind;
                    setCashKind(value);
                  }}
                >
                  <option value="income">Ingreso</option>
                  <option value="expense">Egreso</option>
                </select>
              </label>

              {cashKind === "income" ? (
                <label>
                  Motivo de ingreso
                  <select value={incomeReason} onChange={(event) => setIncomeReason(event.target.value as IncomeReason)}>
                    <option value="manual">Ingreso manual</option>
                    <option value="pending_payment">Pago de viajes pendientes</option>
                  </select>
                </label>
              ) : (
                <label>
                  Motivo de egreso
                  <select value={expenseReason} onChange={(event) => setExpenseReason(event.target.value as ExpenseReason)}>
                    <option value="manual">Egreso manual</option>
                    <option value="commission_payment">Pago de comisiones</option>
                  </select>
                </label>
              )}

              {cashKind === "income" && incomeReason === "pending_payment" ? (
                <label>
                  Pasajero
                  <select value={cashPassengerId} onChange={(event) => setCashPassengerId(event.target.value)}>
                    {passengerBalances.map((passenger) => (
                      <option key={passenger.id} value={passenger.id}>
                        {passenger.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {cashKind === "expense" && expenseReason === "commission_payment" ? (
                <label>
                  Chofer
                  <select value={cashDriverId} onChange={(event) => setCashDriverId(event.target.value)}>
                    {drivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label>
                Concepto
                <input value={cashConcept} onChange={(event) => setCashConcept(event.target.value)} required />
              </label>
              <label>
                Monto
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={getNumberInputValue("cashAmount", cashAmount)}
                  onFocus={() => setActiveNumberField("cashAmount")}
                  onBlur={() => setActiveNumberField(null)}
                  onChange={(event) => setCashAmount(Math.max(0, parseNumberInput(event.target.value)))}
                  required
                />
              </label>
              <button type="submit">Guardar movimiento</button>
            </form>
            <p className="help-note">
              Los viajes confirmados con posnet se acreditan automaticamente en Caja Mercado Pago con descuento
              del 12%.
            </p>
          </article>
        </section>
      ) : null}

      {activeTab === "cashMovements" && canCash ? (
        <section className="panel">
          <article className="card">
            <div className="section-title-row">
              <div>
                <h2>Movimientos de caja</h2>
                <p className="help-note">Filtra por caja o revisa todos los ingresos y egresos.</p>
              </div>
              <div className="header-actions">
                <button className="secondary" type="button" onClick={downloadFullBackupCsv}>
                  Descargar backup CSV
                </button>
                <label className="compact-filter">
                  Caja
                  <select
                    value={selectedCashBoxFilter}
                    onChange={(event) => setSelectedCashBoxFilter(event.target.value as CashBox | "all")}
                  >
                    <option value="all">Todas las cajas</option>
                    {CASH_BOX_OPTIONS.map((box) => (
                      <option key={box.value} value={box.value}>
                        {box.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="box-balance-grid">
              <button
                className="box-balance-item"
                type="button"
                onClick={() => setSelectedCashBoxFilter("cash")}
              >
                <span>Caja efectivo</span>
                <strong>{formatCurrency(boxBalances.cash)}</strong>
              </button>
              <button
                className="box-balance-item"
                type="button"
                onClick={() => setSelectedCashBoxFilter("uber_cash")}
              >
                <span>Caja efectivo Uber</span>
                <strong>{formatCurrency(boxBalances.uber_cash)}</strong>
              </button>
              <button
                className="box-balance-item"
                type="button"
                onClick={() => setSelectedCashBoxFilter("mercado_pago")}
              >
                <span>Caja Mercado Pago</span>
                <strong>{formatCurrency(boxBalances.mercado_pago)}</strong>
              </button>
              <button
                className="box-balance-item"
                type="button"
                onClick={() => setSelectedCashBoxFilter("galicia_paul")}
              >
                <span>Caja Banco Galicia Paul</span>
                <strong>{formatCurrency(boxBalances.galicia_paul)}</strong>
              </button>
            </div>

            <dl className="summary-list">
              <div>
                <dt>Total ingresos</dt>
                <dd>{formatCurrency(totalIncome)}</dd>
              </div>
              <div>
                <dt>Total egresos</dt>
                <dd>{formatCurrency(totalExpense)}</dd>
              </div>
              <div>
                <dt>Saldo</dt>
                <dd>{formatCurrency(cashBalance)}</dd>
              </div>
            </dl>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Caja</th>
                    <th>Concepto</th>
                    <th>Tipo</th>
                    <th>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCashEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td>{new Date(entry.createdAt).toLocaleString("es-AR")}</td>
                      <td>{getCashBoxLabel(entry.box)}</td>
                      <td>
                        {entry.concept}
                        {entry.linkedName ? ` (${entry.linkedName})` : ""}
                      </td>
                      <td>{entry.kind === "income" ? "Ingreso" : "Egreso"}</td>
                      <td>{formatCurrency(entry.amount)}</td>
                    </tr>
                  ))}
                  {!filteredCashEntries.length ? (
                    <tr>
                      <td colSpan={5}>No hay movimientos para esta caja.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === "settings" && canSettings ? (
        <section className="panel grid-two">
          <article className="card">
            <h2>Tarifas y configuracion</h2>
            <form className="form-grid" onSubmit={handleConfigSave}>
              <label>
                Precio minimo
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={getNumberInputValue("minimumFare", config.minimumFare)}
                  onFocus={() => setActiveNumberField("minimumFare")}
                  onBlur={() => setActiveNumberField(null)}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      minimumFare: Math.max(0, parseNumberInput(event.target.value))
                    }))
                  }
                />
              </label>
              <label>
                Tarifa km 0 a 10
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={getNumberInputValue("tier1", config.rates.tier1)}
                  onFocus={() => setActiveNumberField("tier1")}
                  onBlur={() => setActiveNumberField(null)}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      rates: { ...current.rates, tier1: Math.max(0, parseNumberInput(event.target.value)) }
                    }))
                  }
                />
              </label>
              <label>
                Tarifa km 10 a 25
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={getNumberInputValue("tier2", config.rates.tier2)}
                  onFocus={() => setActiveNumberField("tier2")}
                  onBlur={() => setActiveNumberField(null)}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      rates: { ...current.rates, tier2: Math.max(0, parseNumberInput(event.target.value)) }
                    }))
                  }
                />
              </label>
              <label>
                Tarifa km mas de 25
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={getNumberInputValue("tier3", config.rates.tier3)}
                  onFocus={() => setActiveNumberField("tier3")}
                  onBlur={() => setActiveNumberField(null)}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      rates: { ...current.rates, tier3: Math.max(0, parseNumberInput(event.target.value)) }
                    }))
                  }
                />
              </label>
              <label>
                Multiplicador hora pico
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={getNumberInputValue("peakMultiplier", config.peakMultiplier)}
                  onFocus={() => setActiveNumberField("peakMultiplier")}
                  onBlur={() => setActiveNumberField(null)}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      peakMultiplier: Math.max(1, parseNumberInput(event.target.value, 1))
                    }))
                  }
                />
              </label>
              <label>
                Recargo posnet (%)
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={getNumberInputValue("cardSurcharge", Number((config.cardSurcharge * 100).toFixed(2)))}
                  onFocus={() => setActiveNumberField("cardSurcharge")}
                  onBlur={() => setActiveNumberField(null)}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      cardSurcharge: Math.max(0, parseNumberInput(event.target.value)) / 100
                    }))
                  }
                />
              </label>
              <label>
                Recargo hotel (%)
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={getNumberInputValue("hotelSurcharge", Number((config.hotelSurcharge * 100).toFixed(2)))}
                  onFocus={() => setActiveNumberField("hotelSurcharge")}
                  onBlur={() => setActiveNumberField(null)}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      hotelSurcharge: Math.max(0, parseNumberInput(event.target.value)) / 100
                    }))
                  }
                />
              </label>
              <label>
                Peaje por defecto
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={getNumberInputValue("defaultTolls", config.defaultTolls)}
                  onFocus={() => setActiveNumberField("defaultTolls")}
                  onBlur={() => setActiveNumberField(null)}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      defaultTolls: Math.max(0, parseNumberInput(event.target.value))
                    }))
                  }
                />
              </label>
              <label>
                Cliente para comision hotel
                <select
                  value={config.hotelClientId}
                  onChange={(event) => setConfig((current) => ({ ...current, hotelClientId: event.target.value }))}
                >
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit">Guardar configuracion</button>
            </form>

            <h2 style={{ marginTop: "14px" }}>Choferes</h2>
            <form className="form-grid" onSubmit={handleAddDriver}>
              <label>
                Nombre del chofer
                <input value={newDriverName} onChange={(event) => setNewDriverName(event.target.value)} required />
              </label>
              <label>
                Porcentaje del chofer (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={getNumberInputValue("newDriverRatePercent", newDriverRatePercent)}
                  onFocus={() => setActiveNumberField("newDriverRatePercent")}
                  onBlur={() => setActiveNumberField(null)}
                  onChange={(event) =>
                    setNewDriverRatePercent(Math.min(100, Math.max(0, parseNumberInput(event.target.value))))
                  }
                  required
                />
              </label>
              <button type="submit">Agregar chofer</button>
            </form>
            <div className="table-wrap" style={{ marginTop: "10px" }}>
              <table>
                <thead>
                  <tr>
                    <th>Chofer</th>
                    <th>Comision</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((driver) => (
                    <tr key={driver.id}>
                      <td>{driver.name}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={getNumberInputValue(
                            `driverRate-${driver.id}`,
                            Number((driver.commissionRate * 100).toFixed(2))
                          )}
                          onFocus={() => setActiveNumberField(`driverRate-${driver.id}`)}
                          onBlur={() => setActiveNumberField(null)}
                          onChange={(event) => updateDriverRate(driver.id, parseNumberInput(event.target.value))}
                        />
                      </td>
                      <td>
                        <button className="secondary" type="button" onClick={() => removeDriver(driver.id)}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 style={{ marginTop: "14px" }}>Clientes</h2>
            <form className="form-grid" onSubmit={handleAddClient}>
              <label>
                Nombre del cliente
                <input value={newClientName} onChange={(event) => setNewClientName(event.target.value)} required />
              </label>
              <button type="submit">Agregar cliente</button>
            </form>
            <div className="table-wrap" style={{ marginTop: "10px" }}>
              <table>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.id}>
                      <td>{client.name}</td>
                      <td>
                        <button className="secondary" type="button" onClick={() => removeClient(client.id)}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 style={{ marginTop: "14px" }}>Pasajeros</h2>
            <form className="form-grid" onSubmit={handleAddPassenger}>
              <label>
                Nombre del pasajero
                <input value={newPassengerName} onChange={(event) => setNewPassengerName(event.target.value)} required />
              </label>
              <button type="submit">Agregar pasajero</button>
            </form>
            <div className="table-wrap" style={{ marginTop: "10px" }}>
              <table>
                <thead>
                  <tr>
                    <th>Pasajero</th>
                    <th>Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {passengers.map((passenger) => (
                    <tr key={passenger.id}>
                      <td>{passenger.name}</td>
                      <td>
                        <button className="secondary" type="button" onClick={() => removePassenger(passenger.id)}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="card">
            <h2>Usuarios y permisos</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Dashboard</th>
                    <th>Cuentas</th>
                    <th>Caja</th>
                    <th>Config</th>
                    <th>Auditorias</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.username}</td>
                      <td>
                        <input
                          type="checkbox"
                          checked={user.permissions.dashboard}
                          onChange={(event) => updatePermission(user.id, "dashboard", event.target.checked)}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={user.permissions.accounts}
                          onChange={(event) => updatePermission(user.id, "accounts", event.target.checked)}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={user.permissions.cash}
                          onChange={(event) => updatePermission(user.id, "cash", event.target.checked)}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={user.permissions.settings}
                          onChange={(event) => updatePermission(user.id, "settings", event.target.checked)}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={user.permissions.audits}
                          onChange={(event) => updatePermission(user.id, "audits", event.target.checked)}
                        />
                      </td>
                      <td>
                        <button className="secondary" type="button" onClick={() => removeUser(user.id)}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3>Crear usuario</h3>
            <form className="form-grid" onSubmit={handleAddUser}>
              <label>
                Nombre visible
                <input value={newUserName} onChange={(event) => setNewUserName(event.target.value)} required />
              </label>
              <label>
                Usuario
                <input
                  value={newUsername}
                  onChange={(event) => setNewUsername(event.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="username"
                  required
                />
              </label>
              <label>
                Contrasena
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="new-password"
                  required
                />
              </label>
              <div className="inline-options">
                <label>
                  <input type="checkbox" checked={newUserDashboard} onChange={(event) => setNewUserDashboard(event.target.checked)} />
                  Dashboard
                </label>
                <label>
                  <input type="checkbox" checked={newUserAccounts} onChange={(event) => setNewUserAccounts(event.target.checked)} />
                  Cuentas
                </label>
                <label>
                  <input type="checkbox" checked={newUserCash} onChange={(event) => setNewUserCash(event.target.checked)} />
                  Caja
                </label>
                <label>
                  <input type="checkbox" checked={newUserSettings} onChange={(event) => setNewUserSettings(event.target.checked)} />
                  Configuracion
                </label>
                <label>
                  <input type="checkbox" checked={newUserAudits} onChange={(event) => setNewUserAudits(event.target.checked)} />
                  Auditorias
                </label>
              </div>
              <button type="submit">Crear usuario</button>
            </form>
          </article>
        </section>
      ) : null}

      {activeTab === "audits" && canAudits ? (
        <section className="panel">
          <article className="card">
            <h2>Auditorias</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Usuario</th>
                    <th>Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {audits.map((entry) => (
                    <tr key={entry.id}>
                      <td>{new Date(entry.createdAt).toLocaleString("es-AR")}</td>
                      <td>{entry.userName}</td>
                      <td>{entry.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      ) : null}
    </main>
  );
}
