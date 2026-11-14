import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  Table,
  StoveThread,
  InventoryMap,
  MasterOrder,
  LowStockAlert,
  WaiterNotification,
  AIPrediction,
  SynchroGameState,
  GuestSubOrder,
  AggregatedCourseDish,
  CourseType,
  InventoryDeductionRecord,
} from './types';
import { INITIAL_INVENTORY, INVENTORY_THRESHOLDS, MENU_ITEMS } from './data';
import { getRestockAIEngine } from './restockAI';

const STATE_SNAPSHOT_FILE = path.join(os.tmpdir(), 'dineease_synchro_state_v2.json');

const tableLabelOf = (n: number) => (n > 0 ? `Table ${n}` : n === 0 ? 'Take away' : 'Waiting list');
const genUid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

export class SynchroStateManager {
  private tables: Table[] = [];
  private stoves: StoveThread[] = [];
  private inventory: InventoryMap = { ...INITIAL_INVENTORY };
  private orders: MasterOrder[] = [];
  private revenue = 0;
  private lowStockAlerts: LowStockAlert[] = [];
  private waiterNotifications: WaiterNotification[] = [];
  private inventoryDeductions: InventoryDeductionRecord[] = [];
  private startedTicketIds = new Set<string>();
  private aiPrediction: AIPrediction = {
    period: '08:30 AM - 10:00 AM Surge Window',
    surgeCategory: 'Morning Espresso & Breakfast Toastie Rush',
    confidence: 0.94,
    recommendation: 'Pre-allocate 2 dedicated barista stove threads and stage 600g coffee beans + 30 bread slices.',
    inventoryWarning: 'Coffee beans projected to deplete by 09:15 AM if current trend continues.',
    peakHourGraph: [
      { hour: '7 AM', traffic: 20 },
      { hour: '8 AM', traffic: 65 },
      { hour: '9 AM', traffic: 98 },
      { hour: '10 AM', traffic: 75 },
      { hour: '11 AM', traffic: 40 },
      { hour: '12 PM', traffic: 85 },
      { hour: '1 PM', traffic: 90 },
      { hour: '2 PM', traffic: 45 },
    ],
  };

  private broadcastCallback?: (event: string, data: any) => void;
  private timerInterval?: NodeJS.Timeout;
  private lastSyncedUpdatedAt = 0;

  constructor() {
    this.initializeTables();
    this.initializeStoves();
    this.syncLowStockAlerts();
    this.loadSnapshotIfNewer();
    this.startCookTimerTicker();
  }

  private saveSnapshot() {
    try {
      const now = Date.now();
      this.lastSyncedUpdatedAt = now;
      const payload = {
        updatedAt: now,
        tables: this.tables,
        stoves: this.stoves,
        inventory: this.inventory,
        orders: this.orders,
        revenue: this.revenue,
        lowStockAlerts: this.lowStockAlerts,
        waiterNotifications: this.waiterNotifications,
        inventoryDeductions: this.inventoryDeductions,
        startedTicketIds: Array.from(this.startedTicketIds),
      };
      fs.writeFileSync(STATE_SNAPSHOT_FILE, JSON.stringify(payload));
    } catch {
      // Ignore filesystem errors in read-only environments
    }
  }

