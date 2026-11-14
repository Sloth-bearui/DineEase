import { NextRequest, NextResponse } from 'next/server';
import { getSynchroManager } from '@/lib/stateManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
};

export async function GET() {
  const manager = getSynchroManager();
  manager.loadSnapshotIfNewer();
  return NextResponse.json(manager.getState(), { headers: noStoreHeaders });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const manager = getSynchroManager();
  manager.loadSnapshotIfNewer();

  const { action } = body;

  if (action === 'scan' || action === 'table_scan') {
    if (body.staff) {
      const table = manager.handleTableScan(String(body.tableId), body.guestCount || 1);
      return NextResponse.json({ success: !!table, table, state: manager.getState() }, { headers: noStoreHeaders });
    }
    const dev = body.deviceId || 'anon-phone';
    const check = manager.validateScan(String(body.tableId), body.uid, dev, body.joinMode);
    if (!check.ok) {
      return NextResponse.json(
        { success: false, error: check.error, tableId: body.tableId, state: manager.getState() },
        { headers: noStoreHeaders }
      );
    }
    const table = manager.handleTableScan(String(body.tableId), body.guestCount || 1, {
      deviceId: dev,
      socketId: dev,
      guestName: body.guestName,
    });
    return NextResponse.json({ success: !!table, table, state: manager.getState() }, { headers: noStoreHeaders });
  }

  if (action === 'leave_table') {
    manager.handleLeaveTable(String(body.tableId), body.deviceId || '');
    return NextResponse.json({ success: true, state: manager.getState() }, { headers: noStoreHeaders });
  }

  if (action === 'clear_table') {
    const success = manager.handleClearTable(String(body.tableId));
    return NextResponse.json({ success, state: manager.getState() }, { headers: noStoreHeaders });
  }

  if (action === 'submit_order' || action === 'submit_guest_order') {
    const result = manager.submitGuestOrder(body);
    return NextResponse.json({ ...result, state: manager.getState() }, { headers: noStoreHeaders });
  }

  if (action === 'pay_bills') {
    const result = manager.payBills({
      tableId: String(body.tableId),
      deviceId: body.deviceId || '',
      scope: body.scope || 'mine',
    });
    return NextResponse.json({ ...result, state: manager.getState() }, { headers: noStoreHeaders });
  }

  if (action === 'start_cooking_ticket') {
    const result = manager.startCookingTicket({
      ticketId: body.ticketId,
      ticketLabel: body.ticketLabel,
      lines: body.lines,
    });
    return NextResponse.json({ ...result, state: manager.getState() }, { headers: noStoreHeaders });
  }

  if (action === 'mark_dish_plated') {
    const success = manager.markDishPlated(body.orderId, body.dishUniqueId);
    return NextResponse.json({ success, state: manager.getState() }, { headers: noStoreHeaders });
  }

  if (action === 'restock_inventory') {
    const success = manager.restockInventory(body.ingredient, Number(body.amount) || 0);
    return NextResponse.json({ success, state: manager.getState() }, { headers: noStoreHeaders });
  }

  if (action === 'validate_student') {
    const result = manager.validateStudentEmail(body.email);
    return NextResponse.json({ ...result, state: manager.getState() }, { headers: noStoreHeaders });
  }

  if (action === 'advance_cook_timers') {
    manager.advanceCookTimers(body.seconds || 5);
    return NextResponse.json({ success: true, state: manager.getState() }, { headers: noStoreHeaders });
  }

  if (action === 'simulate_friends') {
    manager.simulateThreeFriendsOrdering(body.tableId || 'T-04');
    return NextResponse.json({ success: true, state: manager.getState() }, { headers: noStoreHeaders });
  }

  if (action === 'reset_demo') {
    manager.resetDemoState();
    return NextResponse.json({ success: true, state: manager.getState() }, { headers: noStoreHeaders });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400, headers: noStoreHeaders });
}
