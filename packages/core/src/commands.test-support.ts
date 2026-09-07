import { createCommandRegistry, type Command } from './commands'

export const cmd = (
  id: string,
  title: string,
  run = () => {},
  extra: Partial<Command> = {},
): Command => ({
  id,
  title,
  run,
  ...extra,
})

export const createPlannerRegistry = () => {
  const registry = createCommandRegistry()
  registry.registerMany([
    cmd('app:settings', 'Open Settings', () => {}, { group: 'Apps' }),
    cmd('win:close', 'Close Window', () => {}, { group: 'Window' }),
    cmd('sys:macos', 'Switch to macOS', () => {}, { group: 'System' }),
  ])
  return registry
}
