const read = (key) => {
  const envObj = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
  const value = envObj[key];
  return typeof value === 'string' ? value.trim() : '';
};

export const env = {
  appwriteEndpoint: read('VITE_APPWRITE_ENDPOINT'),
  appwriteProjectId: read('VITE_APPWRITE_PROJECT_ID'),
  appwriteProjectName: read('VITE_APPWRITE_PROJECT_NAME') || 'Transportations System',
  databaseId: read('VITE_APPWRITE_DATABASE_ID'),
  collections: {
    inspections: read('VITE_APPWRITE_COLLECTION_INSPECTIONS'),
    gpsVehicles: read('VITE_APPWRITE_COLLECTION_GPS_VEHICLES'),
    dailyPlans: read('VITE_APPWRITE_COLLECTION_DAILY_PLANS'),
    requests: read('VITE_APPWRITE_COLLECTION_REQUESTS'),
    accounts: read('VITE_APPWRITE_COLLECTION_ACCOUNTS'),
    userProfiles: read('VITE_APPWRITE_COLLECTION_USER_PROFILES'),
  },
  teams: {
    admins: read('VITE_APPWRITE_TEAM_ADMINS') || 'admins',
    inspectors: read('VITE_APPWRITE_TEAM_INSPECTORS') || 'inspectors',
  },
  authEmailDomain: read('VITE_AUTH_EMAIL_DOMAIN') || 'transport.local',
  enableDemoLogin: read('VITE_ENABLE_DEMO_LOGIN') === 'true',
  showPasswordsInUi: read('VITE_SHOW_PASSWORDS_IN_UI') === 'true',
  sessionMaxHours: Number(read('VITE_SESSION_MAX_HOURS') || '8') || 8,
  paginationPageSize: Number(read('VITE_PAGINATION_PAGE_SIZE') || '50') || 50,
  isDev: typeof import.meta !== 'undefined' ? !!import.meta.env?.DEV : false,
  isProd: typeof import.meta !== 'undefined' ? !!import.meta.env?.PROD : false,
};

export function isAppwriteConfigured() {
  return !!(
    env.appwriteEndpoint &&
    env.appwriteProjectId &&
    env.databaseId &&
    env.collections.inspections
  );
}

export function getMissingEnvKeys() {
  const required = [
    ['VITE_APPWRITE_ENDPOINT', env.appwriteEndpoint],
    ['VITE_APPWRITE_PROJECT_ID', env.appwriteProjectId],
    ['VITE_APPWRITE_DATABASE_ID', env.databaseId],
    ['VITE_APPWRITE_COLLECTION_INSPECTIONS', env.collections.inspections],
    ['VITE_APPWRITE_COLLECTION_GPS_VEHICLES', env.collections.gpsVehicles],
    ['VITE_APPWRITE_COLLECTION_DAILY_PLANS', env.collections.dailyPlans],
    ['VITE_APPWRITE_COLLECTION_REQUESTS', env.collections.requests],
    ['VITE_APPWRITE_COLLECTION_ACCOUNTS', env.collections.accounts],
    ['VITE_APPWRITE_COLLECTION_USER_PROFILES', env.collections.userProfiles],
  ];
  return required.filter(([, value]) => !value).map(([key]) => key);
}
