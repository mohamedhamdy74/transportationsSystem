const ENDPOINT = 'https://fra.cloud.appwrite.io/v1';
const PROJECT_ID = '6a3903c1003165e1ec9c';
const API_KEY = process.argv[2];

if (!API_KEY) {
  console.error('Usage: node seed_generator.js <APPWRITE_API_KEY>');
  process.exit(1);
}

const headers = {
  'X-Appwrite-Key': API_KEY,
  'X-Appwrite-Project': PROJECT_ID,
  'Content-Type': 'application/json'
};

async function api(method, path, body = null) {
  const res = await fetch(ENDPOINT + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json();
  if (!res.ok && res.status !== 409) throw new Error(res.status + ': ' + (data.message || JSON.stringify(data)));
  return data;
}

async function createCollection(dbId, col) {
  try {
    await api('POST', '/databases/' + dbId + '/collections', { collectionId: col.id, name: col.name, permissions: ['read("any")', 'write("any")'], documentSecurity: false });
    return true;
  } catch (e) {
    if (e.message.includes('409')) {
      await api('DELETE', '/databases/' + dbId + '/collections/' + col.id);
      await api('POST', '/databases/' + dbId + '/collections', { collectionId: col.id, name: col.name, permissions: ['read("any")', 'write("any")'], documentSecurity: false });
      return true;
    }
    return false;
  }
}

async function addStringAttr(dbId, colId, key, size = 255) {
  try {
    await api('POST', '/databases/' + dbId + '/collections/' + colId + '/attributes/string', { key, size, required: false });
    console.log('    Attr: ' + key);
  } catch (e) {}
}

async function addIntegerAttr(dbId, colId, key) {
  try {
    await api('POST', '/databases/' + dbId + '/collections/' + colId + '/attributes/integer', { key, required: false });
    console.log('    Attr: ' + key);
  } catch (e) {}
}

async function main() {
  const dbId = 'transportations_db';
  console.log('Inspections:');
  await createCollection(dbId, { id: 'inspections', name: 'inspections' });
  ['no', 'letters', 'company', 'vehicleType', 'vehicleModel', 'inspectionDate', 'status', 'exitStatus', 'operatorDriver', 'licenseExpiry', 'regExpiry', 'inspectedBy', 'remarks'].forEach(a => addStringAttr(dbId, 'inspections', a));
  console.log('GPS Vehicles:');
  await createCollection(dbId, { id: 'gps_vehicles', name: 'gps_vehicles' });
  ['company', 'username', 'password', 'carType', 'carNo', 'comments'].forEach(a => addStringAttr(dbId, 'gps_vehicles', a));
  console.log('Daily Plans:');
  await createCollection(dbId, { id: 'daily_plans', name: 'daily_plans' });
  ['date', 'company', 'plateNumber', 'driverName', 'route', 'passengers', 'shift', 'carType'].forEach(a => addStringAttr(dbId, 'daily_plans', a));
  ['num', 'passengerQnt'].forEach(a => addIntegerAttr(dbId, 'daily_plans', a));
  console.log('Requests:');
  await createCollection(dbId, { id: 'requests', name: 'requests' });
  ['company', 'request_type', 'car_no', 'car_type', 'status', 'created_at'].forEach(a => addStringAttr(dbId, 'requests', a));
  console.log('Accounts:');
  await createCollection(dbId, { id: 'accounts', name: 'accounts' });
  ['company', 'username', 'password', 'role'].forEach(a => addStringAttr(dbId, 'accounts', a));
  console.log('Default accounts:');
  try {
    await api('POST', '/databases/' + dbId + '/collections/accounts/documents', { documentId: 'sys_admin', data: { username: 'admin', password: 'admin', role: 'admin', company: 'GPS Admin' } });
    console.log('  Created: admin');
  } catch (e) {}
  try {
    await api('POST', '/databases/' + dbId + '/collections/accounts/documents', { documentId: 'sys_inspector', data: { username: 'inspector', password: 'inspector', role: 'inspector', company: 'Gate Inspector' } });
    console.log('  Created: inspector');
  } catch (e) {}
  console.log('Done!');
}

main();

