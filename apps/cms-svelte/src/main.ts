import { mount } from 'svelte'
import App from './App.svelte'
import { registerDesktopBridges } from './desktopBridge'
import './style.css'

registerDesktopBridges()

const app = mount(App, { target: document.getElementById('root')! })

export default app
