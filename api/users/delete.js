import { verifyAdminSession } from '../_lib/appwrite-server.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { server } = await verifyAdminSession(req);
    const { userId, profileId } = req.body || {};
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    await server.users.delete(userId);
    if (profileId) {
      try {
        await server.databases.deleteDocument(
          server.databaseId,
          server.profilesCollection,
          profileId
        );
      } catch {
        // profile may already be removed
      }
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(error.message === 'Forbidden' ? 403 : 400).json({
      error: error.message || 'Failed to delete user',
    });
  }
}
