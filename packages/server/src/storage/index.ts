import path from 'node:path'
import knexLib from 'knex'
import { knexConfigFor } from '../db/knexConfig.js'
import { KnexAdapter } from './KnexAdapter.js'
import { LocalFileAdapter } from './LocalFileAdapter.js'
import type { StorageAdapter } from './StorageAdapter.js'

export type { StorageAdapter }

/**
 * Select and initialise the storage adapter from the STORAGE_DRIVER env var:
 *   - `local` (default): JSON files under DATA_DIR (./data)
 *   - `postgres` / `oracle`: SQL via Knex
 */
export async function createStorage(): Promise<StorageAdapter> {
  const driver = (process.env.STORAGE_DRIVER ?? 'local').toLowerCase()

  if (driver === 'postgres' || driver === 'oracle') {
    const db = knexLib(knexConfigFor(driver))
    const adapter = new KnexAdapter(db, driver)
    await adapter.init()
    return adapter
  }

  const dataDir = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.resolve(process.cwd(), 'data')
  const adapter = new LocalFileAdapter(dataDir)
  await adapter.init()
  return adapter
}
