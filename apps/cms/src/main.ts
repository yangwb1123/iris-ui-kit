import { createApp } from 'vue'
import App from './App.vue'
import { registerDesktopBridges } from './desktopBridge'
import './style.css'

registerDesktopBridges()

createApp(App).mount('#app')
