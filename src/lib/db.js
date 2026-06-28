// Smart Plate Normalization for Matching Plates (e.g. "9492 ع س ر" with No: "9492", Letters: "ع س ر")
import { isConfigured, databases, DATABASE_ID, COLLECTIONS, checkCloudAvailability, resetCloudCheck, isCloudReady, pingAppwrite } from './appwrite.js';
import { ID, Query } from 'appwrite';
import { parsePlate, platesMatch } from './plateUtils.js';
import {
  getLatestInspectionsPerPlate,
  getLatestInspectionForPlate,
} from './inspectionUtils.js';
import { getCurrentUser } from './authSession.js';
import { listUserProfiles } from './auth.js';
import { deleteAppUser } from './userApi.js';
import {
  dailyPlanDocumentPermissions,
  inspectionDocumentPermissions,
} from './permissions.js';

export { parsePlate, platesMatch } from './plateUtils.js';
export { getLatestInspectionsPerPlate, getLatestInspectionForPlate } from './inspectionUtils.js';

import { env } from './env.js';

// Ping Appwrite server on app load to verify setup
if (import.meta.env.DEV) {
  pingAppwrite().then(success => {
    if (success) {
      console.log(`Appwrite connected: ${env.appwriteProjectName}`);
    }
  });
}

export function normalizeCompany(name) {
  return (name || '').trim().replace(/\s+/g, ' ');
}

export function companiesMatch(a, b) {
  if (!a || !b) return false;
  return normalizeCompany(a).toLowerCase() === normalizeCompany(b).toLowerCase();
}

export function getPlanPassengers(plan) {
  try {
    const list = JSON.parse(plan?.passengers || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function withSyncedPassengerCount(plan) {
  const passengerList = getPlanPassengers(plan);
  return {
    ...plan,
    passengers: JSON.stringify(passengerList),
    passengerQnt: passengerList.length,
  };
}

// ─── System accounts (admin / inspector) — loaded from Appwrite only in production ───
export async function getSystemAccounts() {
  try {
    const profiles = await listUserProfiles();
    return profiles.filter(p => p.role === 'admin' || p.role === 'inspector');
  } catch (e) {
    console.error('getSystemAccounts failed:', e);
    return [];
  }
}

export async function getAccountsForLogin() {
  return listUserProfiles();
}

export async function getAllAccountsForAdmin() {
  const profiles = await listUserProfiles();
  const gpsVehicles = await db.getGpsVehicles();
  const result = profiles.map(p => ({ ...p, source: 'profile' }));
  const seen = new Set(profiles.map(p => p.username.toLowerCase()));

  for (const g of gpsVehicles) {
    if (!g.username) continue;
    const key = g.username.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      id: g.id,
      username: g.username,
      company: g.company,
      role: 'company',
      source: 'gps',
      gpsVehicleId: g.id,
      carNo: g.carNo,
    });
  }
  return result;
}

// ─── Rate-limit-safe retry helper ───────────────────────────────
const delay = (ms) => new Promise(res => setTimeout(res, ms));

function scopedCompanyQuery() {
  const user = getCurrentUser();
  if (user?.role === 'company' && user.company) {
    return Query.equal('company', user.company);
  }
  return null;
}

async function withRetry(fn, retries = 4, baseDelay = 600) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const isRateLimit = e.code === 429 || (e.message || '').toLowerCase().includes('rate limit');
      if (isRateLimit && attempt < retries) {
        const wait = baseDelay * Math.pow(2, attempt); // 600, 1200, 2400, 4800ms
        console.warn(`⏳ Rate limit hit — retrying in ${wait}ms (attempt ${attempt + 1}/${retries})...`);
        await delay(wait);
      } else {
        throw e;
      }
    }
  }
}

class DatabaseService {
  constructor() {
    // No-op constructor since we do not keep local cache syncing
  }

  async syncFromAppwrite() {
    // No-op to prevent errors in code calling syncFromAppwrite
    return;
  }

