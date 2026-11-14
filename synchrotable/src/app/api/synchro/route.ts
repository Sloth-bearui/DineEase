import { NextRequest, NextResponse } from 'next/server';
import { getSynchroManager } from '@/lib/stateManager';
import { CLOUD_SYNC_URL, toCompactSyncPayload } from '@/lib/synchroMerge';

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
};

async function pullCloudStateIntoManager() {
  const manager = getSynchroManager();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1400);
    const res = await fetch(`${CLOUD_SYNC_URL}/json?poll=1&since=30m`, {
      cache: 'no-store',
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return;
    const text = await res.text();
    const lines = text.trim().split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const evt = JSON.parse(line);
        if (evt?.event === 'message' && typeof evt.message === 'string') {
          const parsed = JSON.parse(evt.message);
          manager.absorbClientState(parsed);
        }
      } catch {
        // Ignore malformed lines
      }
    }
  } catch {
    // Ignore cloud sync timeouts
  }
}

async function pushManagerStateToCloud() {
  const manager = getSynchroManager();
  try {
    const compact = toCompactSyncPayload(manager.getState());
    const body = JSON.stringify(compact);
    if (body.length < 3900) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 1400);
      await fetch(CLOUD_SYNC_URL, {
        method: 'POST',
        body,
        signal: ctrl.signal,
      });
      clearTimeout(timer);
    }
  } catch {
    // Ignore cloud sync errors
  }
}

export async function GET(req: NextRequest) {
  void req.nextUrl.searchParams.get('t');
  const manager = getSynchroManager();
  manager.loadSnapshotIfNewer();
  // If this serverless instance is cold or hasn't synced in the last 2s, pull latest cloud state
  const current = manager.getState();
  if (!current.updatedAt || Date.now() - current.updatedAt > 2000) {
    await pullCloudStateIntoManager();
  }
  return NextResponse.json(manager.getState(), { headers: noStoreHeaders });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const manager = getSynchroManager();
  manager.loadSnapshotIfNewer();

  if (body.clientState) {
    manager.absorbClientState(body.clientState);
  } else if (!manager.getState().updatedAt) {
    await pullCloudStateIntoManager();
  }

  const { action } = body;

  if (action === 'scan' || action === 'table_scan') {
    if (body.staff) {
      const table = manager.handleTableScan(String(body.tableId), body.guestCount || 1);
      await pushManagerStateToCloud();
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
    await pushManagerStateToCloud();
    return NextResponse.json({ success: !!table, table, state: manager.getState() }, { headers: noStoreHeaders });
  }

  if (action === 'leave_table') {
    manager.handleLeaveTable(String(body.tableId), body.deviceId || '');
    await pushManagerStateToCloud();
    return NextResponse.json({ success: true, state: manager.getState() }, { headers: noStoreHeaders });
  }

  if (action === 'clear_table') {
    const success = manager.handleClearTable(String(body.tableId));
    await pushManagerStateToCloud();
    return NextResponse.json({ success, state: manager.getState() }, { headers: noStoreHeaders });
  }

  if (action === 'submit_order' || action === 'submit_guest_order') {
    const result = manager.submitGuestOrder(body);
    await pushManagerStateToCloud();
    return NextResponse.json({ ...result, state: manager.getState() }, { headers: noStoreHeaders });
  }

  if (action === 'pay_bills') {
    const result = manager.payBills({
      tableId: String(body.tableId),
      deviceId: body.deviceId || '',
      scope: body.scope || 'mine',
    });
    await pushManagerStateToCloud();
    return NextResponse.json({ ...result, state: manager.getState() }, { headers: noStoreHeaders });
  }

  if (action === 'start_cooking_ticket') {
    const result = manager.startCookingTicket({
      ticketId: body.ticketId,
      ticketLabel: body.ticketLabel,
      lines: body.lines,
    });
    await pushManagerStateToCloud();
    return NextResponse.json({ ...result, state: manager.getState() }, { headers: noStoreHeaders });
  }

  if (action === 'mark_dish_plated') {
    const success = manager.markDishPlated(body.orderId, body.dishUniqueId);
    await pushManagerStateToCloud();
    return NextResponse.json({ success, state: manager.getState() }, { headers: noStoreHeaders });
  }

  if (action === 'restock_inventory') {
    const success = manager.restockInventory(body.ingredient, Number(body.amount) || 0);
    await pushManagerStateToCloud();
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
    await pushManagerStateToCloud();
    return NextResponse.json({ success: true, state: manager.getState() }, { headers: noStoreHeaders });
  }

  if (action === 'reset_demo') {
    manager.resetDemoState();
    await pushManagerStateToCloud();
    return NextResponse.json({ success: true, state: manager.getState() }, { headers: noStoreHeaders });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400, headers: noStoreHeaders });
}
