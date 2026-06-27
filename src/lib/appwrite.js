import { Client, Account, Databases } from 'appwrite';
import { env, isAppwriteConfigured } from './env.js';

export const ENDPOINT = env.appwriteEndpoint;
export const PROJECT_NAME = env.appwriteProjectName;
export const DATABASE_ID = env.databaseId || null;
export const COLLECTIONS = env.collections;

const isConfigured = isAppwriteConfigured();

const client = new Client();
if (ENDPOINT) client.setEndpoint(ENDPOINT);
if (env.appwriteProjectId) client.setProject(env.appwriteProjectId);

const account = new Account(client);
const databases = new Databases(client);

let cloudAvailable = null;
let cloudCheckInProgress = false;
let databaseExists = null;

export async function pingAppwrite() {
  if (!isConfigured) return false;
  try {
    await client.ping();
    if (import.meta.env.DEV) {
      console.log('Appwrite server ping successful');
    }
    return true;
  } catch (e) {
    if (import.meta.env.DEV) {
      console.error('Appwrite ping failed:', e.message);
    }
    return false;
  }
}

export async function checkCloudAvailability() {
  if (isConfigured && cloudAvailable !== null && databaseExists !== null) {
    return cloudAvailable && databaseExists;
  }
  if (!isConfigured) {
    cloudAvailable = false;
    databaseExists = false;
    return false;
  }
  if (cloudCheckInProgress) return false;

  cloudCheckInProgress = true;
  try {
    await client.ping();
    if (DATABASE_ID && COLLECTIONS.inspections) {
      await databases.listDocuments(DATABASE_ID, COLLECTIONS.inspections, []);
      databaseExists = true;
    } else {
      databaseExists = false;
    }
    cloudAvailable = true;
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('Appwrite cloud unavailable:', e.message);
    }
    cloudAvailable = false;
    databaseExists = false;
  } finally {
    cloudCheckInProgress = false;
  }
  return cloudAvailable && databaseExists;
}

export function resetCloudCheck() {
  cloudAvailable = null;
  databaseExists = null;
}

export function isCloudReady() {
  return isConfigured && cloudAvailable === true;
}

export { client, account, databases, isConfigured };
