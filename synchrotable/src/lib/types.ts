// Shared data models and types for SynchroTable

export type TableStatus = 'vacant' | 'occupied';

export interface TableSessionDevice {
  deviceId: string;
  socketId: string;
  guestName: string;
  joinedAt: string;
  lastActiveAt: string;
}

export interface Table {
  id: string; // e.g. "T-01"
  number: number; // 1..4
  uid: string; // unique per dining session, embedded in the table QR code
  status: TableStatus;
  guestCount: number;
  activeOrderId: string | null;
  occupiedAt: string | null;
  activeDevices?: TableSessionDevice[]; // All phones currently recognized at this table
  tableUpdatedAt?: number;
  clearedAt?: number;
}

export type CourseType = 'Starter' | 'Main' | 'Dessert';

export interface DishItem {
  id: string;
  name: string;
  course: CourseType;
  price: number;
  cookTimeSeconds: number; // For demo: e.g. 15-45s (or minutes in production)
  ingredients: Record<string, number>; // raw material key -> amount needed
  description?: string;
  imageUrl?: string;
}

export interface GuestSubOrderItem {
  dishId: string;
  dishName: string;
  course: CourseType;
  price: number;
  quantity: number;
  specialInstructions?: string;
}

export interface GuestSubOrder {
  id: string;
  guestName: string;
  deviceId?: string; // Unique phone device fingerprint
  socketId?: string; // WebSocket connection ID
  email?: string;
  isStudentDiscountApplied: boolean;
  discountPercentage: number;
  items: GuestSubOrderItem[];
  subtotal: number;
  discountAmount: number;
  total: number;
  paymentStatus: 'pending' | 'paid';
  paidAt?: string;
  cookingStarted?: boolean;
}

export interface InventoryDeductionRecord {
  id: string;
  ticketId: string;
  ticketLabel: string;
  dishesSummary: string;
  deductions: { ingredientKey: string; amount: number; fromDishes: string }[];
  timestamp: string;
}

export type CourseStatus = 'queued' | 'cooking' | 'plated' | 'delivered';

export interface AggregatedCourseDish {
  uniqueId: string; // item identifier for stove tracking
  dishId: string;
  dishName: string;
  course: CourseType;
  guestName: string;
  guestSubOrderId: string;
  cookTimeSeconds: number;
  assignedStoveId?: number | null;
  status: CourseStatus;
  startTime?: string | null;
  remainingSeconds: number;
}

export interface MasterOrder {
  id: string; // e.g. "ORD-T04-9821"
  tableId: string;
  tableNumber: number;
  orderType: 'dine-in' | 'takeaway';
  createdAt: string;
  guests: GuestSubOrder[];
  aggregatedDishes: AggregatedCourseDish[];
  courseStatuses: {
    Starter: CourseStatus;
    Main: CourseStatus;
    Dessert: CourseStatus;
  };
  totalEstimatedWaitSeconds: number;
  isCompleted: boolean;
}

export interface StoveThread {
  id: number; // 1, 2, 3
  name: string;
  activeDish: AggregatedCourseDish | null;
  remainingSeconds: number;
  totalDurationSeconds: number;
  queue: AggregatedCourseDish[];
}

export type InventoryMap = {
  sourdoughSlices: number;
  cheeseGrams: number;
  patties: number;
  coffeeBeansGrams: number;
  friesGrams: number;
  chocolateGrams: number;
  [key: string]: number;
};

export interface InventoryThresholds {
  [key: string]: number;
}

export interface LowStockAlert {
  id: string;
  ingredient: string;
  currentStock: number;
  threshold: number;
  timestamp: string;
  message: string;
}

export interface WaiterNotification {
  id: string;
  type: 'course_plated' | 'table_assistance' | 'order_placed';
  tableId: string;
  tableNumber: number;
  course?: CourseType;
  message: string;
  timestamp: string;
  read: boolean;
}

export interface AIPrediction {
  period: string; // e.g. "08:30 AM - 10:00 AM"
  surgeCategory: string; // "Morning Coffee Surge"
  confidence: number; // 0.94
  recommendation: string;
  inventoryWarning: string;
  peakHourGraph: { hour: string; traffic: number }[];
}

export interface SynchroGameState {
  tables: Table[];
  stoves: StoveThread[];
  inventory: InventoryMap;
  orders: MasterOrder[];
  lowStockAlerts: LowStockAlert[];
  waiterNotifications: WaiterNotification[];
  aiPrediction: AIPrediction;
  revenue?: number;
  inventoryDeductions?: InventoryDeductionRecord[];
  updatedAt?: number;
  inventoryUpdatedAt?: number;
  resetEpoch?: number;
}

