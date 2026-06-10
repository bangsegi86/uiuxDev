import type { Knex } from 'knex'

/**
 * Initial schema. Nested objects (canvas, root tree, component/template
 * definitions) are stored as JSON text so the same migration runs on both
 * PostgreSQL and Oracle.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('projects', (t) => {
    t.string('id', 64).primary()
    t.string('name', 200).notNullable()
    t.string('createdAt', 40).notNullable()
    t.string('updatedAt', 40).notNullable()
  })

  await knex.schema.createTable('tree_nodes', (t) => {
    t.string('id', 64).primary()
    t.string('projectId', 64).notNullable().index()
    t.string('parentId', 64).nullable()
    t.string('type', 16).notNullable()
    t.string('name', 200).notNullable()
    t.integer('order').notNullable().defaultTo(0)
    t.string('screenId', 64).nullable()
  })

  await knex.schema.createTable('screens', (t) => {
    t.string('id', 64).primary()
    t.string('projectId', 64).notNullable().index()
    t.string('name', 200).notNullable()
    t.string('device', 16).notNullable()
    t.text('canvas').notNullable()
    t.text('root').notNullable()
    t.text('notes').nullable()
    t.string('createdAt', 40).notNullable()
    t.string('updatedAt', 40).notNullable()
  })

  await knex.schema.createTable('boards', (t) => {
    t.string('id', 64).primary()
    t.string('projectId', 64).notNullable().index()
    t.string('name', 200).notNullable()
    t.text('items').notNullable()
    t.text('connectors').nullable()
    t.text('notes').nullable()
    t.string('createdAt', 40).notNullable()
    t.string('updatedAt', 40).notNullable()
  })

  await knex.schema.createTable('custom_components', (t) => {
    t.string('id', 64).primary()
    t.string('projectId', 64).notNullable().index()
    t.string('name', 200).notNullable()
    t.text('thumbnail').nullable()
    t.text('definition').notNullable()
    t.string('createdAt', 40).notNullable()
    t.string('updatedAt', 40).notNullable()
  })

  await knex.schema.createTable('templates', (t) => {
    t.string('id', 64).primary()
    t.string('projectId', 64).notNullable().index()
    t.string('name', 200).notNullable()
    t.text('thumbnail').nullable()
    t.string('device', 16).notNullable()
    t.text('definition').notNullable()
    t.string('createdAt', 40).notNullable()
    t.string('updatedAt', 40).notNullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('templates')
  await knex.schema.dropTableIfExists('custom_components')
  await knex.schema.dropTableIfExists('boards')
  await knex.schema.dropTableIfExists('screens')
  await knex.schema.dropTableIfExists('tree_nodes')
  await knex.schema.dropTableIfExists('projects')
}
