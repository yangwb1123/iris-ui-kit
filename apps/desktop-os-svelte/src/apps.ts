/**
 * App registry. Svelte components can't be a render() function cleanly (as in the
 * React demo), so each app maps its `appId` → a Svelte `Component` plus the same
 * metadata the React version carries: { id, name, icon, defaultSize, component }.
 */
import type { Component } from 'svelte'
import About from './appviews/About.svelte'
import Notepad from './appviews/Notepad.svelte'
import Files from './appviews/Files.svelte'
import Showcase from './appviews/Showcase.svelte'

export interface AppDef {
  id: string
  name: string
  /** Emoji glyph used as the icon (keeps the demo dependency-free). */
  icon: string
  defaultSize?: { width: number; height: number }
  /** The Svelte component rendered inside the window body. */
  component: Component
}

export const APPS: AppDef[] = [
  {
    id: 'about',
    name: 'About',
    icon: 'ℹ️',
    defaultSize: { width: 460, height: 360 },
    component: About,
  },
  {
    id: 'files',
    name: 'Files',
    icon: '📁',
    defaultSize: { width: 520, height: 400 },
    component: Files,
  },
  {
    id: 'notepad',
    name: 'Notepad',
    icon: '📝',
    defaultSize: { width: 480, height: 360 },
    component: Notepad,
  },
  {
    id: 'showcase',
    name: 'Iris Showcase',
    icon: '🎛️',
    defaultSize: { width: 460, height: 380 },
    component: Showcase,
  },
]

export const getApp = (appId: string): AppDef | undefined => APPS.find((a) => a.id === appId)
