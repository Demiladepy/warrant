function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}. Copy .env.example to .env and fill it in.`);
  return v;
}

export const ENDPOINT = process.env.APPWRITE_ENDPOINT ?? 'https://cloud.appwrite.io/v1';
export const PROJECT_ID = required('APPWRITE_PROJECT_ID');
export const API_KEY = required('APPWRITE_API_KEY');

export const DB_ID = 'warrant';
export const TABLES = { warrants: 'warrants', actions: 'actions', vendors: 'vendors' };

// Two long-lived demo users. The agent is its own Appwrite user, so the warrant
// row's $permissions can name it — that naming is the whole leash.
export const AGENT_USER_ID = 'agent_02';
export const GRANTOR_USER_ID = 'grantor_01';

export const LANES = { warrant: 'warrant', credential: 'credential' };
export const OUTCOMES = { pending: 'pending', committed: 'committed', rejected: 'rejected' };
