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

const target = databaseTarget();
if (target && !(await isReachable(target))) {
  // Deliberately a warning rather than a hard failure: the unit suites do not
  // need a database, only tests/integration/* do.
  console.warn(
    `\n[tests] Test database is NOT reachable at ${target.host}:${target.port}.\n` +
      '[tests] Integration suites will fail until it is running. Start it with:\n' +
      '[tests]   powershell -ExecutionPolicy Bypass -File scripts/dev-db.ps1 -Action start\n',
  );
}

