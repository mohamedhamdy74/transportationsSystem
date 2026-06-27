import { Permission, Role } from 'appwrite';
import { env } from './env.js';

// Team roles - wrapped to handle case where env might not be available during permission creation
const adminTeam = () => Role.team(env.teams?.admins || 'admins');
const inspectorTeam = () => Role.team(env.teams?.inspectors || 'inspectors');

export const collectionPermissions = {
  userProfiles: {
    read: [Role.any()],
    create: [adminTeam()],
    update: [adminTeam()],
    delete: [adminTeam()],
  },
  inspections: {
    read: [Role.any()],
    create: [inspectorTeam(), adminTeam()],
    update: [inspectorTeam(), adminTeam()],
    delete: [adminTeam()],
  },
  gpsVehicles: {
    read: [Role.any()],
    create: [adminTeam()],
    update: [adminTeam()],
    delete: [adminTeam()],
  },
  dailyPlans: {
    read: [Role.any()],
    create: [Role.any()],
    update: [Role.any()],
    delete: [adminTeam(), Role.any()],
  },
  requests: {
    read: [Role.any()],
    create: [Role.any()],
    update: [adminTeam()],
    delete: [adminTeam()],
  },
  accounts: {
    read: [adminTeam()],
    create: [adminTeam()],
    update: [adminTeam()],
    delete: [adminTeam()],
  },
};

// Simplified permissions that use Role.any() - works with API key and sessions
export function userProfilePermissions(userId) {
  return [
    Permission.read(Role.any()),
    Permission.update(Role.any()),
  ];
}

export function dailyPlanDocumentPermissions(userId) {
  return [
    Permission.read(Role.any()),
    Permission.update(Role.any()),
    Permission.delete(Role.any()),
  ];
}

export function inspectionDocumentPermissions() {
  return [
    Permission.read(Role.any()),
    Permission.update(Role.any()),
    Permission.delete(Role.any()),
  ];
}
