/**
 * dsh-osslab host plugin: the lab's S3 storage as native DSH tools plus the
 * panel routes behind the bucket browser and the visual settings page.
 *
 * The management workspace supports personal inventory, local drafts and shared request workflows.
 * Cluster administration is not connected; settings.role grants no rights.
 */
import { normalizeConfig } from './config.js'
import { registerRoutes } from './routes.js'
import { SettingsStore } from './settings.js'

export function createHostPlugin(createTools) {
 return { name: 'osslab', inject: ['tools'], apply(ctx, rawConfig) {
  const store = new SettingsStore(rawConfig ?? {})
  const config = store.current

  for (const tool of createTools(config)) ctx.tools.register(tool)

  // Backstop: even if a tool's own guard is bypassed, an execute call cannot
  // run while the profile config has writes/deletes turned off.
  ctx.tools.guard((exec) => {
    const args = exec.arguments ?? {}
    if (!args.execute) return undefined
    if (exec.name === 'osslab_delete' && !config.allowDeletes) {
      return 'osslab: deletes are disabled by config.allowDeletes'
    }
    if ((exec.name === 'osslab_put' || exec.name === 'osslab_put_new') && !config.allowWrites) {
      return 'osslab: writes are disabled by config.allowWrites'
    }
    return undefined
  })

  const mount = scope => registerRoutes(scope, { store })
  if (typeof ctx.inject === 'function') ctx.inject(['connection'], mount)
  else if (ctx.get('connection')) mount(ctx)
 } }
}

export { normalizeConfig, SettingsStore }
