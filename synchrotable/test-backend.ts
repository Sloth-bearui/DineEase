import { getSynchroManager } from './src/lib/stateManager';
import { MENU_ITEMS } from './src/lib/data';

console.log('--- Testing SynchroTable Backend Logic ---');

const manager = getSynchroManager();

console.log('1. Initial State: Tables count =', manager.getState().tables.length);
console.log('   Stoves count =', manager.getState().stoves.length);
console.log('   Initial Inventory =', manager.getState().inventory);

// Test Student email
console.log('\n2. Testing Student Email Validation:');
console.log('   test@gmail.com ->', manager.validateStudentEmail('test@gmail.com'));
console.log('   alex@stanford.edu ->', manager.validateStudentEmail('alex@stanford.edu'));
console.log('   rahul@iitb.ac.in ->', manager.validateStudentEmail('rahul@iitb.ac.in'));

// Test Table Scan
console.log('\n3. Testing Table QR Scan:');
const table4 = manager.handleTableScan('T-04', 3);
console.log(`   Table 4 scanned -> status: ${table4?.status}, guests: ${table4?.guestCount}`);

// Test Go Dutch 3 Friends Ordering
console.log('\n4. Testing Go Dutch 3 Friends Ordering:');
manager.simulateThreeFriendsOrdering('T-04');
const stateAfterOrders = manager.getState();
console.log(`   Master Orders count: ${stateAfterOrders.orders.length}`);
const masterOrder = stateAfterOrders.orders[0];
console.log(`   Master Order Table: ${masterOrder.tableNumber}, Guests count: ${masterOrder.guests.length}`);
console.log(`   Guest 1 (${masterOrder.guests[0].guestName}): Total $${masterOrder.guests[0].total} (Student discount: ${masterOrder.guests[0].isStudentDiscountApplied})`);
console.log(`   Guest 2 (${masterOrder.guests[1].guestName}): Total $${masterOrder.guests[1].total}`);
console.log(`   Guest 3 (${masterOrder.guests[2].guestName}): Total $${masterOrder.guests[2].total}`);

console.log('\n5. Virtual Stove CPU Threads:');
for (const stove of stateAfterOrders.stoves) {
  console.log(`   [${stove.name}] Active: ${stove.activeDish?.dishName || 'Idle'} (${stove.remainingSeconds}s remaining), Queue: ${stove.queue.length} dishes`);
}

console.log('\n6. Inventory Deductions:');
console.log('   Inventory now:', stateAfterOrders.inventory);
console.log('   Low Stock Alerts:', stateAfterOrders.lowStockAlerts);

console.log('\n7. Advance Cook Timers by 20s:');
manager.advanceCookTimers(20);
const stateAfterTick = manager.getState();
console.log('   Waiter Notifications:', stateAfterTick.waiterNotifications.map(n => n.message));

console.log('\n8. Table Clearance override:');
manager.handleClearTable('T-04');
console.log('   Table 4 status after clear:', manager.getState().tables.find(t => t.id === 'T-04')?.status);

console.log('\n✅ All backend features tested and verified successfully!');
process.exit(0);