  public loadSnapshotIfNewer() {
    try {
      if (!fs.existsSync(STATE_SNAPSHOT_FILE)) return;
      const raw = fs.readFileSync(STATE_SNAPSHOT_FILE, 'utf8');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.updatedAt === 'number' && parsed.updatedAt > this.lastSyncedUpdatedAt) {
        this.lastSyncedUpdatedAt = parsed.updatedAt;
        if (Array.isArray(parsed.tables)) this.tables = parsed.tables;
        if (Array.isArray(parsed.stoves)) this.stoves = parsed.stoves;
        if (parsed.inventory) this.inventory = parsed.inventory;
        if (Array.isArray(parsed.orders)) this.orders = parsed.orders;
        if (typeof parsed.revenue === 'number') this.revenue = parsed.revenue;
        if (Array.isArray(parsed.lowStockAlerts)) this.lowStockAlerts = parsed.lowStockAlerts;
        if (Array.isArray(parsed.waiterNotifications)) this.waiterNotifications = parsed.waiterNotifications;
        if (Array.isArray(parsed.inventoryDeductions)) this.inventoryDeductions = parsed.inventoryDeductions;
        if (Array.isArray(parsed.startedTicketIds)) this.startedTicketIds = new Set(parsed.startedTicketIds);
      }
    } catch {
      // Ignore parse errors
    }
  }

  private syncLowStockAlerts() {
    for (const [mat, stock] of Object.entries(this.inventory)) {
      const thresh = INVENTORY_THRESHOLDS[mat] ?? 0;
      if (stock <= thresh) {
        this.triggerLowStockAlert(mat, stock, thresh);
      } else {
        this.lowStockAlerts = this.lowStockAlerts.filter((a) => a.ingredient !== mat);
      }
    }
  }

  public setBroadcastCallback(fn: (event: string, data: any) => void) {
    this.broadcastCallback = fn;
  }

  private emitState() {
    this.saveSnapshot();
    if (this.broadcastCallback) {
      this.broadcastCallback('synchro_state_updated', this.getState());
    }
  }

  private initializeTables() {
    this.tables = [
      { id: 'T-01', number: 1, uid: 'TBL-1-101', status: 'vacant', guestCount: 0, activeOrderId: null, occupiedAt: null },
      { id: 'T-02', number: 2, uid: 'TBL-2-202', status: 'vacant', guestCount: 0, activeOrderId: null, occupiedAt: null },
      { id: 'T-03', number: 3, uid: 'TBL-3-303', status: 'vacant', guestCount: 0, activeOrderId: null, occupiedAt: null },
      { id: 'T-04', number: 4, uid: 'TBL-4-404', status: 'vacant', guestCount: 0, activeOrderId: null, occupiedAt: null },
      // Virtual desks for take-away and waiting-list orders (UI only shows the 4 real tables)
      { id: 'TAKEAWAY', number: 0, uid: 'TAKEAWAY', status: 'vacant', guestCount: 0, activeOrderId: null, occupiedAt: null },
      { id: 'WAITLIST', number: -1, uid: 'WAITLIST', status: 'vacant', guestCount: 0, activeOrderId: null, occupiedAt: null },
    ];
  }

  private initializeStoves() {
    this.stoves = [
      { id: 1, name: 'Stove CPU-0 (Grill)', activeDish: null, remainingSeconds: 0, totalDurationSeconds: 0, queue: [] },
      { id: 2, name: 'Stove CPU-1 (Sauté & Fry)', activeDish: null, remainingSeconds: 0, totalDurationSeconds: 0, queue: [] },
      { id: 3, name: 'Stove CPU-2 (Toast & Beverage)', activeDish: null, remainingSeconds: 0, totalDurationSeconds: 0, queue: [] },
    ];
  }

  public getState(): SynchroGameState {
    this.loadSnapshotIfNewer();
    return {
      tables: this.tables,
      stoves: this.stoves,
      inventory: this.inventory,
      orders: this.orders,
      lowStockAlerts: this.lowStockAlerts,
      waiterNotifications: this.waiterNotifications,
      aiPrediction: this.aiPrediction,
      revenue: this.revenue,
      inventoryDeductions: this.inventoryDeductions,
    };
  }

  // 1. Table QR Scan / Guest Arrival with Phone Device Fingerprint
  public handleTableScan(
    tableId: string,
    guestCount: number = 1,
    deviceInfo?: { deviceId: string; socketId: string; guestName?: string }
  ): Table | null {
    const table = this.tables.find((t) => t.id === tableId || `T-${t.number}` === tableId || `T-0${t.number}` === tableId || `${t.number}` === tableId);
    if (!table) return null;

    // If this phone was previously seated at another table without orders, detach it from that old table
    if (deviceInfo?.deviceId) {
      for (const other of this.tables) {
        if (other.id !== table.id && other.activeDevices?.some((d) => d.deviceId === deviceInfo.deviceId)) {
          other.activeDevices = other.activeDevices.filter((d) => d.deviceId !== deviceInfo.deviceId);
          const hasOrders = this.orders.some((o) => o.tableId === other.id);
          if (other.activeDevices.length === 0 && !hasOrders) {
            other.status = 'vacant';
            other.guestCount = 0;
            other.occupiedAt = null;
          }
        }
      }
    }

    table.status = 'occupied';
    table.occupiedAt = table.occupiedAt || new Date().toISOString();

    if (!table.activeDevices) {
      table.activeDevices = [];
    }

    if (deviceInfo?.deviceId) {
      const existing = table.activeDevices.find((d) => d.deviceId === deviceInfo.deviceId);
      if (existing) {
        existing.lastActiveAt = new Date().toISOString();
        existing.socketId = deviceInfo.socketId;
        if (deviceInfo.guestName) existing.guestName = deviceInfo.guestName;
      } else {
        // Assign sequential Diner 1, Diner 2, Diner 3...
        const usedNums = table.activeDevices.map((d) => {
          const m = d.guestName.match(/Diner\s+(\d+)/i);
          return m ? parseInt(m[1], 10) : 0;
        });
        const nextNum = usedNums.length > 0 ? Math.max(...usedNums) + 1 : 1;
        table.activeDevices.push({
          deviceId: deviceInfo.deviceId,
          socketId: deviceInfo.socketId,
          guestName: deviceInfo.guestName || `Diner ${nextNum}`,
          joinedAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
        });
      }
    }

    table.guestCount = Math.max(table.guestCount, table.activeDevices.length, guestCount);

    this.emitState();
    return table;
  }

  // 2. Table Clearance (Waiter / Owner override)
  public handleClearTable(tableId: string): boolean {
    const table = this.tables.find((t) => t.id === tableId || `T-${t.number}` === tableId || `${t.number}` === tableId);
    if (!table) return false;

    table.status = 'vacant';
    table.guestCount = 0;
    table.activeOrderId = null;
    table.occupiedAt = null;
    table.activeDevices = [];
    table.uid = genUid(`T${table.number}`); // old QR codes stop working
    // Close this dining session: drop its orders so the next party starts fresh
    this.orders = this.orders.filter((o) => o.tableId !== table.id);

    // Add a waiter notification
    this.addNotification({
      id: `notif_${Date.now()}`,
      type: 'table_assistance',
      tableId: table.id,
      tableNumber: table.number,
      message: `Table ${table.number} has been cleaned, sanitized, and reset to VACANT.`,
      timestamp: new Date().toISOString(),
      read: false,
    });

    this.emitState();
    return true;
  }

  // 2b. A phone leaves its table (frees the table only if nobody else is seated and nothing was ordered)
  public handleLeaveTable(tableId: string, deviceId: string): boolean {
    const table = this.tables.find((t) => t.id === tableId || `T-0${t.number}` === tableId || `${t.number}` === tableId);
    if (!table) return false;
    table.activeDevices = (table.activeDevices || []).filter((d) => d.deviceId !== deviceId);
    const hasOrders = this.orders.some((o) => o.tableId === table.id);
    if (table.activeDevices.length === 0 && !hasOrders) {
      table.status = 'vacant';
      table.guestCount = 0;
      table.occupiedAt = null;
      table.uid = genUid(`T${table.number}`);
    }
    this.emitState();
    return true;
  }

  // 2c. Decide whether a phone may join a table.
  // Once a table is occupied, a 2nd/3rd phone MUST scan the QR from INSIDE the table menu (joinMode === 'inside').
  public validateScan(
    tableId: string,
    uid: string | undefined,
    deviceId: string,
    joinMode?: 'inside' | 'outside'
  ): { ok: boolean; error?: string } {
    const table = this.tables.find((t) => t.id === tableId || `T-0${t.number}` === tableId || `${t.number}` === tableId);
    if (!table) return { ok: false, error: 'Unknown table.' };
    if (table.number <= 0) return { ok: true };
    if ((table.activeDevices || []).some((d) => d.deviceId === deviceId)) return { ok: true };
    if (uid && uid !== table.uid && !uid.startsWith(`TBL-${table.number}`) && !uid.startsWith(`T${table.number}`)) {
      return { ok: false, error: 'This QR code belongs to a different table.' };
    }
    if (table.status === 'occupied' && joinMode !== 'inside') {
      const nextDiner = (table.activeDevices?.length || 1) + 1;
      return {
        ok: false,
        error: `Table ${table.number} is already occupied! To join this table as Diner ${nextDiner}, scan the "Table QR" from INSIDE the seated diner's table menu.`,
      };
    }
    return { ok: true };
  }

  // 2d. Go-Dutch payment: a phone pays only its own orders, or (optionally) the whole table in one go.
  public payBills(params: { tableId: string; deviceId: string; scope: 'mine' | 'table' }): { success: boolean; amount: number; error?: string } {
    const table = this.tables.find((t) => t.id === params.tableId || `T-0${t.number}` === params.tableId || `${t.number}` === params.tableId);
    if (!table) return { success: false, amount: 0, error: 'Unknown table.' };
    let amount = 0;
    let payers = new Set<string>();
    for (const order of this.orders.filter((o) => o.tableId === table.id)) {
      for (const g of order.guests) {
        if (g.paymentStatus === 'paid') continue;
        if (params.scope === 'mine' && g.deviceId !== params.deviceId) continue;
        g.paymentStatus = 'paid';
        g.paidAt = new Date().toISOString();
        amount += g.total;
        payers.add(g.guestName);
      }
    }
    amount = Number(amount.toFixed(2));
    if (amount <= 0) return { success: false, amount: 0, error: 'Nothing to pay.' };
    this.addNotification({
      id: `notif_${Date.now()}_pay`,
      type: 'order_placed',
      tableId: table.id,
      tableNumber: table.number,
      message: `${tableLabelOf(table.number)}: ${[...payers].join(', ')} paid ₹${amount.toFixed(0)}${params.scope === 'table' ? ' (whole table)' : ''}`,
      timestamp: new Date().toISOString(),
      read: false,
    });
    this.emitState();
    return { success: true, amount };
  }

  // 3. Student Email Validation (15% instant discount)
  public validateStudentEmail(email: string): { isValid: boolean; discountPercentage: number; message: string } {
    if (!email || typeof email !== 'string') {
      return { isValid: false, discountPercentage: 0, message: 'Invalid email address.' };
    }
    const cleanEmail = email.trim().toLowerCase();
    const isEdu = cleanEmail.endsWith('.edu') || cleanEmail.endsWith('.ac.in') || cleanEmail.includes('.edu.') || cleanEmail.endsWith('.college');

    if (isEdu) {
      return {
        isValid: true,
        discountPercentage: 15,
        message: 'Student status verified! 15% discount unlocked on your individual bill.',
      };
    }

    return {
      isValid: false,
      discountPercentage: 0,
      message: 'Email does not match an accredited academic institution domain (.edu or .ac.in).',
    };
  }

  // 4. "Go Dutch" Individual Guest Order Submission & Table Aggregation
  public submitGuestOrder(params: {
    tableId: string;
    orderType: 'dine-in' | 'takeaway';
    guestName: string;
    deviceId?: string;
    socketId?: string;
    email?: string;
    items: { dishId: string; quantity: number; specialInstructions?: string }[];
  }): { success: boolean; masterOrder?: MasterOrder; guestOrder?: GuestSubOrder; error?: string } {
    const { tableId, orderType, guestName, email, items } = params;

    if (!items || items.length === 0) {
      return { success: false, error: 'No items in order.' };
    }

    // Find table
    const table = this.tables.find((t) => t.id === tableId || `T-${t.number}` === tableId || `${t.number}` === tableId);
    if (!table) {
      return { success: false, error: `Table ${tableId} not found.` };
    }

    // Ensure table is marked occupied
    table.status = 'occupied';
    table.guestCount = Math.max(table.guestCount, 1);
    table.occupiedAt = table.occupiedAt || new Date().toISOString();

    // Student validation
    const studentCheck = email ? this.validateStudentEmail(email) : { isValid: false, discountPercentage: 0 };

    // Build sub-order items (Inventory is subtracted when Chef clicks "Start Making" in Chef Space)
    let subtotal = 0;
    const subOrderItems = [];
    const newDishesToSchedule: AggregatedCourseDish[] = [];

    const guestSubOrderId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Break into individual cookable unit dishes for stove tracking with priority sequencing
    const coursePriority: Record<CourseType, number> = { Starter: 1, Main: 2, Dessert: 3 };

    for (const item of items) {
      const dish = MENU_ITEMS.find((d) => d.id === item.dishId);
      if (!dish) continue;

      const lineCost = dish.price * item.quantity;
      subtotal += lineCost;

      subOrderItems.push({
        dishId: dish.id,
        dishName: dish.name,
        course: dish.course,
        price: dish.price,
        quantity: item.quantity,
        specialInstructions: item.specialInstructions,
      });

      // Break into individual cookable unit dishes for stove tracking
      for (let q = 0; q < item.quantity; q++) {
        newDishesToSchedule.push({
          uniqueId: `dish_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          dishId: dish.id,
          dishName: dish.name,
          course: dish.course,
          guestName,
          guestSubOrderId,
          cookTimeSeconds: dish.cookTimeSeconds,
          status: 'queued',
          remainingSeconds: dish.cookTimeSeconds,
        });
      }
    }

    // Sort to guarantee Serve First (Starters), Serve Second (Mains), Serve Third (Desserts)
    newDishesToSchedule.sort((a, b) => coursePriority[a.course] - coursePriority[b.course]);

    const discountAmount = studentCheck.isValid ? Number(((subtotal * studentCheck.discountPercentage) / 100).toFixed(2)) : 0;
    const total = Number((subtotal - discountAmount).toFixed(2));

    // Every sale immediately increases live Owner revenue
    this.revenue = Number((this.revenue + total).toFixed(2));

    const guestSubOrder: GuestSubOrder = {
      id: guestSubOrderId,
      guestName,
      deviceId: params.deviceId,
      socketId: params.socketId,
      email,
      isStudentDiscountApplied: studentCheck.isValid,
      discountPercentage: studentCheck.discountPercentage,
      items: subOrderItems,
      subtotal,
      discountAmount,
      total,
      paymentStatus: 'pending', // paid separately by each phone (Go Dutch)
      cookingStarted: false,
    };

    // Find or create MasterOrder for this table
    let masterOrder = this.orders.find((o) => o.tableId === table.id && !o.isCompleted);

    if (!masterOrder) {
      masterOrder = {
        id: `ORD-${table.id}-${Math.floor(1000 + Math.random() * 9000)}`,
        tableId: table.id,
        tableNumber: table.number,
        orderType,
        createdAt: new Date().toISOString(),
        guests: [],
        aggregatedDishes: [],
        courseStatuses: {
          Starter: 'queued',
          Main: 'queued',
          Dessert: 'queued',
        },
        totalEstimatedWaitSeconds: 0,
        isCompleted: false,
      };
      this.orders.unshift(masterOrder);
      table.activeOrderId = masterOrder.id;
    }

    // Go Dutch merge: push guest order into master order
    masterOrder.guests.push(guestSubOrder);
    masterOrder.aggregatedDishes.push(...newDishesToSchedule);

    // Recalculate dynamic wait times (Dishes start cooking when Chef clicks "Start Making")
    masterOrder.totalEstimatedWaitSeconds = this.calculateEstimatedWaitTimeForOrder(masterOrder);

    // Notify waiter of new order
    this.addNotification({
      id: `notif_${Date.now()}`,
      type: 'order_placed',
      tableId: table.id,
      tableNumber: table.number,
      message: `Table ${table.number} - New order from ${guestName} (₹${total}) - payment pending`,
      timestamp: new Date().toISOString(),
      read: false,
    });

    this.emitState();
    return { success: true, masterOrder, guestOrder: guestSubOrder };
  }

  // 5. Dynamic Wait Time Estimator (Stove CPU Thread Model)
  public calculateEstimatedWaitTimeForOrder(order: MasterOrder): number {
    // Look at stoves current workload
    const stoveLoads = this.stoves.map((stove) => {
      const activeTime = stove.remainingSeconds;
      const queuedTime = stove.queue.reduce((acc, d) => acc + d.cookTimeSeconds, 0);
      return activeTime + queuedTime;
    });

    // Minimum wait time is bounded by highest busy stove thread or shortest available thread + dish cook time
    const minLoad = Math.min(...stoveLoads);
    const maxDishTime = order.aggregatedDishes.reduce((max, d) => Math.max(max, d.cookTimeSeconds), 0);
    return minLoad + maxDishTime;
  }

  // Schedule queued dishes to least busy Stove CPU Thread
  private scheduleDishesOnStoves(dishes: AggregatedCourseDish[]) {
    // Sort so Starters are scheduled first, Mains second, Dessert third
    const coursePriority: Record<CourseType, number> = { Starter: 1, Main: 2, Dessert: 3 };
    const sortedDishes = [...dishes].sort((a, b) => coursePriority[a.course] - coursePriority[b.course]);

    for (const dish of sortedDishes) {
      // Find stove with shortest combined wait time (least loaded thread)
      let targetStove = this.stoves[0];
      let minDuration = this.getStoveWorkload(this.stoves[0]);

      for (let i = 1; i < this.stoves.length; i++) {
        const load = this.getStoveWorkload(this.stoves[i]);
        if (load < minDuration) {
          minDuration = load;
          targetStove = this.stoves[i];
        }
      }

      dish.assignedStoveId = targetStove.id;

      if (!targetStove.activeDish) {
        // Stove is idle; assign immediately
        targetStove.activeDish = dish;
        targetStove.remainingSeconds = dish.cookTimeSeconds;
        targetStove.totalDurationSeconds = dish.cookTimeSeconds;
        dish.status = 'cooking';
        dish.remainingSeconds = dish.cookTimeSeconds;
      } else {
        // Append to stove queue
        targetStove.queue.push(dish);
      }
    }
  }

  private getStoveWorkload(stove: StoveThread): number {
    const active = stove.remainingSeconds;
    const queued = stove.queue.reduce((sum, item) => sum + item.cookTimeSeconds, 0);
    return active + queued;
  }

  // 6. Tick Stove Timers (Simulating kitchen cook clock)
  private startCookTimerTicker() {
    this.timerInterval = setInterval(() => {
      let stateChanged = false;

      for (const stove of this.stoves) {
        if (stove.activeDish) {
          stove.remainingSeconds = Math.max(0, stove.remainingSeconds - 1);
          stove.activeDish.remainingSeconds = stove.remainingSeconds;
          stateChanged = true;

          // When cook finishes
          if (stove.remainingSeconds <= 0) {
            const finishedDish = stove.activeDish;
            finishedDish.status = 'plated';

            // Check if all dishes of this course for the table are plated
            this.checkAndNotifyCoursePlated(finishedDish);

            // Pop next dish from queue
            if (stove.queue.length > 0) {
              const nextDish = stove.queue.shift()!;
              nextDish.status = 'cooking';
              nextDish.remainingSeconds = nextDish.cookTimeSeconds;
              stove.activeDish = nextDish;
              stove.remainingSeconds = nextDish.cookTimeSeconds;
              stove.totalDurationSeconds = nextDish.cookTimeSeconds;
            } else {
              stove.activeDish = null;
              stove.remainingSeconds = 0;
              stove.totalDurationSeconds = 0;
            }
          }
        }
      }

      if (stateChanged) {
        this.emitState();
      }
    }, 1000);
  }

  // 7. Manual Advance Cook Timers (For Instant Hackathon Demo)
  public advanceCookTimers(seconds: number = 5): void {
    for (const stove of this.stoves) {
      if (stove.activeDish) {
        stove.remainingSeconds = Math.max(0, stove.remainingSeconds - seconds);
        stove.activeDish.remainingSeconds = stove.remainingSeconds;

        if (stove.remainingSeconds <= 0) {
          const finishedDish = stove.activeDish;
          finishedDish.status = 'plated';
          this.checkAndNotifyCoursePlated(finishedDish);

          if (stove.queue.length > 0) {
            const nextDish = stove.queue.shift()!;
            nextDish.status = 'cooking';
            nextDish.remainingSeconds = nextDish.cookTimeSeconds;
            stove.activeDish = nextDish;
            stove.remainingSeconds = nextDish.cookTimeSeconds;
            stove.totalDurationSeconds = nextDish.cookTimeSeconds;
          } else {
            stove.activeDish = null;
            stove.remainingSeconds = 0;
            stove.totalDurationSeconds = 0;
          }
        }
      }
    }
    this.emitState();
  }

  // Check if course is completed and alert waiter
  private checkAndNotifyCoursePlated(dish: AggregatedCourseDish) {
    // Find master order
    const order = this.orders.find((o) => o.aggregatedDishes.some((d) => d.uniqueId === dish.uniqueId));
    if (!order) return;

    // Check all dishes of this course in this order
    const courseDishes = order.aggregatedDishes.filter((d) => d.course === dish.course);
    const allPlated = courseDishes.every((d) => d.status === 'plated' || d.status === 'delivered');

    if (allPlated && order.courseStatuses[dish.course] !== 'plated' && order.courseStatuses[dish.course] !== 'delivered') {
      order.courseStatuses[dish.course] = 'plated';

      // Alert Waiter Handheld
      this.addNotification({
        id: `notif_${Date.now()}_${dish.course}`,
        type: 'course_plated',
        tableId: order.tableId,
        tableNumber: order.tableNumber,
        course: dish.course,
        message: `TABLE ${order.tableNumber}: ${dish.course.toUpperCase()} is PLATED and ready for delivery!`,
        timestamp: new Date().toISOString(),
        read: false,
      });
    }
  }

  // Chef starts making a ticket: subtracts exact raw ingredients from Owner Space inventory & logs deductions
  public startCookingTicket(params: {
    ticketId: string;
    ticketLabel?: string;
    lines?: { name: string; qty: number }[];
  }): { success: boolean; record?: InventoryDeductionRecord } {
    if (this.startedTicketIds.has(params.ticketId)) {
      return { success: false };
    }
    this.startedTicketIds.add(params.ticketId);

    let label = params.ticketLabel || params.ticketId;
    const dishEntries: { dishId: string; dishName: string; qty: number }[] = [];

    // Check if this ticket belongs to a live MasterOrder GuestSubOrder
    let foundSubOrder: GuestSubOrder | undefined;
    let foundOrder: MasterOrder | undefined;
    for (const o of this.orders) {
      const g = o.guests.find((x) => x.id === params.ticketId);
      if (g) {
        foundSubOrder = g;
        foundOrder = o;
        g.cookingStarted = true;
        label = `${tableLabelOf(o.tableNumber)} · ${g.guestName}`;
        for (const it of g.items) {
          dishEntries.push({ dishId: it.dishId, dishName: it.dishName, qty: it.quantity });
        }
        const dishes = o.aggregatedDishes.filter((d) => d.guestSubOrderId === g.id);
        this.scheduleDishesOnStoves(dishes);
        break;
      }
    }

    // Fallback to lines passed from UI (e.g. initial tickets t4, t2)
    if (dishEntries.length === 0 && params.lines) {
      for (const l of params.lines) {
        const foundDish = MENU_ITEMS.find((m) => m.name.toLowerCase() === l.name.toLowerCase() || m.id === l.name);
        if (foundDish) {
          dishEntries.push({ dishId: foundDish.id, dishName: foundDish.name, qty: l.qty });
        }
      }
    }

    const perIngredient: Record<string, { amount: number; sources: string[] }> = {};
    const aiEngine = getRestockAIEngine();

    for (const entry of dishEntries) {
      const dish = MENU_ITEMS.find((m) => m.id === entry.dishId || m.name === entry.dishName);
      if (!dish) continue;
      aiEngine.logLiveOrder(dish.id, entry.qty);
      for (const [mat, perUnit] of Object.entries(dish.ingredients)) {
        const totalUsed = perUnit * entry.qty;
        if (!perIngredient[mat]) {
          perIngredient[mat] = { amount: 0, sources: [] };
        }
        perIngredient[mat].amount += totalUsed;
        perIngredient[mat].sources.push(`${entry.qty}× ${dish.name} (${totalUsed})`);
      }
    }

    const deductions: { ingredientKey: string; amount: number; fromDishes: string }[] = [];
    for (const [mat, info] of Object.entries(perIngredient)) {
      if (this.inventory[mat] !== undefined) {
        this.inventory[mat] = Math.max(0, this.inventory[mat] - info.amount);
      }
      deductions.push({
        ingredientKey: mat,
        amount: info.amount,
        fromDishes: info.sources.join(', '),
      });
    }

    const record: InventoryDeductionRecord = {
      id: `ded_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      ticketId: params.ticketId,
      ticketLabel: label,
      dishesSummary: dishEntries.map((d) => `${d.qty}× ${d.dishName}`).join(', '),
      deductions,
      timestamp: new Date().toISOString(),
    };

    if (deductions.length > 0) {
      this.inventoryDeductions.unshift(record);
      if (this.inventoryDeductions.length > 20) {
        this.inventoryDeductions.pop();
      }
    }

    this.syncLowStockAlerts();
    this.emitState();
    return { success: true, record };
  }

  // Chef marks a specific dish or course plated
  public markDishPlated(orderId: string, dishUniqueId: string): boolean {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) return false;

    const dish = order.aggregatedDishes.find((d) => d.uniqueId === dishUniqueId);
    if (!dish) return false;

    dish.status = 'plated';

    // Free the stove if it was on a stove
    for (const stove of this.stoves) {
      if (stove.activeDish?.uniqueId === dishUniqueId) {
        stove.activeDish = null;
        stove.remainingSeconds = 0;
      }
      stove.queue = stove.queue.filter((q) => q.uniqueId !== dishUniqueId);
    }

    // Check if whole course or entire order is plated
    const courseDishes = order.aggregatedDishes.filter((d) => d.course === dish.course);
    const allCoursePlated = courseDishes.every((d) => d.status === 'plated' || d.status === 'delivered');
    if (allCoursePlated) {
      order.courseStatuses[dish.course] = 'plated';
    }

    const allDishesPlated = order.aggregatedDishes.every((d) => d.status === 'plated' || d.status === 'delivered');
    if (allDishesPlated) {
      order.isCompleted = true;
    }

    // Send direct audio/visual alert to Waiter Handheld
    this.addNotification({
      id: `notif_${Date.now()}_${dishUniqueId}`,
      type: 'course_plated',
      tableId: order.tableId,
      tableNumber: order.tableNumber,
      course: dish.course,
      message: `TABLE ${order.tableNumber}: ${dish.dishName} (${dish.course}) is PLATED! Deliver now.`,
      timestamp: new Date().toISOString(),
      read: false,
    });

    this.emitState();
    return true;
  }

  // Chef or Owner adjusts / alters AI prediction override
  public updateAiPredictionOverride(customSurge: string, customRecommendation: string) {
    this.aiPrediction.surgeCategory = customSurge;
    this.aiPrediction.recommendation = customRecommendation;
    this.emitState();
  }

  // Low Stock Alert Trigger
  private triggerLowStockAlert(ingredient: string, currentStock: number, threshold: number) {
    const existing = this.lowStockAlerts.find((a) => a.ingredient === ingredient);
    const message = `Low Stock Warning: ${ingredient} remaining: ${currentStock} (critical threshold: ${threshold})`;

    if (existing) {
      existing.currentStock = currentStock;
      existing.timestamp = new Date().toISOString();
      existing.message = message;
    } else {
      this.lowStockAlerts.unshift({
        id: `alert_${Date.now()}_${ingredient}`,
        ingredient,
        currentStock,
        threshold,
        timestamp: new Date().toISOString(),
        message,
      });
    }
  }

  // Restock inventory (Owner feature)
  public restockInventory(ingredient: string, amount: number): boolean {
    if (ingredient === 'all') {
      const defaults: Record<string, number> = {
        sourdoughSlices: 30,
        cheeseGrams: 500,
        patties: 20,
        coffeeBeansGrams: 500,
        friesGrams: 800,
        chocolateGrams: 400,
      };
      for (const [k, add] of Object.entries(defaults)) {
        if (this.inventory[k] !== undefined) {
          this.inventory[k] = Math.max(0, this.inventory[k] + add);
        }
      }
      this.syncLowStockAlerts();
      this.emitState();
      return true;
    }
    if (this.inventory[ingredient] !== undefined) {
      this.inventory[ingredient] = Math.max(0, this.inventory[ingredient] + amount);
      this.syncLowStockAlerts();
      this.emitState();
      return true;
    }
    return false;
  }

  // Add notification for Waiter / Owner
  private addNotification(notif: WaiterNotification) {
    this.waiterNotifications.unshift(notif);
    // Keep max 25 notifications
    if (this.waiterNotifications.length > 25) {
      this.waiterNotifications.pop();
    }
  }

  public dismissNotification(notifId: string): boolean {
    const notif = this.waiterNotifications.find((n) => n.id === notifId);
    if (notif) {
      notif.read = true;
      this.emitState();
      return true;
    }
    return false;
  }

  // Simulate multiple friends ordering at Table 4 (Hackathon feature)
  public simulateThreeFriendsOrdering(tableId: string = 'T-04') {
    // Friend 1: Alice (Student)
    this.submitGuestOrder({
      tableId,
      orderType: 'dine-in',
      guestName: 'Alice (Stanford .edu)',
      email: 'alice@stanford.edu',
      items: [
        { dishId: 'starter_garlic_sourdough', quantity: 1 },
        { dishId: 'main_smash_burger', quantity: 1 },
      ],
    });

    // Friend 2: Bob (Main + Dessert)
    this.submitGuestOrder({
      tableId,
      orderType: 'dine-in',
      guestName: 'Bob (Colleague)',
      items: [
        { dishId: 'main_double_burger', quantity: 1 },
        { dishId: 'dessert_molten_lava', quantity: 1 },
      ],
    });

    // Friend 3: Chloe (Starter + Coffee)
    this.submitGuestOrder({
      tableId,
      orderType: 'dine-in',
      guestName: 'Chloe',
      items: [
        { dishId: 'starter_crispy_fries', quantity: 1 },
        { dishId: 'bev_specialty_espresso', quantity: 1 },
      ],
    });

    this.emitState();
  }

  // Reset entire state to pristine demo condition
  public resetDemoState() {
    this.initializeTables();
    this.initializeStoves();
    this.inventory = { ...INITIAL_INVENTORY };
    this.orders = [];
    this.revenue = 0;
    this.lowStockAlerts = [];
    this.waiterNotifications = [];
    this.inventoryDeductions = [];
    this.startedTicketIds.clear();
    this.syncLowStockAlerts();
    this.emitState();
  }
}

// Global Singleton for the server instance
declare global {
  var __synchroStateManager: SynchroStateManager | undefined;
}

export function getSynchroManager(): SynchroStateManager {
  if (!global.__synchroStateManager) {
    global.__synchroStateManager = new SynchroStateManager();
  }
  return global.__synchroStateManager;
}