  async _writeAppwrite(collectionKey, documentId, data, docPermissions = null) {
    if (!isConfigured) return;
    const colId = COLLECTIONS[collectionKey];
    if (!colId) {
      throw new Error(`Unknown collection: ${collectionKey}`);
    }
    
    try {
      const payload = { ...data };
      delete payload.id;
      delete payload.$id;
      delete payload.$createdAt;
      delete payload.$updatedAt;
      delete payload.$permissions;
      delete payload.$databaseId;
      delete payload.$collectionId;
      
      await withRetry(async () => {
        try {
          await databases.updateDocument(DATABASE_ID, colId, documentId, payload);
        } catch (err) {
          if (err.code === 404) {
            await databases.createDocument(
              DATABASE_ID,
              colId,
              documentId,
              payload,
              docPermissions || undefined
            );
          } else {
            throw err;
          }
        }
      });
    } catch (e) {
      console.warn(`Appwrite write failed to ${collectionKey}:`, e.message);
      throw new Error(`فشل حفظ البيانات: ${e.message}`);
    }
  }

  // ── Getters (Directly async from Appwrite) ──
  async getInspections() {
    if (!isConfigured) return [];
    try {
      // Use maximum limit (usually 5000 in appwrite) to ensure we get all records
      const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.inspections, [Query.orderDesc('$createdAt'), Query.limit(5000)]);
      return res.documents.map(d => ({ ...d, id: d.$id }));
    } catch (e) {
      console.error('getInspections failed:', e);
      return [];
    }
  }

  async getGpsVehicles() {
    if (!isConfigured) return [];
    try {
      const queries = [Query.orderDesc('$createdAt'), Query.limit(5000)];
      const companyQuery = scopedCompanyQuery();
      if (companyQuery) queries.unshift(companyQuery);
      const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.gpsVehicles, queries);
      return res.documents.map(d => ({ ...d, id: d.$id }));
    } catch (e) {
      console.error('getGpsVehicles failed:', e);
      return [];
    }
  }

  async getDailyPlans() {
    if (!isConfigured) return [];
    try {
      const queries = [Query.orderDesc('$createdAt'), Query.limit(5000)];
      const companyQuery = scopedCompanyQuery();
      if (companyQuery) queries.unshift(companyQuery);
      const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.dailyPlans, queries);
      return res.documents.map(d => withSyncedPassengerCount({ ...d, id: d.$id }));
    } catch (e) {
      console.error('getDailyPlans failed:', e);
      return [];
    }
  }

  async getRequests() {
    if (!isConfigured) return [];
    try {
      const queries = [Query.orderDesc('$createdAt'), Query.limit(5000)];
      const companyQuery = scopedCompanyQuery();
      if (companyQuery) queries.unshift(companyQuery);
      const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.requests, queries);
      return res.documents.map(d => ({ ...d, id: d.$id }));
    } catch (e) {
      console.error('getRequests failed:', e);
      return [];
    }
  }

  async getCustomAccounts() {
    if (!isConfigured) return [];
    try {
      const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.accounts, [Query.limit(500)]);
      const list = res.documents.map(d => ({ ...d, id: d.$id }));
      return list.filter(d => d.role !== 'admin' && d.role !== 'inspector');
    } catch (e) {
      console.error('getCustomAccounts failed:', e);
      return [];
    }
  }

  async getSystemAccounts() {
    return getSystemAccounts();
  }

  async clearCollection(collectionKey) {
    if (!isConfigured) return;
    const colId = COLLECTIONS[collectionKey];
    if (!colId) return;
    try {
      while (true) {
        const res = await databases.listDocuments(DATABASE_ID, colId, [Query.limit(100)]);
        if (res.documents.length === 0) break;
        // Delete one-by-one with retry — safer than parallel for rate limits
        for (const doc of res.documents) {
          await withRetry(() => databases.deleteDocument(DATABASE_ID, colId, doc.$id));
          await delay(150); // small pause between each delete
        }
      }
      console.log(`✅ Cleared collection: ${collectionKey}`);
    } catch (e) {
      console.error(`Failed to clear collection ${collectionKey}:`, e);
    }
  }

  // ── Setters ──
  async saveInspections(data) {
    if (!isConfigured) return;
    await this.clearCollection('inspections');
    // Write one-by-one with a small pause — avoids rate limits on large datasets
    for (const item of data) {
      await this._writeAppwrite('inspections', item.id, item);
      await delay(150);
    }
  }


  async saveGpsVehicles(data) {
    if (!isConfigured) return;
    for (const item of data) {
      await this._writeAppwrite('gpsVehicles', item.id, item);
    }
  }

  async saveDailyPlans(data) {
    if (!isConfigured) return;
    for (const item of data) {
      await this._writeAppwrite('dailyPlans', item.id, item);
    }
  }

  async saveRequests(data) {
    if (!isConfigured) return;
    for (const item of data) {
      await this._writeAppwrite('requests', item.id, item);
    }
  }

  async saveCustomAccounts(data) {
    if (!isConfigured) return;
    for (const item of data) {
      await this._writeAppwrite('accounts', item.id, item);
    }
  }

  async addCustomAccount(acc) {
    const id = `acc_${Date.now()}`;
    const newAcc = { id, company: acc.company, username: acc.username, password: acc.password, role: acc.role || 'company' };
    await this._writeAppwrite('accounts', id, newAcc);
    return newAcc;
  }

  async upsertAccountByUsername(acc) {
    const systemAccounts = await this.getSystemAccounts();
    const sysIdx = acc.id
      ? systemAccounts.findIndex(a => a.id === acc.id)
      : systemAccounts.findIndex(a => a.username.toLowerCase() === acc.username.toLowerCase());
    
    if (sysIdx >= 0) {
      const updated = {
        ...systemAccounts[sysIdx],
        company: acc.company || systemAccounts[sysIdx].company,
        username: acc.username || systemAccounts[sysIdx].username,
        password: acc.password || systemAccounts[sysIdx].password,
        role: acc.role || systemAccounts[sysIdx].role,
      };
      await this._writeAppwrite('accounts', updated.id, updated);
      return { ...updated, source: 'system' };
    }

    const custom = await this.getCustomAccounts();
    const customIdx = custom.findIndex(a => a.username.toLowerCase() === acc.username.toLowerCase());
    if (customIdx >= 0) {
      return this.updateCustomAccount(custom[customIdx].id, acc);
    }

    const gpsList = await this.getGpsVehicles();
    const gpsIdx = gpsList.findIndex(v => v.username?.toLowerCase() === acc.username.toLowerCase());
    if (gpsIdx >= 0) {
      return this.updateGpsVehicle(gpsList[gpsIdx].id, acc);
    }

    if (acc.role === 'admin' || acc.role === 'inspector') {
      const id = `sys_${Date.now()}`;
      const newAcc = { id, company: acc.company, username: acc.username, password: acc.password, role: acc.role };
      await this._writeAppwrite('accounts', id, newAcc);
      return { ...newAcc, source: 'system' };
    }

    return this.addCustomAccount(acc);
  }

  async deleteAccountBySource(acc) {
    if (acc.source === 'profile' && acc.userId) {
      await deleteAppUser({ userId: acc.userId, profileId: acc.id });
      return;
    }
    if (acc.source === 'gps' && acc.gpsVehicleId) {
      await this.deleteGpsVehicle(acc.gpsVehicleId);
      return;
    }
    if (acc.source === 'custom') {
      await this.deleteCustomAccount(acc.id);
    }
  }

  async updateCustomAccount(id, acc) {
    const custom = await this.getCustomAccounts();
    const existing = custom.find(a => a.id === id);
    if (!existing) return null;
    const updated = {
      ...existing,
      company: acc.company || existing.company,
      username: acc.username || existing.username,
      password: acc.password || existing.password,
      role: acc.role || existing.role || 'company',
      id
    };
    await this._writeAppwrite('accounts', id, updated);
    return updated;
  }

  async deleteCustomAccount(id) {
    if (isConfigured) {
      await databases.deleteDocument(DATABASE_ID, COLLECTIONS.accounts, id);
    }
  }

  reset() {
    // No-op for reset
  }

  async validateVehicle(carNo, companyName) {
    const inspections = await this.getInspections();
    const latest = getLatestInspectionForPlate(inspections, carNo);

    if (!latest) {
      throw new Error(`عذراً، هذه السيارة (${carNo}) غير مدرجة بسجلات الفحص.`);
    }

    if (latest.exitStatus === 'OUT') {
      await this.syncGpsVehicleStatus(carNo, 'Out');
      throw new Error(`السيارة خارج الخدمة بناءً على آخر فحص بتاريخ ${latest.inspectionDate}.`);
    }

    return latest;
  }

  async syncGpsVehicleStatus(carNo, status) {
    const gpsList = await this.getGpsVehicles();
    for (const v of gpsList) {
      if (platesMatch(v.carNo, carNo)) {
        const u = { ...v, comments: (status === 'Till now' || status === 'Running') ? 'Running' : 'Out' };
        await this._writeAppwrite('gpsVehicles', v.id, u);
      }
    }
  }

  async addInspection(ins) {
    const id = `insp_${Date.now()}`;
    const newIns = {
      id,
      no: String(ins.no || '').trim(),
      letters: String(ins.letters || '').trim(),
      company: String(ins.company || '').trim(),
      vehicleType: ins.vehicleType || '',
      vehicleModel: ins.vehicleModel || '',
      inspectionDate: ins.inspectionDate || new Date().toISOString().split('T')[0],
      status: ins.status || 'Accept',
      exitStatus: ins.exitStatus || 'Till now',
      operatorDriver: ins.operatorDriver || '',
      licenseExpiry: ins.licenseExpiry || '',
      regExpiry: ins.regExpiry || '',
      inspectedBy: ins.inspectedBy || '',
      remarks: ins.remarks || ''
    };
    await this._writeAppwrite('inspections', id, newIns);
    const all = await this.getInspections();
    const latest = getLatestInspectionForPlate(all, `${newIns.no} ${newIns.letters}`);
    await this.syncGpsVehicleStatus(
      `${newIns.no} ${newIns.letters}`,
      latest?.exitStatus === 'Till now' ? 'Running' : 'Out'
    );
    return newIns;
  }

  async updateInspectionStatus(id, exitStatus) {
    const list = await this.getInspections();
    const idx = list.findIndex(i => i.id === id);
    if (idx === -1) return;
    list[idx].exitStatus = exitStatus;
    await this._writeAppwrite('inspections', id, list[idx]);
    const ins = list[idx];
    const latest = getLatestInspectionForPlate(list, `${ins.no} ${ins.letters}`);
    if (latest) {
      await this.syncGpsVehicleStatus(
        `${ins.no} ${ins.letters}`,
        latest.exitStatus === 'Till now' ? 'Running' : 'Out'
      );
    }
  }

  async addGpsVehicle(veh) {
    const id = `gps_${Date.now()}`;
    const newVeh = { id, company: veh.company, username: veh.username || '', password: veh.password || '', imei: veh.imei || '', carType: veh.carType || '', carNo: veh.carNo, comments: veh.comments || 'Running' };
    await this._writeAppwrite('gpsVehicles', id, newVeh);
    return newVeh;
  }

  async updateGpsVehicle(id, veh) {
    const list = await this.getGpsVehicles();
    const idx = list.findIndex(v => v.id === id);
    if (idx === -1) return null;
    const updated = {
      ...list[idx],
      company: veh.company || list[idx].company,
      username: veh.username !== undefined ? veh.username : list[idx].username,
      password: veh.password !== undefined ? veh.password : list[idx].password,
      imei: veh.imei !== undefined ? veh.imei : list[idx].imei,
      carType: veh.carType || list[idx].carType,
      carNo: veh.carNo || list[idx].carNo,
      comments: veh.comments || list[idx].comments,
      id
    };
    await this._writeAppwrite('gpsVehicles', id, updated);
    return updated;
  }

  async deleteGpsVehicle(id) {
    if (!isConfigured) throw new Error('قاعدة البيانات غير متصلة');
    if (!id) throw new Error('معرّف العربية غير موجود');
    await withRetry(() => databases.deleteDocument(DATABASE_ID, COLLECTIONS.gpsVehicles, id));
  }

  async deleteGpsVehicleByPlate(carNo, company = null) {
    const gpsList = await this.getGpsVehicles();
    let deleted = 0;
    for (const v of gpsList) {
      if (!platesMatch(v.carNo, carNo)) continue;
      if (company && !companiesMatch(v.company, company)) continue;
      await this.deleteGpsVehicle(v.id);
      deleted++;
    }
    return deleted;
  }

  async deletePassengerFromPlan(planId, passengerName) {
    const plans = await this.getDailyPlans();
    const pIdx = plans.findIndex(p => p.id === planId);
    if (pIdx === -1) throw new Error('الرحلة غير موجودة');
    let plist = getPlanPassengers(plans[pIdx]);
    const before = plist.length;
    plist = plist.filter(name => name !== passengerName);
    if (plist.length === before) throw new Error('الراكب غير موجود في هذه الرحلة');
    plans[pIdx].passengers = JSON.stringify(plist);
    plans[pIdx].passengerQnt = plist.length;
    await this._writeAppwrite('dailyPlans', planId, plans[pIdx]);
    return plist.length;
  }

  async deleteDailyPlan(id) {
    if (!isConfigured) throw new Error('قاعدة البيانات غير متصلة');
    if (!id) throw new Error('معرّف الرحلة غير موجود');
    await withRetry(() => databases.deleteDocument(DATABASE_ID, COLLECTIONS.dailyPlans, id));
  }

  async deleteDailyPlansByPlate(carNo, company = null) {
    const plans = await this.getDailyPlans();
    let deleted = 0;
    for (const p of plans) {
      if (!platesMatch(p.plateNumber, carNo)) continue;
      if (company && !companiesMatch(p.company, company)) continue;
      await this.deleteDailyPlan(p.id);
      deleted++;
    }
    if (deleted === 0 && company) {
      for (const p of plans) {
        if (platesMatch(p.plateNumber, carNo)) {
          await this.deleteDailyPlan(p.id);
          deleted++;
        }
      }
    }
    return deleted;
  }

  async deleteRequest(id) {
    if (!isConfigured) throw new Error('قاعدة البيانات غير متصلة');
    if (!id) throw new Error('معرّف الطلب غير موجود');
    await withRetry(() => databases.deleteDocument(DATABASE_ID, COLLECTIONS.requests, id));
  }

  async repairPassengerCounts() {
    if (!isConfigured) return;
    const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.dailyPlans, [Query.limit(5000)]);
    for (const d of res.documents) {
      const list = getPlanPassengers(d);
      if ((d.passengerQnt || 0) !== list.length) {
        const payload = { ...d, id: d.$id, passengers: JSON.stringify(list), passengerQnt: list.length };
        delete payload.$id;
        delete payload.$createdAt;
        delete payload.$updatedAt;
        delete payload.$permissions;
        delete payload.$databaseId;
        delete payload.$collectionId;
        await this._writeAppwrite('dailyPlans', d.$id, payload);
      }
    }
  }

  async addRequestIfNotPending(req) {
    const list = await this.getRequests();
    const existing = list.find(r =>
      r.status === 'pending' &&
      r.request_type === req.request_type &&
      companiesMatch(r.company, req.company) &&
      platesMatch(r.car_no, req.car_no)
    );
    if (existing) return existing;
    return this.addRequest(req);
  }

  async addDailyPlan(plan) {
    const inspections = await this.getInspections();
    const hasInspection = inspections.some(ins => platesMatch(`${ins.no} ${ins.letters}`, plan.plateNumber));

    const gpsList = await this.getGpsVehicles();
    const alreadyInGps = gpsList.some(v => companiesMatch(v.company, plan.company) && platesMatch(v.carNo, plan.plateNumber));

    if (!alreadyInGps) {
      await this.addRequestIfNotPending({
        company: plan.company,
        request_type: 'add_vehicle',
        car_no: plan.plateNumber,
        car_type: plan.carType || 'Microbus',
        driver_phone: plan.driverPhone || '',
        gps_username: plan.gpsUsername || '',
        gps_password: plan.gpsPassword || ''
      });
    }

    const list = await this.getDailyPlans();
    const id = `plan_${Date.now()}`;
    const newPlan = {
      id,
      date: plan.date || new Date().toISOString().split('T')[0],
      company: plan.company,
      num: list.filter(p => p.company === plan.company).length + 1,
      carType: plan.carType || 'Microbus',
      plateNumber: plan.plateNumber,
      driverName: plan.driverName || '',
      driverPhone: plan.driverPhone || '',
      route: plan.route || '',
      passengerQnt: plan.passengerQnt || 0,
      passengers: plan.passengers || JSON.stringify([]),
      shift: plan.shift || 'day'
    };
    await this._writeAppwrite('dailyPlans', id, newPlan);
    return { ...newPlan, notInspected: !hasInspection };
  }

  async addRequest(req) {
    const id = `req_${Date.now()}`;
    const newReq = { 
      id, 
      company: req.company, 
      request_type: req.request_type, 
      car_no: req.car_no, 
      car_type: req.car_type || 'Microbus', 
      driver_phone: req.driver_phone || '',
      gps_username: req.gps_username || '',
      gps_password: req.gps_password || '',
      status: 'pending', 
      created_at: new Date().toISOString() 
    };
    await this._writeAppwrite('requests', id, newReq);
    return newReq;
  }

  async resolveRequest(id, status) {
    const list = await this.getRequests();
    const idx = list.findIndex(r => r.id === id || r.$id === id);
    if (idx === -1) throw new Error('الطلب غير موجود أو تمت معالجته مسبقاً');
    const req = list[idx];
    const requestId = req.id || id;

    if (status === 'approved') {
      if (req.request_type === 'add_vehicle') {
        await this.addGpsVehicle({ 
          company: req.company, 
          carNo: req.car_no, 
          carType: req.car_type, 
          username: req.gps_username || '',
          password: req.gps_password || '',
          comments: 'Running' 
        });
        req.status = 'approved';
        await this._writeAppwrite('requests', requestId, req);
        return;
      }
      if (req.request_type === 'delete_vehicle') {
        await this.deleteGpsVehicleByPlate(req.car_no, req.company);
        await this.deleteDailyPlansByPlate(req.car_no, req.company);
        await this.deleteRequest(requestId);
        return;
      }
      if (req.request_type === 'edit_vehicle') {
        const gpsList = await this.getGpsVehicles();
        const v = gpsList.find(x => platesMatch(x.carNo, req.car_no) && companiesMatch(x.company, req.company));
        if (v) {
          await this.updateGpsVehicle(v.id, {
            username: req.gps_username || '',
            password: req.gps_password || '',
            carType: req.car_type || ''
          });
        }
        req.status = 'approved';
        await this._writeAppwrite('requests', requestId, req);
        return;
      }
      if (req.request_type === 'delete_passenger') {
        const detail = JSON.parse(req.car_type);
        await this.deletePassengerFromPlan(detail.planId, detail.passengerName);
        await this.deleteRequest(requestId);
        return;
      }
    } else if (status === 'rejected') {
      if (req.request_type === 'add_vehicle') {
        await this.deleteGpsVehicleByPlate(req.car_no, req.company);
        await this.deleteDailyPlansByPlate(req.car_no, req.company);
      }
      await this.deleteRequest(requestId);
      return;
    }

    req.status = status;
    await this._writeAppwrite('requests', requestId, req);
  }
}

export const db = new DatabaseService();
export { isConfigured };
export { checkCloudAvailability, resetCloudCheck, isCloudReady } from './appwrite.js';
