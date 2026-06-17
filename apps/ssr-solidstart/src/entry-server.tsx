import { renderToStream } from 'solid-js/web'
import App from './app'

export default function render() {
  return renderToStream(() => <App />)
}
