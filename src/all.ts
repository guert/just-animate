import { addPlugin } from './lib/core/plugins'
import { waapiPlugin } from './web'

export * from './main'
export * from './props'
export * from './extras'

addPlugin(waapiPlugin)
