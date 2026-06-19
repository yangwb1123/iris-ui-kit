import { useOs } from '../shell'
import { Taskbar } from './Taskbar'
import { Dock } from './Dock'
import { Panel } from './Panel'
import { MenuBar } from './MenuBar'
import { StartMenu } from './StartMenu'
import { Spotlight } from './Spotlight'
import { Kickoff } from './Kickoff'

/** Optional global top bar (macOS menu bar; null elsewhere). */
export function TopBar() {
  const { chrome } = useOs()
  return chrome.topBar === 'menubar' ? <MenuBar /> : null
}

/** The bottom bar — taskbar (Win), dock (mac) or panel (KDE), per skin. */
export function BottomBar({
  launcherOpen,
  onToggleLauncher,
}: {
  launcherOpen: boolean
  onToggleLauncher: () => void
}) {
  const { chrome } = useOs()
  switch (chrome.bottomBar) {
    case 'dock':
      return <Dock onToggleLauncher={onToggleLauncher} />
    case 'panel':
      return <Panel onToggleLauncher={onToggleLauncher} />
    default:
      return <Taskbar launcherOpen={launcherOpen} onToggleLauncher={onToggleLauncher} />
  }
}

/** The app launcher — Start menu (Win), Spotlight (mac) or Kickoff (KDE), per skin. */
export function Launcher({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { chrome } = useOs()
  switch (chrome.launcher) {
    case 'spotlight':
      return <Spotlight open={open} onClose={onClose} />
    case 'kickoff':
      return <Kickoff open={open} onClose={onClose} />
    default:
      return <StartMenu open={open} onClose={onClose} />
  }
}
