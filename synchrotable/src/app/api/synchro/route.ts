import { NextRequest, NextResponse } from 'next/server';
import { getSynchroManager } from '@/lib/stateManager';

export async function GET() {
  const manager = getSynchroManager();
  return NextResponse.json(manager.getState());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const manager = getSynchroManager();

  const { action } = body;

  if (action === 'scan') {
    const table = manager.handleTableScan(body.tableId, body.guestCount || 1);
    return NextResponse.json({ success: !!table, table });
  }

  if (action === 'clear_table') {
    const success = manager.handleClearTable(body.tableId);
    return NextResponse.json({ success });
  }

  if (action === 'submit_order') {
    const result = manager.submitGuestOrder(body);
    return NextResponse.json(result);
  }

  if (action === 'validate_student') {
    const result = manager.validateStudentEmail(body.email);
    return NextResponse.json(result);
  }

  if (action === 'advance_cook_timers') {
    manager.advanceCookTimers(body.seconds || 5);
    return NextResponse.json({ success: true });
  }

  if (action === 'simulate_friends') {
    manager.simulateThreeFriendsOrdering(body.tableId || 'T-04');
    return NextResponse.json({ success: true });
  }

  if (action === 'reset_demo') {
    manager.resetDemoState();
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

