import type { Knex } from 'knex'

/** Adds user accounts and project ownership. */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (t) => {
    t.string('id', 64).primary()
    t.string('email', 200).notNullable().unique()
    t.string('passwordHash', 400).notNullable()
    t.string('createdAt', 40).notNullable()
  })

  const hasOwner = await knex.schema.hasColumn('projects', 'ownerId')
  if (!hasOwner) {
    await knex.schema.alterTable('projects', (t) => {
      t.string('ownerId', 64).nullable().index()
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('projects', (t) => {
    t.dropColumn('ownerId')
  })
  await knex.schema.dropTableIfExists('users')
}
