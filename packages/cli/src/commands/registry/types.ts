import type {
  IrisFramework,
  IrisInstallPlan,
  IrisRegistryItem,
  IrisLockFile,
} from '@iris-ui-kit/registry'

export interface InitOptions {
  cwd?: string
  framework: IrisFramework
  force?: boolean
}

export interface RegistryAddOptions {
  cwd?: string
}

export interface InstallOptions {
  cwd?: string
  registry?: string
  force?: boolean
  dryRun?: boolean
  update?: boolean
}

export interface LoadedItem {
  item: IrisRegistryItem
  location: string
  registry: string
}

export interface PreparedPlan {
  loaded: LoadedItem
  plan: IrisInstallPlan
}

export interface PlanExecution {
  prepared: PreparedPlan
  diffs: ReturnType<typeof import('@iris-ui-kit/registry').diffRegistryFiles>
}

export type ProjectLockItems = IrisLockFile['items']
