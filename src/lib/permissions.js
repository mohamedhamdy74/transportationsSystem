import { Permission, Role } from 'appwrite';
import { env } from './env.js';

const adminTeam = () => Role.team(env.teams.admins);
const inspectorTeam = () => Role.team(env.teams.inspectors);

export const collectionPermissions = {
  userProfiles: {
    read: [Role.users()],
    create: [adminTeam()],
    update: [adminTeam()],
    delete: [adminTeam()],
  },
  inspections: {
    read: [Role.users()],
    create: [inspectorTeam(), adminTeam()],
    update: [inspectorTeam(), adminTeam()],
    delete: [adminTeam()],
  },
  gpsVehicles: {
    read: [Role.users()],
    create: [adminTeam()],
    update: [adminTeam()],
    delete: [adminTeam()],
  },
  dailyPlans: {
    read: [Role.users()],
    create: [Role.users()],
    update: [Role.users()],
    delete: [adminTeam(), Role.users()],
  },
  requests: {
    read: [Role.users()],
    create: [Role.users()],
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

export function userProfilePermissions(userId) {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.read(adminTeam()),
    Permission.update(adminTeam()),
    Permission.delete(adminTeam()),
  ];
}

export function dailyPlanDocumentPermissions(userId) {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
    Permission.read(adminTeam()),
    Permission.update(adminTeam()),
    Permission.delete(adminTeam()),
  ];
}

export function inspectionDocumentPermissions() {
  return [
    Permission.read(Role.users()),
    Permission.update(inspectorTeam()),
    Permission.update(adminTeam()),
    Permission.delete(adminTeam()),
  ];
}
