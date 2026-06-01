"use client";

import Image from "next/image";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

type TimeMode = "normal" | "peak";
type PaymentMode = "cash" | "card";
type CashEntryKind = "income" | "expense";
type AppTab = "calculator" | "dashboard" | "cash" | "settings" | "audits";
type StatusTone = "default" | "success" | "error";

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
};

type PermissionSet = {
  dashboard: boolean;
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
};

type CorporateClient = {
  id: string;
  name: string;
};

type AuditEntry = {
  id: string;
  createdAt: string;
  userName: string;
  action: string;
};

type CashEntry = {
  id: string;
  createdAt: string;
  concept: string;
  amount: number;
  kind: CashEntryKind;
};

type TripRecord = {
  id: string;
  createdAt: string;
  driverId: string;
  driverName: string;
  clientId: string;
  clientName: string;
  origin: string;
  destination: string;
  kilometers: number;
  durationSeconds: number;
  paymentMode: PaymentMode;
  amount: number;
  notes: string;
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
  trips: "miChoferTrips",
  audits: "miChoferAudits",
  cash: "miChoferCashEntries",
  maps: "miChoferGoogleMapsApiKey"
};

const DEFAULT_PUBLIC_GOOGLE_MAPS_API_KEY = "AIzaSyCbcYMbdwfcfrGFPQKs3qwKCNR0o53baJ0";

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
  defaultTolls: 0
};

const DEFAULT_USERS: AppUser[] = [
  {
    id: "admin",
    name: "Administrador",
    username: "admin",
    password: "Michofer2026",
    permissions: {
      dashboard: true,
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
      cash: false,
      settings: false,
      audits: false
    }
  }
];

const DEFAULT_DRIVERS: Driver[] = [
  { id: "driver-1", name: "Franco Diaz" },
  { id: "driver-2", name: "Martin Rojas" }
];

