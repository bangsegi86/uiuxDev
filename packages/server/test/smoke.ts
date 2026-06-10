/**
 * End-to-end smoke test exercising the full storage + REST flow against an
 * in-process Fastify instance. Runs with the configured STORAGE_DRIVER
 * (default `local`), so it doubles as adapter-parity verification for SQL.
 */
import assert from 'node:assert'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { mkdtempSync } from 'node:fs'
import Fastify from 'fastify'
import { registerRoutes } from '../src/routes/index.js'
import { createStorage } from '../src/storage/index.js'

async function run() {
  if (!process.env.STORAGE_DRIVER || process.env.STORAGE_DRIVER === 'local') {
    process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'uiux-smoke-'))
  }

  const app = Fastify()
  const storage = await createStorage()
  await registerRoutes(app, storage)

  const call = async (method: string, url: string, body?: unknown) => {
    const res = await app.inject({ method: method as 'GET', url, payload: body as object })
    return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null }
  }

  // health
  const health = await call('GET', '/api/health')
  assert.equal(health.status, 200)
  assert.equal(health.body.ok, true)
  console.log(`✓ health (storage=${health.body.storage})`)

  // create project
  const proj = await call('POST', '/api/projects', { name: 'Demo Project' })
  assert.equal(proj.status, 201)
  const projectId = proj.body.id
  console.log('✓ create project')

  // create a folder
  const folder = await call('POST', `/api/projects/${projectId}/tree`, {
    type: 'folder',
    name: 'Screens'
  })
  assert.equal(folder.status, 201)
  console.log('✓ create folder')

  // create a screen file inside the folder
  const screenNode = await call('POST', `/api/projects/${projectId}/tree`, {
    type: 'screen',
    name: 'Login',
    parentId: folder.body.id,
    device: 'mobile'
  })
  assert.equal(screenNode.status, 201)
  const screenId = screenNode.body.screenId
  assert.ok(screenId, 'screen node should carry a screenId')
  console.log('✓ create screen file')

  // load the screen design
  const screen = await call('GET', `/api/projects/${projectId}/screens/${screenId}`)
  assert.equal(screen.status, 200)
  assert.equal(screen.body.device, 'mobile')
  console.log('✓ load screen')

  // save a design (add a button to the root)
  const root = screen.body.root
  root.children.push({
    id: 'btn1',
    type: 'button',
    props: { text: 'Sign in' },
    style: {},
    layout: { x: 40, y: 100, w: 120, h: 40 },
    children: []
  })
  const saved = await call('PUT', `/api/projects/${projectId}/screens/${screenId}`, {
    root,
    notes: 'Login screen for mobile'
  })
  assert.equal(saved.status, 200)
  assert.equal(saved.body.root.children.length, 1)
  assert.equal(saved.body.notes, 'Login screen for mobile')
  console.log('✓ save screen design + notes')

  // save a custom component
  const comp = await call('POST', `/api/projects/${projectId}/components`, {
    name: 'Primary Button',
    definition: root.children[0]
  })
  assert.equal(comp.status, 201)
  const comps = await call('GET', `/api/projects/${projectId}/components`)
  assert.equal(comps.body.length, 1)
  console.log('✓ save + list custom component')

  // save a template (whole screen design)
  const tmpl = await call('POST', `/api/projects/${projectId}/templates`, {
    name: 'Login Layout',
    device: 'mobile',
    definition: root
  })
  assert.equal(tmpl.status, 201)
  const tmpls = await call('GET', `/api/projects/${projectId}/templates`)
  assert.equal(tmpls.body.length, 1)
  console.log('✓ save + list template')

  // reload project with tree
  const reload = await call('GET', `/api/projects/${projectId}`)
  assert.equal(reload.status, 200)
  assert.equal(reload.body.tree.length, 2)
  console.log('✓ reload project tree')

  // delete folder cascades to its screen child
  const del = await call('DELETE', `/api/projects/${projectId}/tree/${folder.body.id}`)
  assert.equal(del.status, 204)
  const afterDel = await call('GET', `/api/projects/${projectId}/tree`)
  assert.equal(afterDel.body.length, 0)
  const goneScreen = await call('GET', `/api/projects/${projectId}/screens/${screenId}`)
  assert.equal(goneScreen.status, 404)
  console.log('✓ delete folder cascades to screen')

  await app.close()
  console.log('\nAll smoke checks passed.')
}

run().catch((err) => {
  console.error('\nSmoke test failed:', err)
  process.exit(1)
})
