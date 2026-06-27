/**
 * One-time setup: teams, collection permissions, migrate legacy accounts to Appwrite Auth.
 *
 * Usage:
 *   APPWRITE_API_KEY=xxx node scripts/setup-auth.mjs
 *
 * Requires .env with Appwrite IDs (loaded via dotenv if available).
 */
import { Client, Teams, Databases, Users, ID, Permission, Role, Query } from 'node-appwrite';
import { readFileSync, existsSync } from 'fs';
import { pathToFileURL } from 'url';

function loadEnvFile() {
  if (!existsSync('.env')) return;
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile();

const endpoint = process.env.APPWRITE_ENDPOINT || process.env.VITE_APPWRITE_ENDPOINT;
const projectId = process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.APPWRITE_DATABASE_ID || process.env.VITE_APPWRITE_DATABASE_ID;
const authDomain = process.env.VITE_AUTH_EMAIL_DOMAIN || 'transport.local';
const teamAdmins = process.env.APPWRITE_TEAM_ADMINS || process.env.VITE_APPWRITE_TEAM_ADMINS || 'admins';
const teamInspectors = process.env.APPWRITE_TEAM_INSPECTORS || process.env.VITE_APPWRITE_TEAM_INSPECTORS || 'inspectors';

const collections = {
  userProfiles: process.env.APPWRITE_COLLECTION_USER_PROFILES || process.env.VITE_APPWRITE_COLLECTION_USER_PROFILES || 'user_profiles',
  inspections: process.env.VITE_APPWRITE_COLLECTION_INSPECTIONS,
  gpsVehicles: process.env.VITE_APPWRITE_COLLECTION_GPS_VEHICLES,
  dailyPlans: process.env.VITE_APPWRITE_COLLECTION_DAILY_PLANS,
  requests: process.env.VITE_APPWRITE_COLLECTION_REQUESTS,
  accounts: process.env.VITE_APPWRITE_COLLECTION_ACCOUNTS,
};

if (!endpoint || !projectId || !apiKey || !databaseId) {
  console.error('Missing APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY, APPWRITE_DATABASE_ID');
  process.exit(1);
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const teams = new Teams(client);
const databases = new Databases(client);
const users = new Users(client);

function toAuthEmail(username) {
  const value = String(username || '').trim().toLowerCase();
  if (!value) return '';
  if (value.includes('@')) return value;
  return `${value.replace(/[^a-z0-9._-]/gi, '')}@${authDomain}`;
}

async function ensureTeam(teamId, name) {
  try {
    await teams.get(teamId);
    console.log(`Team exists: ${teamId}`);
  } catch {
    await teams.create(teamId, name);
    console.log(`Created team: ${teamId}`);
  }
}

async function setCollectionPermissions(collectionId, perms) {
  if (!collectionId) return;
  await databases.updateCollection(databaseId, collectionId, collectionId, perms);
  console.log(`Updated permissions: ${collectionId}`);
}

async function migrateLegacyAccounts() {
  if (!collections.accounts || !collections.userProfiles) return;

  const res = await databases.listDocuments(
    databaseId,
    collections.accounts,
    [Query.limit(500)]
  );

  for (const doc of res.documents) {
    if (!doc.username || !doc.password) continue;

    const email = toAuthEmail(doc.username);

    const existingUsers = await users.list([
      Query.equal('email', [email])
    ]);

    let userId = existingUsers.users[0]?.$id;

    if (!userId) {
      const password =
        String(doc.password || '').length >= 8
          ? String(doc.password)
          : String(doc.password) + '12345678';

      const created = await users.create(
        ID.unique(),
        email,
        undefined,
        password,
        doc.username
      );

      userId = created.$id;

      console.log(`Created auth user: ${doc.username}`);
      console.log(`User ID: ${userId}`);
    }

    const profiles = await databases.listDocuments(
      databaseId,
      collections.userProfiles,
      [
        Query.equal('userId', [userId]),
        Query.limit(1),
      ]
    );

    if (!profiles.documents.length) {
      await databases.createDocument(
        databaseId,
        collections.userProfiles,
        ID.unique(),
        {
          userId,
          username: doc.username,
          email,
          role: doc.role || 'company',
          company: doc.company || '',
          name: doc.username,
        },
        [
          Permission.read(Role.user(userId)),
          Permission.update(Role.user(userId)),
          Permission.read(Role.team(teamAdmins)),
          Permission.update(Role.team(teamAdmins)),
          Permission.delete(Role.team(teamAdmins)),
        ]
      );

      console.log(`Created profile: ${doc.username}`);
    }
  }
}
  

async function main() {
  await ensureTeam(teamAdmins, 'Administrators');
  await ensureTeam(teamInspectors, 'Inspectors');

  const usersRole = Role.users();
  const adminTeam = Role.team(teamAdmins);
  const inspectorTeam = Role.team(teamInspectors);

  // await setCollectionPermissions(collections.userProfiles, {
  //   documentSecurity: true,
  //   permissions: [
  //     Permission.read(usersRole),
  //     Permission.create(adminTeam),
  //     Permission.update(adminTeam),
  //     Permission.delete(adminTeam),
  //   ],
  // });

  // await setCollectionPermissions(collections.inspections, {
  //   documentSecurity: true,
  //   permissions: [
  //     Permission.read(usersRole),
  //     Permission.create(inspectorTeam),
  //     Permission.create(adminTeam),
  //     Permission.update(inspectorTeam),
  //     Permission.update(adminTeam),
  //     Permission.delete(adminTeam),
  //   ],
  // });

  // await setCollectionPermissions(collections.gpsVehicles, {
  //   documentSecurity: false,
  //   permissions: [
  //     Permission.read(usersRole),
  //     Permission.create(adminTeam),
  //     Permission.update(adminTeam),
  //     Permission.delete(adminTeam),
  //   ],
  // });

  // await setCollectionPermissions(collections.dailyPlans, {
  //   documentSecurity: true,
  //   permissions: [
  //     Permission.read(usersRole),
  //     Permission.create(usersRole),
  //     Permission.update(usersRole),
  //     Permission.delete(adminTeam),
  //     Permission.delete(usersRole),
  //   ],
  // });

  // await setCollectionPermissions(collections.requests, {
  //   documentSecurity: false,
  //   permissions: [
  //     Permission.read(usersRole),
  //     Permission.create(usersRole),
  //     Permission.update(adminTeam),
  //     Permission.delete(adminTeam),
  //   ],
  // });

  // await setCollectionPermissions(collections.accounts, {
  //   documentSecurity: false,
  //   permissions: [
  //     Permission.read(adminTeam),
  //     Permission.create(adminTeam),
  //     Permission.update(adminTeam),
  //     Permission.delete(adminTeam),
  //   ],
  // });

  await migrateLegacyAccounts();
  console.log('Setup complete.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