const DEFAULT_CLIENTS: CorporateClient[] = [
  { id: "client-1", name: "Mi Chofer" },
  { id: "client-2", name: "Wyndham" }
];

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 11)}`;
}

function safeNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(Math.round(value));
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.max(1, Math.round(totalSeconds / 60));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (!hours) return `${minutes} min`;
  if (!remainingMinutes) return `${hours} h`;
  return `${hours} h ${remainingMinutes} min`;
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
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
    defaultTolls: Math.max(0, safeNumber(raw.defaultTolls, DEFAULT_CONFIG.defaultTolls))
  };
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

export default function Home() {
  const [config, setConfig] = useState<PricingConfig>({
    ...DEFAULT_CONFIG,
    rates: { ...DEFAULT_CONFIG.rates }
  });
  const [users, setUsers] = useState<AppUser[]>(DEFAULT_USERS);
  const [drivers, setDrivers] = useState<Driver[]>(DEFAULT_DRIVERS);
  const [clients, setClients] = useState<CorporateClient[]>(DEFAULT_CLIENTS);
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [audits, setAudits] = useState<AuditEntry[]>([]);
  const [cashEntries, setCashEntries] = useState<CashEntry[]>([]);

  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [activeTab, setActiveTab] = useState<AppTab>("calculator");
  const [hasHydrated, setHasHydrated] = useState(false);

  const [mapsReady, setMapsReady] = useState(false);
  const [needsApiKey, setNeedsApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [activeApiKey, setActiveApiKey] = useState("");
  const [loadingRoute, setLoadingRoute] = useState(false);

  const [message, setMessage] = useState("Completa origen y destino para calcular el viaje.");
  const [messageType, setMessageType] = useState<StatusTone>("default");

  const [selectedDriverId, setSelectedDriverId] = useState(DEFAULT_DRIVERS[0].id);
  const [selectedClientId, setSelectedClientId] = useState(DEFAULT_CLIENTS[0].id);
  const [manualKm, setManualKm] = useState(0);
  const [waitValue, setWaitValue] = useState(0);
  const [manualTolls, setManualTolls] = useState(0);
  const [includeTolls, setIncludeTolls] = useState(true);
  const [hotelTrip, setHotelTrip] = useState(false);
  const [timeMode, setTimeMode] = useState<TimeMode>("normal");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);

  const [cashConcept, setCashConcept] = useState("");
  const [cashAmount, setCashAmount] = useState(0);
  const [cashKind, setCashKind] = useState<CashEntryKind>("income");

  const [newUserName, setNewUserName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newUserDashboard, setNewUserDashboard] = useState(false);
  const [newUserCash, setNewUserCash] = useState(false);
  const [newUserSettings, setNewUserSettings] = useState(false);
  const [newUserAudits, setNewUserAudits] = useState(false);

  const [newDriverName, setNewDriverName] = useState("");
  const [newClientName, setNewClientName] = useState("");

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
  const canCash = currentUser?.permissions.cash ?? false;
  const canSettings = currentUser?.permissions.settings ?? false;
  const canAudits = currentUser?.permissions.audits ?? false;

  const quote = useMemo(() => {
    const distanceKm = routeSummary?.distanceKm ?? Math.max(0, manualKm);
    const distancePrice = calculateTieredDistancePrice(distanceKm, config);
    const subtotal = Math.max(config.minimumFare, distancePrice);
    const peakSurcharge = timeMode === "peak" ? subtotal * (config.peakMultiplier - 1) : 0;
    const afterPeak = subtotal + peakSurcharge;
    const hotelSurcharge = hotelTrip ? afterPeak * config.hotelSurcharge : 0;
    const tolls = includeTolls ? Math.max(0, manualTolls) + config.defaultTolls : 0;
    const waitCharge = Math.max(0, waitValue);
    const cashTransferTotal = afterPeak + hotelSurcharge + tolls + waitCharge;
    const cardSurcharge = cashTransferTotal * config.cardSurcharge;
    const cardTotal = cashTransferTotal + cardSurcharge;

    return {
      distanceKm,
      distancePrice,
      subtotal,
      peakSurcharge,
      hotelSurcharge,
      tolls,
      waitCharge,
      minimumApplied: distancePrice < config.minimumFare ? config.minimumFare : 0,
      cashTransferTotal,
      cardSurcharge,
      cardTotal
    };
  }, [config, hotelTrip, includeTolls, manualKm, manualTolls, routeSummary, timeMode, waitValue]);

  const selectedTotal = paymentMode === "card" ? quote.cardTotal : quote.cashTransferTotal;
  const totalIncome = cashEntries.filter((item) => item.kind === "income").reduce((sum, item) => sum + item.amount, 0);
  const totalExpense = cashEntries.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amount, 0);
  const cashBalance = totalIncome - totalExpense;
  const billedTotal = trips.reduce((sum, item) => sum + item.amount, 0);

  const driverStats = useMemo(() => {
    return drivers
      .map((driver) => {
        const filtered = trips.filter((trip) => trip.driverId === driver.id);
        const amount = filtered.reduce((sum, trip) => sum + trip.amount, 0);
        return {
          id: driver.id,
          name: driver.name,
          trips: filtered.length,
          amount
        };
      })
      .filter((item) => item.trips > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [drivers, trips]);

  const clientStats = useMemo(() => {
    return clients
      .map((client) => {
        const filtered = trips.filter((trip) => trip.clientId === client.id);
        const amount = filtered.reduce((sum, trip) => sum + trip.amount, 0);
        return {
          id: client.id,
          name: client.name,
          trips: filtered.length,
          amount
        };
      })
      .filter((item) => item.trips > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [clients, trips]);

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

  function registerAudit(action: string, actorName?: string) {
    const entry: AuditEntry = {
      id: makeId("audit"),
      createdAt: new Date().toISOString(),
      userName: actorName || currentUser?.name || "Sistema",
      action
    };

    setAudits((current) => [entry, ...current].slice(0, 500));
  }

  useEffect(() => {
    const savedConfig = readStorage<Partial<PricingConfig> | null>(STORAGE_KEYS.config, null);
    const savedUsers = readStorage<AppUser[]>(STORAGE_KEYS.users, DEFAULT_USERS);
    const savedDrivers = readStorage<Driver[]>(STORAGE_KEYS.drivers, DEFAULT_DRIVERS);
    const savedClients = readStorage<CorporateClient[]>(STORAGE_KEYS.clients, DEFAULT_CLIENTS);
    const savedTrips = readStorage<TripRecord[]>(STORAGE_KEYS.trips, []);
    const savedAudits = readStorage<AuditEntry[]>(STORAGE_KEYS.audits, []);
    const savedCash = readStorage<CashEntry[]>(STORAGE_KEYS.cash, []);

    setConfig(mergeConfig(savedConfig));
    setUsers(savedUsers.length ? savedUsers : DEFAULT_USERS);
    setDrivers(savedDrivers.length ? savedDrivers : DEFAULT_DRIVERS);
    setClients(savedClients.length ? savedClients : DEFAULT_CLIENTS);
    setTrips(savedTrips);
    setAudits(savedAudits);
    setCashEntries(savedCash);

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
    writeStorage(STORAGE_KEYS.trips, trips);
  }, [hasHydrated, trips]);

  useEffect(() => {
    if (!hasHydrated) return;
    writeStorage(STORAGE_KEYS.audits, audits);
  }, [audits, hasHydrated]);

  useEffect(() => {
    if (!hasHydrated) return;
    writeStorage(STORAGE_KEYS.cash, cashEntries);
  }, [cashEntries, hasHydrated]);

  useEffect(() => {
    if (!drivers.length) return;
    if (drivers.some((item) => item.id === selectedDriverId)) return;
    setSelectedDriverId(drivers[0].id);
  }, [drivers, selectedDriverId]);

  useEffect(() => {
    if (!clients.length) return;
    if (clients.some((item) => item.id === selectedClientId)) return;
    setSelectedClientId(clients[0].id);
  }, [clients, selectedClientId]);

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

    const allowedTabs: AppTab[] = ["calculator"];
    if (canDashboard) allowedTabs.push("dashboard");
    if (canCash) allowedTabs.push("cash");
    if (canSettings) allowedTabs.push("settings");
    if (canAudits) allowedTabs.push("audits");

    if (!allowedTabs.includes(activeTab)) {
      setActiveTab("calculator");
    }
  }, [activeTab, canAudits, canCash, canDashboard, canSettings, currentUser]);

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
      setMessage("Google Maps listo. Ya puedes calcular rutas reales.");
      setMessageType("success");
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
    setNeedsApiKey(false);
    setMessage("Cargando Google Maps...");
    setMessageType("default");
    registerAudit("Google Maps API key actualizada.");
  }

  function collectAddressValues() {
    return {
      origin: originRef.current?.value.trim() || "",
      stop1: stop1Ref.current?.value.trim() || "",
      stop2: stop2Ref.current?.value.trim() || "",
      destination: destinationRef.current?.value.trim() || ""
    };
  }

  async function handleCalculateRoute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const { origin, destination } = collectAddressValues();

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
      registerAudit("Calculadora: ruta calculada con Google Maps.");
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
      .filter((item): item is string => Boolean(item))
      .map((item) => ({ location: item, stopover: true }));

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

  function handleSaveTrip() {
    const driver = drivers.find((item) => item.id === selectedDriverId);
    const client = clients.find((item) => item.id === selectedClientId);

    if (!driver || !client) {
      setMessage("Selecciona chofer y cliente validos.");
      setMessageType("error");
      return;
    }

    const { origin, destination } = collectAddressValues();
    if (origin.length < 3 || destination.length < 3) {
      setMessage("Para guardar el viaje, completa origen y destino.");
      setMessageType("error");
      return;
    }

    const entry: TripRecord = {
      id: makeId("trip"),
      createdAt: new Date().toISOString(),
      driverId: driver.id,
      driverName: driver.name,
      clientId: client.id,
      clientName: client.name,
      origin,
      destination,
      kilometers: Number(quote.distanceKm.toFixed(2)),
      durationSeconds: routeSummary?.durationSeconds ?? 0,
      paymentMode,
      amount: Math.round(selectedTotal),
      notes: routeSummary ? "Ruta real por Google Maps" : "Km manual"
    };

    setTrips((current) => [entry, ...current]);
    setMessage("Viaje guardado correctamente.");
    setMessageType("success");
    registerAudit(`Viaje guardado para ${driver.name} - ${client.name}.`);
  }

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");

    const username = normalizeUsername(loginUsername);
    const user = users.find((item) => normalizeUsername(item.username) === username);

    if (!user || user.password !== loginPassword) {
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
      current.map((item) =>
        item.id === userId
          ? {
              ...item,
              permissions: {
                ...item.permissions,
                [key]: value
              }
            }
          : item
      )
    );

    registerAudit(`Permiso ${key} ${value ? "habilitado" : "bloqueado"} para ${userId}.`);
  }

  function handleAddUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = normalizeName(newUserName);
    const username = normalizeUsername(newUsername);
    const password = newPassword.trim();

    if (!name || !username || !password) {
      setMessage("Completa nombre, usuario y contrasena.");
      setMessageType("error");
      return;
    }

    if (users.some((item) => normalizeUsername(item.username) === username)) {
      setMessage("Ese usuario ya existe.");
      setMessageType("error");
      registerAudit(`Intento de alta de usuario duplicado: ${username}.`);
      return;
    }

    const newUser: AppUser = {
      id: makeId("user"),
      name,
      username,
      password,
      permissions: {
        dashboard: newUserDashboard,
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
    setNewUserCash(false);
    setNewUserSettings(false);
    setNewUserAudits(false);
    registerAudit(`Usuario creado: ${username}.`);
    setMessage("Usuario creado correctamente.");
    setMessageType("success");
  }

  function handleAddDriver(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = normalizeName(newDriverName);

    if (!name) return;
    if (drivers.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      setMessage("Ese chofer ya existe.");
      setMessageType("error");
      return;
    }

    const newDriver: Driver = { id: makeId("driver"), name };
    setDrivers((current) => [...current, newDriver]);
    setNewDriverName("");
    setMessage("Chofer agregado.");
    setMessageType("success");
    registerAudit(`Chofer agregado: ${name}.`);
  }

  function handleAddClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = normalizeName(newClientName);

    if (!name) return;
    if (clients.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      setMessage("Ese cliente ya existe.");
      setMessageType("error");
      return;
    }

    const newClient: CorporateClient = { id: makeId("client"), name };
    setClients((current) => [...current, newClient]);
    setNewClientName("");
    setMessage("Cliente agregado.");
    setMessageType("success");
    registerAudit(`Cliente agregado: ${name}.`);
  }

  function removeDriver(driverId: string) {
    if (drivers.length <= 1) {
      setMessage("Debe quedar al menos un chofer.");
      setMessageType("error");
      return;
    }

    if (trips.some((trip) => trip.driverId === driverId)) {
      setMessage("No puedes borrar un chofer con viajes registrados.");
      setMessageType("error");
      return;
    }

    const removed = drivers.find((item) => item.id === driverId);
    setDrivers((current) => current.filter((item) => item.id !== driverId));
    registerAudit(`Chofer eliminado: ${removed?.name || driverId}.`);
  }

  function removeClient(clientId: string) {
    if (clients.length <= 1) {
      setMessage("Debe quedar al menos un cliente.");
      setMessageType("error");
      return;
    }

    if (trips.some((trip) => trip.clientId === clientId)) {
      setMessage("No puedes borrar un cliente con viajes registrados.");
      setMessageType("error");
      return;
    }

    const removed = clients.find((item) => item.id === clientId);
    setClients((current) => current.filter((item) => item.id !== clientId));
    registerAudit(`Cliente eliminado: ${removed?.name || clientId}.`);
  }

  function handleAddCash(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const concept = normalizeName(cashConcept);
    const amount = Math.round(cashAmount);

    if (!concept || amount <= 0) return;

    const entry: CashEntry = {
      id: makeId("cash"),
      createdAt: new Date().toISOString(),
      concept,
      amount,
      kind: cashKind
    };

    setCashEntries((current) => [entry, ...current]);
    setCashConcept("");
    setCashAmount(0);
    setCashKind("income");
    registerAudit(`Caja: ${cashKind === "income" ? "ingreso" : "egreso"} ${formatCurrency(amount)}.`);
  }

  function handleConfigSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Tarifas guardadas.");
    setMessageType("success");
    registerAudit("Configuracion de tarifas actualizada.");
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
            <p>Accede con tu usuario y contrasena para habilitar tus modulos.</p>
            <form className="login-form" onSubmit={handleLogin}>
              <label>
                Usuario
                <input value={loginUsername} onChange={(event) => setLoginUsername(event.target.value)} required />
              </label>
              <label>
                Contrasena
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  required
                />
              </label>
              {loginError ? <p className="error-text">{loginError}</p> : null}
              <button type="submit">Entrar</button>
            </form>
            <div className="default-users">
              <strong>Accesos iniciales:</strong>
              <span>admin / Michofer2026</span>
              <span>operador / Chofer2026</span>
            </div>
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
        <button className={activeTab === "calculator" ? "active" : ""} onClick={() => setActiveTab("calculator")} type="button">
          Calculadora
        </button>
        {canDashboard ? (
          <button className={activeTab === "dashboard" ? "active" : ""} onClick={() => setActiveTab("dashboard")} type="button">
            Dashboard
          </button>
        ) : null}
        {canCash ? (
          <button className={activeTab === "cash" ? "active" : ""} onClick={() => setActiveTab("cash")} type="button">
            Caja
          </button>
        ) : null}
        {canSettings ? (
          <button className={activeTab === "settings" ? "active" : ""} onClick={() => setActiveTab("settings")} type="button">
            Configuracion
          </button>
        ) : null}
        {canAudits ? (
          <button className={activeTab === "audits" ? "active" : ""} onClick={() => setActiveTab("audits")} type="button">
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
                Cliente
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
                  value={manualKm}
                  onChange={(event) => {
                    setManualKm(Math.max(0, Number(event.target.value) || 0));
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
                  value={waitValue}
                  onChange={(event) => setWaitValue(Math.max(0, Number(event.target.value) || 0))}
                />
              </label>
              <label>
                Peajes manuales
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={manualTolls}
                  onChange={(event) => setManualTolls(Math.max(0, Number(event.target.value) || 0))}
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
                    type="radio"
                    name="paymentMode"
                    checked={paymentMode === "cash"}
                    onChange={() => setPaymentMode("cash")}
                  />
                  Cobro efectivo / transferencia
                </label>
                <label>
                  <input
                    type="radio"
                    name="paymentMode"
                    checked={paymentMode === "card"}
                    onChange={() => setPaymentMode("card")}
                  />
                  Cobro tarjeta / posnet
                </label>
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
              <button className="secondary" type="button" onClick={handleSaveTrip}>
                Guardar viaje
              </button>
            </form>

            <div className="map-wrap">
              <div ref={mapRef} className="map" />
            </div>
          </article>

          <article className="card">
            <h2>Resumen</h2>
            <div className="total primary">
              <span>Total seleccionado</span>
              <strong>{formatCurrency(selectedTotal)}</strong>
            </div>
            <div className="total">
              <span>Total efectivo / transferencia</span>
              <strong>{formatCurrency(quote.cashTransferTotal)}</strong>
            </div>
            <div className="total">
              <span>Total tarjeta / posnet</span>
              <strong>{formatCurrency(quote.cardTotal)}</strong>
            </div>

            <dl className="summary-list">
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
                <dd>{formatCurrency(quote.hotelSurcharge)}</dd>
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
                <dt>Recargo tarjeta</dt>
                <dd>{formatCurrency(quote.cardSurcharge)}</dd>
              </div>
            </dl>
          </article>
        </section>
      ) : null}

      {activeTab === "dashboard" && canDashboard ? (
        <section className="panel">
          <div className="stats-grid">
            <article className="card stat">
              <h2>Facturacion total</h2>
              <strong>{formatCurrency(billedTotal)}</strong>
            </article>
            <article className="card stat">
              <h2>Viajes registrados</h2>
              <strong>{trips.length}</strong>
            </article>
            <article className="card stat">
              <h2>Choferes</h2>
              <strong>{drivers.length}</strong>
            </article>
            <article className="card stat">
              <h2>Clientes</h2>
              <strong>{clients.length}</strong>
            </article>
          </div>

          <div className="panel grid-two">
            <article className="card">
              <h2>Ultimos viajes</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Chofer</th>
                      <th>Cliente</th>
                      <th>Km</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trips.map((trip) => (
                      <tr key={trip.id}>
                        <td>{new Date(trip.createdAt).toLocaleString("es-AR")}</td>
                        <td>{trip.driverName}</td>
                        <td>{trip.clientName}</td>
                        <td>{trip.kilometers.toFixed(1)}</td>
                        <td>{formatCurrency(trip.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="card">
              <h2>Rendimiento por chofer</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Chofer</th>
                      <th>Viajes</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {driverStats.map((item) => (
                      <tr key={item.id}>
                        <td>{item.name}</td>
                        <td>{item.trips}</td>
                        <td>{formatCurrency(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h2 style={{ marginTop: "14px" }}>Rendimiento por cliente</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Viajes</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientStats.map((item) => (
                      <tr key={item.id}>
                        <td>{item.name}</td>
                        <td>{item.trips}</td>
                        <td>{formatCurrency(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </div>
        </section>
      ) : null}

      {activeTab === "cash" && canCash ? (
        <section className="panel grid-two">
          <article className="card">
            <h2>Registrar movimiento</h2>
            <form className="form-grid" onSubmit={handleAddCash}>
              <label>
                Concepto
                <input value={cashConcept} onChange={(event) => setCashConcept(event.target.value)} required />
              </label>
              <label>
                Monto
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={cashAmount}
                  onChange={(event) => setCashAmount(Math.max(0, Number(event.target.value) || 0))}
                  required
                />
              </label>
              <label>
                Tipo
                <select value={cashKind} onChange={(event) => setCashKind(event.target.value as CashEntryKind)}>
                  <option value="income">Ingreso</option>
                  <option value="expense">Egreso</option>
                </select>
              </label>
              <button type="submit">Guardar movimiento</button>
            </form>
          </article>

          <article className="card">
            <h2>Resumen de caja</h2>
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
                    <th>Concepto</th>
                    <th>Tipo</th>
                    <th>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {cashEntries.map((item) => (
                    <tr key={item.id}>
                      <td>{new Date(item.createdAt).toLocaleString("es-AR")}</td>
                      <td>{item.concept}</td>
                      <td>{item.kind === "income" ? "Ingreso" : "Egreso"}</td>
                      <td>{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === "settings" && canSettings ? (
        <section className="panel grid-two">
          <article className="card">
            <h2>Tarifas</h2>
            <form className="form-grid" onSubmit={handleConfigSave}>
              <label>
                Precio minimo
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={config.minimumFare}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      minimumFare: Math.max(0, Number(event.target.value) || 0)
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
                  value={config.rates.tier1}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      rates: { ...current.rates, tier1: Math.max(0, Number(event.target.value) || 0) }
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
                  value={config.rates.tier2}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      rates: { ...current.rates, tier2: Math.max(0, Number(event.target.value) || 0) }
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
                  value={config.rates.tier3}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      rates: { ...current.rates, tier3: Math.max(0, Number(event.target.value) || 0) }
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
                  value={config.peakMultiplier}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      peakMultiplier: Math.max(1, Number(event.target.value) || 1)
                    }))
                  }
                />
              </label>
              <label>
                Recargo tarjeta (%)
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={Number((config.cardSurcharge * 100).toFixed(2))}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      cardSurcharge: Math.max(0, Number(event.target.value) || 0) / 100
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
                  value={Number((config.hotelSurcharge * 100).toFixed(2))}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      hotelSurcharge: Math.max(0, Number(event.target.value) || 0) / 100
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
                  value={config.defaultTolls}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      defaultTolls: Math.max(0, Number(event.target.value) || 0)
                    }))
                  }
                />
              </label>
              <button type="submit">Guardar tarifas</button>
            </form>

            <h2 style={{ marginTop: "14px" }}>Choferes</h2>
            <form className="form-grid" onSubmit={handleAddDriver}>
              <label>
                Nuevo chofer
                <input
                  value={newDriverName}
                  onChange={(event) => setNewDriverName(event.target.value)}
                  placeholder="Nombre del chofer"
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
                    <th>Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>
                        <button className="secondary" type="button" onClick={() => removeDriver(item.id)}>
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
                Nuevo cliente
                <input
                  value={newClientName}
                  onChange={(event) => setNewClientName(event.target.value)}
                  placeholder="Nombre del cliente"
                  required
                />
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
                  {clients.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>
                        <button className="secondary" type="button" onClick={() => removeClient(item.id)}>
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
                    <th>Caja</th>
                    <th>Config</th>
                    <th>Auditorias</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((item) => (
                    <tr key={item.id}>
                      <td>{item.username}</td>
                      <td>
                        <input
                          type="checkbox"
                          checked={item.permissions.dashboard}
                          onChange={(event) => updatePermission(item.id, "dashboard", event.target.checked)}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={item.permissions.cash}
                          onChange={(event) => updatePermission(item.id, "cash", event.target.checked)}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={item.permissions.settings}
                          onChange={(event) => updatePermission(item.id, "settings", event.target.checked)}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={item.permissions.audits}
                          onChange={(event) => updatePermission(item.id, "audits", event.target.checked)}
                        />
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
                <input value={newUsername} onChange={(event) => setNewUsername(event.target.value)} required />
              </label>
              <label>
                Contrasena
                <input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
              </label>
              <div className="inline-options">
                <label>
                  <input type="checkbox" checked={newUserDashboard} onChange={(event) => setNewUserDashboard(event.target.checked)} />
                  Dashboard
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
                  {audits.map((item) => (
                    <tr key={item.id}>
                      <td>{new Date(item.createdAt).toLocaleString("es-AR")}</td>
                      <td>{item.userName}</td>
                      <td>{item.action}</td>
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
