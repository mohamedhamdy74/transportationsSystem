import {
  addUserToRoleTeam,
  toAuthEmail,
  upsertProfile,
  verifyAdminSession,
} from '../_lib/appwrite-server.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { server } = await verifyAdminSession(req);
    const { userId, username, password, role, company, name } = req.body || {};
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    const email = username ? toAuthEmail(username, server.authDomain) : undefined;

    if (password) {
      await server.users.updatePassword(userId, password);
    }
    if (email) {
      await server.users.updateEmail(userId, email);
    }
    if (name) {
      await server.users.updateName(userId, name);
    }

    const profilePayload = {
      userId,
      username: String(username || '').trim(),
      email: email || undefined,
      role: role || 'company',
      company: company || '',
      name: name || String(username || '').trim(),
    };

    await upsertProfile(server.databases, server.databaseId, server.profilesCollection, profilePayload);

    if (role) {
      try {
        await addUserToRoleTeam(
          server.teams,
          server.teamAdmins,
          server.teamInspectors,
          userId,
          role
        );
      } catch {
        // membership may already exist
      }
    }

    return res.status(200).json({ ok: true, userId });
  } catch (error) {
    return res.status(error.message === 'Forbidden' ? 403 : 400).json({
      error: error.message || 'Failed to update user',
    });
  }
}
