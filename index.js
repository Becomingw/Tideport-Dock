import { createHostPlugin } from './lib/dsh-plugin.js'
import { createStorageTools as createTools } from './lib/storage-tools.js'
export const {name,inject,apply}=createHostPlugin(createTools)
export {normalizeConfig,SettingsStore} from './lib/dsh-plugin.js'
