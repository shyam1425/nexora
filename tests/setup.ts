import 'dotenv/config';
import { connect } from 'node:net';

/**
 * Test database preflight.
 *
 * The integration suite needs the MySQL instance described by DATABASE_URL.
 * When it is not reachable (the usual cause is the local development database
 * not being started), Prisma fails with an opaque pool timeout and the real
 * cause is easy to miss. Report it once, clearly, before the suites run.
 */
function databaseTarget(): { host: string; port: number } | null {
  const raw = process.env.DATABASE_URL;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return { host: url.hostname, port: Number(url.port || 3306) };
  } catch {
    return null;
  }
}

function isReachable(target: { host: string; port: number }): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host: target.host, port: target.port });
    const finish = (value: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(3000);
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(false));
  });
}

/**
 * Mirrors the application's plain, untrusted-TLS local connection so a
 * credential-exchange problem is reported before the suites run. Returns the
 * driver's message on failure, or null when authentication succeeds.
 */
async function probeAuthentication(raw: string): Promise<string | null> {
  const { createConnection } = await import('mariadb');
  const url = new URL(raw);
  let connection: Awaited<ReturnType<typeof createConnection>> | undefined;
  try {
    connection = await createConnection({
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.replace(/^\//, '')),
      allowPublicKeyRetrieval: url.searchParams.get('allowPublicKeyRetrieval') === 'true',
      connectTimeout: 4000,
    });
    await connection.query('SELECT 1');
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  } finally {
    if (connection) await connection.end().catch(() => undefined);
  }
}

const target = databaseTarget();
if (target && !(await isReachable(target))) {
  // Deliberately a warning rather than a hard failure: the unit suites do not
  // need a database, only tests/integration/* do.
  console.warn(
    `\n[tests] Test database is NOT reachable at ${target.host}:${target.port}.\n` +
      '[tests] Integration suites will fail until it is running. Start it with:\n' +
      '[tests]   powershell -ExecutionPolicy Bypass -File scripts/dev-db.ps1 -Action start\n',
  );
} else if (target && process.env.DATABASE_URL) {
  const url = process.env.DATABASE_URL;
  // A provider reached over TLS negotiates the credential exchange for us; only
  // a plain local connection needs the extra parameter.
  const usesTls = /[?&]ssl=true/.test(url);
  if (!usesTls) {
    const failure = await probeAuthentication(url);
    if (failure) {
      console.warn(
        `\n[tests] The test database at ${target.host}:${target.port} refused a plain connection:\n` +
          `[tests]   ${failure}\n` +
          '[tests] A local MySQL 8 app user authenticates with caching_sha2_password, which cannot\n' +
          '[tests] complete without TLS or an RSA key exchange — Prisma reports this as an opaque\n' +
          '[tests] "pool timeout". Append the parameter to DATABASE_URL in .env:\n' +
          '[tests]   ?allowPublicKeyRetrieval=true\n' +
          '[tests] (managed providers reached with ?ssl=true do not need it)\n',
      );
    }
  }
}


