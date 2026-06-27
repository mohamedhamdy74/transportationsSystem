import {
  addUserToRoleTeam,
  createServerClient,
  toAuthEmail,
  upsertProfile,
  verifyAdminSession,
} from '../_lib/appwrite-server.js';
import { ID } from 'node-appwrite';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user, server } = await verifyAdminSession(req);
    const { username, password, role, company, name } = req.body || {};
    if (!username || !password || !role) {
      return res.status(400).json({ error: 'username, password, and role are required' });
    }

    const email = toAuthEmail(username, server.authDomain);
    const created = await server.users.create(
      ID.unique(),
      email,
      undefined,
      password,
      name || username
    );

    await upsertProfile(server.databases, server.databaseId, server.profilesCollection, {
      userId: created.$id,
      username: String(username).trim(),
      email,
      role,
      company: company || '',
      name: name || String(username).trim(),
    });

    await addUserToRoleTeam(
      server.teams,
      server.teamAdmins,
      server.teamInspectors,
      created.$id,
      role
    );

    return res.status(200).json({
      ok: true,
      userId: created.$id,
      email,
      username: String(username).trim(),
      role,
      company: company || '',
    });
  } catch (error) {
    return res.status(error.message === 'Forbidden' ? 403 : 400).json({
      error: error.message || 'Failed to create user',
    });
  }
}
