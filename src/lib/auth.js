import { Query } from 'appwrite';
import { account, databases, DATABASE_ID, isConfigured } from './appwrite.js';
import { toAuthEmail, toDisplayUsername } from './authEmail.js';
import { env } from './env.js';

export { toAuthEmail, toDisplayUsername } from './authEmail.js';

export async function getActiveSessionUser() {
  return account.get();
}

export async function fetchUserProfile(userId) {
  if (!isConfigured || !env.collections.userProfiles) return null;
  try {
    const res = await databases.listDocuments(
      DATABASE_ID,
      env.collections.userProfiles,
      [Query.equal('userId', userId), Query.limit(1)]
    );
    if (!res.documents.length) return null;
    const doc = res.documents[0];
    return {
      id: doc.$id,
      userId: doc.userId,
      username: doc.username,
      email: doc.email,
      role: doc.role,
      company: doc.company || '',
      name: doc.name || doc.username,
    };
  } catch (e) {
    console.error('fetchUserProfile failed:', e);
    return null;
  }
}

export async function loginWithAppwrite(username, password) {
  const email = toAuthEmail(username);
  if (!email) throw new Error('اسم المستخدم غير صالح.');
  
  // Clear any existing session before creating a new one
  try {
    await account.deleteSession('current');
  } catch {
    // No existing session - that's fine
  }
  
  await account.createEmailPasswordSession(email, password);
  const appwriteUser = await account.get();
  const profile = await fetchUserProfile(appwriteUser.$id);
  if (!profile) {
    await account.deleteSession('current');
    throw new Error('الحساب غير مفعّل. تواصل مع الإدارة.');
  }
  return {
    userId: appwriteUser.$id,
    username: profile.username,
    email: profile.email || appwriteUser.email,
    role: profile.role,
    company: profile.company,
    name: profile.name,
  };
}

export async function restoreSessionUser() {
  try {
    const appwriteUser = await account.get();
    try {
      const profile = await fetchUserProfile(appwriteUser.$id);
      if (!profile) {
        // User exists but no profile - clear invalid session
        await account.deleteSession('current').catch(() => {});
        return null;
      }
      return {
        userId: appwriteUser.$id,
        username: profile.username,
        email: profile.email || appwriteUser.email,
        role: profile.role,
        company: profile.company,
        name: profile.name,
      };
    } catch (profileErr) {
      // Profile fetch failed (likely permissions) - clear the invalid session
      console.warn('Profile fetch failed during restore, clearing session:', profileErr.message);
      await account.deleteSession('current').catch(() => {});
      return null;
    }
  } catch {
    return null;
  }
}

export async function logoutFromAppwrite() {
  try {
    await account.deleteSession('current');
  } catch {
    // session already cleared
  }
}

export async function listUserProfiles() {
  if (!isConfigured || !env.collections.userProfiles) return [];
  const res = await databases.listDocuments(
    DATABASE_ID,
    env.collections.userProfiles,
    [Query.limit(500)]
  );
  return res.documents.map(d => ({
    id: d.$id,
    userId: d.userId,
    username: d.username,
    email: d.email,
    role: d.role,
    company: d.company || '',
    name: d.name || d.username,
    source: 'profile',
  }));
}
