import {
  AggregatedCourseDish,
  CourseStatus,
  GuestSubOrder,
  InventoryDeductionRecord,
  MasterOrder,
  SynchroGameState,
  Table,
  TableSessionDevice,
} from './types';

export const CLOUD_SYNC_TOPIC = 'dineease_pecathon_live_sync_v4';
export const CLOUD_SYNC_URL = `https://ntfy.sh/${CLOUD_SYNC_TOPIC}`;

const STATUS_RANK: Record<CourseStatus, number> = {
  queued: 0,
  cooking: 1,
  plated: 2,
  delivered: 3,
};

function parseOrderTime(order: MasterOrder, guest?: GuestSubOrder): number {
  if (guest?.id) {
    const m = guest.id.match(/^sub_(\d+)_/);
    if (m) return parseInt(m[1], 10);
  }
  const t = new Date(order.createdAt).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function toCompactSyncPayload(state: SynchroGameState): Partial<SynchroGameState> {
  return {
    updatedAt: state.updatedAt ?? Date.now(),
    inventoryUpdatedAt: state.inventoryUpdatedAt ?? 0,
    resetEpoch: state.resetEpoch ?? 0,
    tables: state.tables,
    inventory: state.inventory,
    orders: state.orders,
    revenue: state.revenue ?? 0,
    inventoryDeductions: state.inventoryDeductions ?? [],
  };
}

export function mergeSynchroStates(
  base: SynchroGameState | null,
  incoming: Partial<SynchroGameState> | null
): SynchroGameState | null {
  if (!base && !incoming) return null;
  if (!base) return incoming as SynchroGameState;
  if (!incoming || !Array.isArray(incoming.tables)) return base;

  const baseReset = base.resetEpoch ?? 0;
  const incReset = incoming.resetEpoch ?? 0;
  if (incReset > baseReset) {
    return {
      ...base,
      ...incoming,
      tables: incoming.tables ?? base.tables,
      inventory: incoming.inventory ?? base.inventory,
      orders: incoming.orders ?? [],
      revenue: incoming.revenue ?? 0,
      inventoryDeductions: incoming.inventoryDeductions ?? [],
      updatedAt: Math.max(base.updatedAt ?? 0, incoming.updatedAt ?? Date.now()),
      inventoryUpdatedAt: incoming.inventoryUpdatedAt ?? base.inventoryUpdatedAt ?? 0,
      resetEpoch: incReset,
    };
  }
  if (baseReset > incReset) {
    return base;
  }

  // 1. Merge Tables
  const mergedTables: Table[] = base.tables.map((tA) => {
    const tB = incoming.tables?.find((x) => x.number === tA.number || x.id === tA.id);
    if (!tB) return tA;

    const clearedAt = Math.max(tA.clearedAt ?? 0, tB.clearedAt ?? 0);
    const uA = tA.tableUpdatedAt ?? (tA.occupiedAt ? new Date(tA.occupiedAt).getTime() : 0);
    const uB = tB.tableUpdatedAt ?? (tB.occupiedAt ? new Date(tB.occupiedAt).getTime() : 0);
    const maxUpdated = Math.max(uA, uB);

    // If cleared more recently than any occupation, table is vacant
    if (clearedAt > 0 && uA <= clearedAt && uB <= clearedAt) {
      const newer = uB >= uA ? tB : tA;
      return {
        ...newer,
        status: 'vacant',
        guestCount: 0,
        activeOrderId: null,
        occupiedAt: null,
        activeDevices: [],
        tableUpdatedAt: maxUpdated,
        clearedAt,
      };
    }

    // If one side was updated after the other was cleared (or never touched)
    const aActive = tA.status === 'occupied' && uA > clearedAt;
    const bActive = tB.status === 'occupied' && uB > clearedAt;

    if (aActive && !bActive) {
      // Check if tB was explicitly left by its last device more recently than uA
      if (uB > uA && tB.status === 'vacant') {
        return { ...tB, clearedAt };
      }
      return { ...tA, clearedAt };
    }
    if (bActive && !aActive) {
      if (uA > uB && tA.status === 'vacant') {
        return { ...tA, clearedAt };
      }
      return { ...tB, clearedAt };
    }

    if (aActive && bActive) {
      // Both active: union their activeDevices by deviceId
      const devMap = new Map<string, TableSessionDevice>();
      for (const d of tA.activeDevices ?? []) devMap.set(d.deviceId, d);
      for (const d of tB.activeDevices ?? []) {
        const prev = devMap.get(d.deviceId);
        if (!prev || new Date(d.lastActiveAt).getTime() >= new Date(prev.lastActiveAt).getTime()) {
          devMap.set(d.deviceId, d);
        }
      }
      const devices = Array.from(devMap.values());
      const primary = uB >= uA ? tB : tA;
      return {
        ...primary,
        status: 'occupied',
        activeDevices: devices,
        guestCount: Math.max(tA.guestCount, tB.guestCount, devices.length, 1),
        tableUpdatedAt: maxUpdated,
        clearedAt,
      };
    }

    return uB >= uA ? { ...tB, clearedAt } : { ...tA, clearedAt };
  });

  const clearedByTableNo = new Map<number, number>();
  for (const t of mergedTables) {
    clearedByTableNo.set(t.number, t.clearedAt ?? 0);
  }

  // 2. Merge Inventory Deductions
  const deductionMap = new Map<string, InventoryDeductionRecord>();
  for (const d of base.inventoryDeductions ?? []) deductionMap.set(d.ticketId, d);
  for (const d of incoming.inventoryDeductions ?? []) {
    if (!deductionMap.has(d.ticketId)) deductionMap.set(d.ticketId, d);
  }
  const mergedDeductions = Array.from(deductionMap.values());
  const startedTicketIds = new Set(mergedDeductions.map((d) => d.ticketId));

  // 3. Merge Orders (grouped by tableNumber so orders from multiple serverless instances or phones combine cleanly)
  const allOrders = [...(base.orders ?? []), ...(incoming.orders ?? [])];
  const ordersByTableKey = new Map<string, MasterOrder>();

  for (const ord of allOrders) {
    const clearedAt = clearedByTableNo.get(ord.tableNumber) ?? 0;
    const validGuests = (ord.guests ?? []).filter((g) => parseOrderTime(ord, g) > clearedAt);
    if (validGuests.length === 0) continue;

    const key = ord.tableNumber > 0 ? `TBL_${ord.tableNumber}` : ord.id;
    const existing = ordersByTableKey.get(key);
    if (!existing) {
      ordersByTableKey.set(key, {
        ...ord,
        guests: validGuests.map((g) => ({
          ...g,
          cookingStarted: !!g.cookingStarted || startedTicketIds.has(g.id),
        })),
        aggregatedDishes: [...(ord.aggregatedDishes ?? [])],
      });
      continue;
    }

    // Merge guests by g.id
    const guestMap = new Map<string, GuestSubOrder>();
    for (const g of existing.guests) guestMap.set(g.id, g);
    for (const g of validGuests) {
      const prev = guestMap.get(g.id);
      if (!prev) {
        guestMap.set(g.id, {
          ...g,
          cookingStarted: !!g.cookingStarted || startedTicketIds.has(g.id),
        });
      } else {
        guestMap.set(g.id, {
          ...prev,
          ...g,
          paymentStatus: prev.paymentStatus === 'paid' || g.paymentStatus === 'paid' ? 'paid' : 'pending',
          paidAt: prev.paidAt || g.paidAt,
          cookingStarted: !!prev.cookingStarted || !!g.cookingStarted || startedTicketIds.has(g.id),
        });
      }
    }

    // Merge aggregatedDishes by uniqueId (or guestSubOrderId + dishId)
    const dishMap = new Map<string, AggregatedCourseDish>();
    for (const d of existing.aggregatedDishes) dishMap.set(d.uniqueId, d);
    for (const d of ord.aggregatedDishes ?? []) {
      const prev = dishMap.get(d.uniqueId);
      if (!prev) {
        dishMap.set(d.uniqueId, d);
      } else {
        const bestStatus = STATUS_RANK[d.status] >= STATUS_RANK[prev.status] ? d.status : prev.status;
        dishMap.set(d.uniqueId, { ...prev, ...d, status: bestStatus });
      }
    }

    // Also ensure if any dish for a guestSubOrderId was marked plated in either order even with different uniqueIds:
    const platedSubOrders = new Set<string>();
    for (const src of [existing.aggregatedDishes, ord.aggregatedDishes ?? []]) {
      if (src.length > 0 && src.every((d) => d.status === 'plated' || d.status === 'delivered')) {
        src.forEach((d) => platedSubOrders.add(d.guestSubOrderId));
      }
    }
    const finalDishes = Array.from(dishMap.values()).map((d) =>
      platedSubOrders.has(d.guestSubOrderId) && STATUS_RANK[d.status] < STATUS_RANK.plated
        ? { ...d, status: 'plated' as CourseStatus, remainingSeconds: 0 }
        : d
    );

    existing.guests = Array.from(guestMap.values());
    existing.aggregatedDishes = finalDishes;
  }

  const mergedOrders = Array.from(ordersByTableKey.values());

  // Ensure any table with active uncompleted orders is marked occupied
  for (const ord of mergedOrders) {
    if (ord.tableNumber > 0) {
      const tb = mergedTables.find((t) => t.number === ord.tableNumber);
      if (tb && tb.status !== 'occupied') {
        tb.status = 'occupied';
        tb.occupiedAt = tb.occupiedAt || ord.createdAt;
        tb.guestCount = Math.max(tb.guestCount, ord.guests.length, 1);
      }
    }
  }

  // 4. Merge Inventory (take whichever has newer inventoryUpdatedAt)
  const invA = base.inventoryUpdatedAt ?? 0;
  const invB = incoming.inventoryUpdatedAt ?? 0;
  const mergedInventory = invB >= invA && incoming.inventory ? incoming.inventory : base.inventory;

  // 5. Recompute total revenue from all orders
  const computedRevenue = mergedOrders.reduce(
    (sum, o) => sum + o.guests.reduce((gs, g) => gs + g.total, 0),
    0
  );
  const mergedRevenue = Math.max(computedRevenue, base.revenue ?? 0, incoming.revenue ?? 0);

  return {
    ...base,
    tables: mergedTables,
    inventory: mergedInventory,
    orders: mergedOrders,
    revenue: Number(mergedRevenue.toFixed(2)),
    inventoryDeductions: mergedDeductions,
    updatedAt: Math.max(base.updatedAt ?? 0, incoming.updatedAt ?? 0, Date.now()),
    inventoryUpdatedAt: Math.max(invA, invB),
    resetEpoch: Math.max(baseReset, incReset),
  };
}
