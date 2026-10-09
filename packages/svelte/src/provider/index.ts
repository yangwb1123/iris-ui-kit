export { default as IrisProvider } from './IrisProvider.svelte'
export { usePlugin, usePluginStore } from './hooks'
export type { IrisProviderProps, PluginStoreContextValue } from './context'
export {
  COMPONENT_SIZE_KEY,
  DEFAULT_COMPONENT_SIZE,
  getComponentSize,
  resolveComponentSize,
  type ComponentSizeContextValue,
  type IrisComponentSize,
} from './componentSize'
