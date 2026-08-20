const { execSync } = require('node:child_process');
const net = require('node:net');

/** Host ports Zoqo binds. Container-internal ports stay at vendor defaults. */
const PORTS = [
  { key: 'WEB_PORT', default: 3000, service: 'Next.js web', profiles: ['apps'] },
  { key: 'API_PORT', default: 3001, service: 'NestJS API', profiles: ['apps'] },
  { key: 'POSTGRES_PORT', default: 5432, service: 'Postgres', profiles: ['default', 'minimal', 'test'] },
  { key: 'VALKEY_PORT', default: 6379, service: 'Valkey', profiles: ['default', 'minimal', 'test'] },
  { key: 'RABBITMQ_PORT', default: 5672, service: 'RabbitMQ AMQP', profiles: ['default', 'minimal', 'test'] },
  { key: 'RABBITMQ_MGMT_PORT', default: 15672, service: 'RabbitMQ management', profiles: ['default', 'minimal', 'test'] },
  { key: 'MINIO_PORT', default: 9000, service: 'MinIO S3', profiles: ['default', 'minimal', 'test'] },
  { key: 'MINIO_CONSOLE_PORT', default: 9001, service: 'MinIO console', profiles: ['default', 'minimal', 'test'] },
  { key: 'SMTP_PORT', default: 1025, service: 'Mailpit SMTP', profiles: ['default', 'minimal', 'test'] },
  { key: 'MAILPIT_UI_PORT', default: 8025, service: 'Mailpit UI', profiles: ['default', 'minimal', 'test'] },
  { key: 'TRAEFIK_HTTP_PORT', default: 80, service: 'Traefik HTTP', profiles: ['default', 'minimal'] },
  { key: 'TRAEFIK_DASHBOARD_PORT', default: 8080, service: 'Traefik dashboard', profiles: ['default', 'minimal'] },
  { key: 'LIVEKIT_PORT', default: 7880, service: 'LiveKit', profiles: ['media'] },
  { key: 'TURN_PORT', default: 3478, service: 'coturn', profiles: ['media'] },
  { key: 'LIBRETRANSLATE_PORT', default: 5000, service: 'LibreTranslate', profiles: ['translation'] },
  { key: 'PROMETHEUS_PORT', default: 9090, service: 'Prometheus', profiles: ['obs'] },
  { key: 'GRAFANA_PORT', default: 3100, service: 'Grafana', profiles: ['obs'] },
  { key: 'LOKI_PORT', default: 3101, service: 'Loki', profiles: ['obs'] },
  { key: 'GLITCHTIP_PORT', default: 8000, service: 'GlitchTip', profiles: ['obs'] },
  { key: 'UPTIME_KUMA_PORT', default: 3003, service: 'Uptime Kuma', profiles: ['obs'] },
];

function resolvePort(env, key, fallback) {
  const raw = env[key];
  const n = Number(raw ?? fallback);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function isPortFree(port, host = '0.0.0.0') {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

function occupant(port) {
  try {
    if (process.platform === 'win32') {
      const pid = execSync(
        `powershell -NoProfile -Command "(Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess"`,
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      ).trim();
      if (!pid || pid === '0') return null;
      const name = execSync(
        `powershell -NoProfile -Command "(Get-Process -Id ${pid} -ErrorAction SilentlyContinue).ProcessName"`,
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      ).trim();
      return { pid, name: name || 'unknown' };
    }
    const out = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t 2>/dev/null | head -n 1`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    if (!out) return null;
    let name = 'unknown';
    try {
      name = execSync(`ps -p ${out} -o comm=`, { encoding: 'utf8' }).trim();
    } catch {
      /* ignore */
    }
    return { pid: out, name };
  } catch {
    return null;
  }
}

async function suggestPort(start) {
  const guesses = [start + 10000, start + 1, start + 2, start + 3, start + 10, start + 100];
  for (const port of guesses) {
    if (port > 65535) continue;
    if (await isPortFree(port)) return port;
  }
  for (let port = start + 20; port < start + 200; port += 1) {
    if (await isPortFree(port)) return port;
  }
  return null;
}

function portsForProfiles(profiles) {
  const wanted = new Set(profiles);
  return PORTS.filter((p) => p.profiles.some((pr) => wanted.has(pr)));
}

module.exports = {
  PORTS,
  resolvePort,
  isPortFree,
  occupant,
  suggestPort,
  portsForProfiles,
};
