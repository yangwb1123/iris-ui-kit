import { lightTheme, darkTheme, type IrisTheme } from '@iris-ui-kit/tokens'
import type { Skin } from './types'

function themeToSkin(id: string, theme: IrisTheme): Skin {
  return {
    id,
    name: theme.name,
    type: theme.type,
    tokens: { ...theme.colors, ...theme.spacing, ...theme.radii },
    ...(theme.icons !== undefined ? { icons: theme.icons } : {}),
    ...(theme.iconOverrides !== undefined ? { iconOverrides: theme.iconOverrides } : {}),
  }
}

/** Built-in base skins. Ids are the stable `'light'` / `'dark'` (theme names differ). */
export const lightSkin: Skin = themeToSkin('light', lightTheme)
export const darkSkin: Skin = themeToSkin('dark', darkTheme)
export const builtinSkins: Skin[] = [lightSkin, darkSkin]
