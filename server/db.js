// Single shared PrismaClient instance.
// Reusing one client avoids exhausting the database connection pool during
// development hot-reloads.

import { PrismaClient } from '@prisma/client';
import config from './config.js';

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__nicPrisma ??
  new PrismaClient({
    log: config.isProd ? ['warn', 'error'] : ['warn', 'error'],
  });

if (!config.isProd) globalForPrisma.__nicPrisma = prisma;

/// Verifies the database is reachable. Called on boot so a misconfigured
/// connection string fails loudly at startup rather than on first request.
export async function assertDatabaseConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('\n\x1b[31m✖ Could not reach the database.\x1b[0m');
    console.error('  DATABASE_URL =', config.databaseUrl.replace(/:\/\/[^@]*@/, '://***@'));
    console.error(' ', error.message.split('\n')[0], '\n');
    return false;
  }
}

export default prisma;
