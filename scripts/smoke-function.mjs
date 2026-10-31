import { Client, Functions } from 'node-appwrite';

const c = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);
const fn = new Functions(c);

const start = await fn.createExecution({
  functionId: 'warrant-control',
  body: JSON.stringify({ action: 'startRace', label: 'split-smoke', revokeAfterSec: 2 }),
  async: false,
});
console.log('start', start.responseStatusCode, start.responseBody);
const data = JSON.parse(start.responseBody);

const run = await fn.createExecution({
  functionId: 'warrant-control',
  body: JSON.stringify({
    action: 'runRace',
    warrantId: data.warrantId,
    revokeAfterSec: 2,
  }),
  async: true,
});
console.log('run', run.status, run.$id);
