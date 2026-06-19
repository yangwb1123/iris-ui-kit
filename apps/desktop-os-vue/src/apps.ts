/**
 * App registry. Vue can't return a render-fn from data as ergonomically as
 * React's `render: () => <App/>`, so each app names a `component` (the body Vue
 * renders inside its managed window). `markRaw` keeps the component objects out
 * of Vue's reactivity — they're constants, not reactive state.
 */
import { markRaw, type Component } from 'vue'
import About from './appviews/About.vue'
import Notepad from './appviews/Notepad.vue'
import Files from './appviews/Files.vue'
import Showcase from './appviews/Showcase.vue'
import TaskManager from './appviews/TaskManager.vue'

export interface AppDef {
  id: string
  name: string
  /** Emoji glyph used as the icon (keeps the demo dependency-free). */
  icon: string
  defaultSize?: { width: number; height: number }
  component: Component
}

export const APPS: AppDef[] = [
  {
    id: 'about',
    name: 'About',
    icon: 'ℹ️',
    defaultSize: { width: 480, height: 380 },
    component: markRaw(About),
  },
  {
    id: 'files',
    name: 'Files',
    icon: '📁',
    defaultSize: { width: 520, height: 400 },
    component: markRaw(Files),
  },
  {
    id: 'notepad',
    name: 'Notepad',
    icon: '📝',
    defaultSize: { width: 480, height: 360 },
    component: markRaw(Notepad),
  },
  {
    id: 'showcase',
    name: 'Iris Showcase',
    icon: '🎛️',
    defaultSize: { width: 460, height: 400 },
    component: markRaw(Showcase),
  },
  {
    id: 'taskmgr',
    name: 'Task Manager',
    icon: '📈',
    defaultSize: { width: 420, height: 340 },
    component: markRaw(TaskManager),
  },
]

export const getApp = (appId: string): AppDef | undefined => APPS.find((a) => a.id === appId)
