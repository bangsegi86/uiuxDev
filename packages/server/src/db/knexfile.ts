import { knexConfigFor, type DbDriver } from './knexConfig.js'

/** Entry point for the Knex CLI (`knex migrate:latest`). */
const driver = (process.env.STORAGE_DRIVER as DbDriver) || 'postgres'
export default knexConfigFor(driver === 'oracle' ? 'oracle' : 'postgres')
