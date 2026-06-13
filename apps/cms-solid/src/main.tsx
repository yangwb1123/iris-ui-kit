/* @refresh reload */
import { render } from 'solid-js/web'
import { App } from './App'
import { registerDesktopBridges } from './desktopBridge'
import './style.css'

registerDesktopBridges()

render(() => <App />, document.getElementById('root')!)
