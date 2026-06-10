import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Knex } from 'knex'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export type DbDriver = 'postgres' | 'oracle'

/**
 * Build a Knex config for the chosen SQL engine from environment variables.
 * Connection vars are documented in `.env.example`.
 */
export function knexConfigFor(driver: DbDriver): Knex.Config {
  const migrations: Knex.MigratorConfig = {
    directory: path.join(__dirname, 'migrations'),
    loadExtensions: ['.ts', '.js']
  }

  if (driver === 'postgres') {
    return {
      client: 'pg',
      connection: {
        host: process.env.PG_HOST ?? 'localhost',
        port: Number(process.env.PG_PORT ?? 5432),
        user: process.env.PG_USER ?? 'postgres',
        password: process.env.PG_PASSWORD ?? 'postgres',
        database: process.env.PG_DATABASE ?? 'uiux'
      },
      pool: { min: 0, max: 10 },
      migrations
    }
  }

  // oracle
  return {
    client: 'oracledb',
    connection: {
      user: process.env.ORACLE_USER ?? 'system',
      password: process.env.ORACLE_PASSWORD ?? 'oracle',
      connectString:
        process.env.ORACLE_CONNECT_STRING ??
        `${process.env.ORACLE_HOST ?? 'localhost'}:${process.env.ORACLE_PORT ?? 1521}/${
          process.env.ORACLE_SERVICE ?? 'XEPDB1'
        }`
    },
    pool: { min: 0, max: 10 },
    migrations
  }
}
