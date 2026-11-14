import http from 'http';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { getSynchroManager } from './src/lib/stateManager';
import { CourseType } from './src/lib/types';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3001', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = http.createServer((req, res) => {
    // Custom API or Next.js handler
    handle(req, res);
  });

  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  const manager = getSynchroManager();

  // Attach broadcast hook from manager to Socket.io
  manager.setBroadcastCallback((event: string, data: any) => {
    io.emit(event, data);
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    // Send current state immediately on connection
    socket.emit('synchro_state_updated', manager.getState());

    // 1. Table QR Scan Event with Phone Device Identifier
    socket.on(
      'table_scan',
      ({
        tableId,
        guestCount,
        deviceId,
        guestName,
        uid,
        joinMode,
        staff,
      }: {
        tableId: string;
        guestCount?: number;
        deviceId?: string;
        guestName?: string;
        uid?: string;
        joinMode?: 'inside' | 'outside';
        staff?: boolean;
      }) => {
        // Staff seating a party by hand (no phone attached)
        if (staff) {
          const table = manager.handleTableScan(tableId, guestCount || 1);
          socket.emit('scan_result', { success: !!table, table });
          return;
        }
        const dev = deviceId || socket.id;
        const check = manager.validateScan(tableId, uid, dev, joinMode);
        if (!check.ok) {
          socket.emit('scan_result', { success: false, error: check.error, tableId });
          return;
        }
        const table = manager.handleTableScan(tableId, guestCount || 1, {
          deviceId: dev,
          socketId: socket.id,
          guestName,
        });
        socket.emit('scan_result', { success: !!table, table });
      }
    );

    // Go Dutch payment: one phone pays its own bill, or the whole table
    socket.on(
      'pay_bills',
      ({ tableId, deviceId, scope }: { tableId: string; deviceId: string; scope: 'mine' | 'table' }) => {
        const result = manager.payBills({ tableId, deviceId, scope });
        socket.emit('pay_result', result);
      }
    );

    // 2. Submit Guest Order ("Go Dutch" individual submission with phone device tracking)
    socket.on(
      'submit_guest_order',
      (payload: {
        tableId: string;
        orderType: 'dine-in' | 'takeaway';
        guestName: string;
        deviceId?: string;
        email?: string;
        items: { dishId: string; quantity: number; specialInstructions?: string }[];
      }) => {
        const result = manager.submitGuestOrder({
          ...payload,
          socketId: socket.id,
        });
        socket.emit('guest_order_result', result);
      }
    );

    socket.on('leave_table', ({ tableId, deviceId }: { tableId: string; deviceId: string }) => {
      manager.handleLeaveTable(tableId, deviceId);
    });

    // 3. Clear Table (Waiter / Owner)
    socket.on('clear_table', ({ tableId }: { tableId: string }) => {
      const success = manager.handleClearTable(tableId);
      socket.emit('clear_table_result', { success, tableId });
    });

    // 4. Chef starts making a ticket (subtracts ingredients in Owner Space) & item-by-item plating
    socket.on(
      'start_cooking_ticket',
      (payload: { ticketId: string; ticketLabel?: string; lines?: { name: string; qty: number }[] }) => {
        const result = manager.startCookingTicket(payload);
        socket.emit('ticket_cooking_started', result);
      }
    );

    socket.on('mark_dish_plated', ({ orderId, dishUniqueId }: { orderId: string; dishUniqueId: string }) => {
      const success = manager.markDishPlated(orderId, dishUniqueId);
      socket.emit('dish_plated_result', { success, orderId, dishUniqueId });
    });

    socket.on('mark_order_ready', ({ orderId }: { orderId: string }) => {
      const order = manager.getState().orders.find((o) => o.id === orderId);
      if (order) {
        order.aggregatedDishes.forEach((d) => {
          manager.markDishPlated(orderId, d.uniqueId);
        });
      }
    });

    socket.on('alter_ai_prediction', ({ surgeCategory, recommendation }: { surgeCategory: string; recommendation: string }) => {
      manager.updateAiPredictionOverride(surgeCategory, recommendation);
    });

    // 5. Student Email Verification
    socket.on('verify_student_email', ({ email }: { email: string }) => {
      const result = manager.validateStudentEmail(email);
      socket.emit('student_verification_result', result);
    });

    // 6. Restock Inventory
    socket.on('restock_inventory', ({ ingredient, amount }: { ingredient: string; amount: number }) => {
      const success = manager.restockInventory(ingredient, amount);
      socket.emit('restock_result', { success, ingredient, amount });
    });

    // 7. Dismiss Notification
    socket.on('dismiss_notification', ({ notificationId }: { notificationId: string }) => {
      manager.dismissNotification(notificationId);
    });

    // 8. Demo Simulator Triggers
    socket.on('simulate_friends_ordering', ({ tableId }: { tableId?: string }) => {
      manager.simulateThreeFriendsOrdering(tableId || 'T-04');
    });

    socket.on('advance_cook_timers', ({ seconds }: { seconds?: number }) => {
      manager.advanceCookTimers(seconds || 5);
    });

    socket.on('reset_demo_state', () => {
      manager.resetDemoState();
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });

  server.listen(port, () => {
    console.log(`> SynchroTable server ready at http://localhost:${port}`);
    console.log(`> WebSockets active on port ${port}`);
  });
});

