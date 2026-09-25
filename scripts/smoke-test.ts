async function runSmoke() {
const baseUrl = (process.env.SMOKE_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

type Check = { name: string; ok: boolean; detail: string };
const checks: Check[] = [];

async function request(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${baseUrl}${path}`, { redirect: 'manual', ...init });
}

async function check(name: string, run: () => Promise<{ ok: boolean; detail: string }>): Promise<void> {
  try {
    checks.push({ name, ...(await run()) });
  } catch (error) {
    checks.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error) });
  }
}

await check('homepage', async () => {
  const response = await request('/');
  return { ok: response.status === 200, detail: `HTTP ${response.status}` };
});
await check('security headers', async () => {
  const response = await request('/');
  const csp = response.headers.get('content-security-policy');
  const frame = response.headers.get('x-frame-options');
  return { ok: Boolean(csp && frame === 'DENY'), detail: `CSP=${Boolean(csp)} frame=${frame}` };
});
await check('auth identity endpoint', async () => {
  const response = await request('/api/v1/auth/me');
  const body = (await response.json()) as { success?: boolean; data?: { authenticated?: boolean } };
  return { ok: response.status === 200 && body.success === true && body.data?.authenticated === false, detail: `HTTP ${response.status}` };
});
await check('health endpoint', async () => {
  const response = await request('/api/v1/health');
  const body = (await response.json()) as { data?: { status?: string; database?: string } };
  return { ok: response.status === 200 && body.data?.status === 'ok' && body.data?.database === 'up', detail: `HTTP ${response.status}` };
});
await check('protected API rejects anonymous access', async () => {
  const response = await request('/api/v1/documents/not-a-real-id');
  return { ok: response.status === 401, detail: `HTTP ${response.status}` };
});
await check('login validation is server-side', async () => {
  const response = await request('/api/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl }, body: '{}' });
  const body = (await response.json()) as { error?: { code?: string } };
  return { ok: response.status === 422 && body.error?.code === 'VALIDATION_ERROR', detail: `HTTP ${response.status} code=${body.error?.code ?? 'none'}` };
});
await check('cross-origin mutation is rejected', async () => {
  const response = await request('/api/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example' }, body: '{}' });
  return { ok: response.status === 403, detail: `HTTP ${response.status}` };
});

for (const result of checks) console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.name}: ${result.detail}`);
const failed = checks.filter((result) => !result.ok);
console.log(`Smoke result: ${checks.length - failed.length}/${checks.length} checks passed`);
if (failed.length) process.exitCode = 1;

}

runSmoke().catch((error) => {
  console.error('Smoke test failed:', error);
  process.exitCode = 1;
});