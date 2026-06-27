import { Client, Account, Databases, ID, Permission, Role, Teams, Users, Query } from 'node-appwrite';

export function createServerClient() {
  const endpoint = process.env.APPWRITE_ENDPOINT || process.env.VITE_APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;
  if (!endpoint || !projectId || !apiKey) {
    throw new Error('Missing Appwrite server env: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY');
  }
  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  return {
    client,
    users: new Users(client),
    teams: new Teams(client),
    databases: new Databases(client),
    databaseId: process.env.APPWRITE_DATABASE_ID || process.env.VITE_APPWRITE_DATABASE_ID,
    profilesCollection: process.env.APPWRITE_COLLECTION_USER_PROFILES || process.env.VITE_APPWRITE_COLLECTION_USER_PROFILES,
    teamAdmins: process.env.APPWRITE_TEAM_ADMINS || process.env.VITE_APPWRITE_TEAM_ADMINS || 'admins',
    teamInspectors: process.env.APPWRITE_TEAM_INSPECTORS || process.env.VITE_APPWRITE_TEAM_INSPECTORS || 'inspectors',
    authDomain: process.env.VITE_AUTH_EMAIL_DOMAIN || 'transport.local',
  };
}

export async function verifyAdminSession(req) {
  const sessionId = req.headers['x-appwrite-session'];
  if (!sessionId) throw new Error('Unauthorized');

  const { client, databases, databaseId, profilesCollection } = createServerClient();
  const sessionClient = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || process.env.VITE_APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID)
    .setSession(String(sessionId));

  const account = new Account(sessionClient);
  const user = await account.get();
  const profiles = await databases.listDocuments(databaseId, profilesCollection, [
    Query.equal('userId', user.$id),
    Query.limit(1),
  ]);
  const profile = profiles.documents[0];
  if (!profile || profile.role !== 'admin') {
    throw new Error('Forbidden');
  }
  return { user, profile, server: createServerClient() };
}

export function toAuthEmail(username, domain) {
  const value = String(username || '').trim().toLowerCase();
  if (!value) return '';
  if (value.includes('@')) return value;
  const safe = value.replace(/[^a-z0-9._-]/gi, '');
  return `${safe}@${domain}`;
}

export async function addUserToRoleTeam(teams, teamAdmins, teamInspectors, userId, role) {
  if (role === 'admin') {
    await teams.createMembership(teamAdmins, ['member'], undefined, userId);
  } else if (role === 'inspector') {
    await teams.createMembership(teamInspectors, ['member'], undefined, userId);
  }
}

export async function upsertProfile(databases, databaseId, profilesCollection, payload) {
  const existing = await databases.listDocuments(databaseId, profilesCollection, [
    Query.equal('userId', payload.userId),
    Query.limit(1),
  ]);
  if (existing.documents.length) {
    const doc = existing.documents[0];
    return databases.updateDocument(databaseId, profilesCollection, doc.$id, payload);
  }
  return databases.createDocument(
    databaseId,
    profilesCollection,
    ID.unique(),
    payload,
    [
      Permission.read(Role.user(payload.userId)),
      Permission.update(Role.user(payload.userId)),
      Permission.read(Role.team(process.env.APPWRITE_TEAM_ADMINS || 'admins')),
      Permission.update(Role.team(process.env.APPWRITE_TEAM_ADMINS || 'admins')),
      Permission.delete(Role.team(process.env.APPWRITE_TEAM_ADMINS || 'admins')),
    ]
  );
}
