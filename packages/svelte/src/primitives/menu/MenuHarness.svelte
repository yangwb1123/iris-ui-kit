<script lang="ts">
  import { createThemeStore } from '@iris-ui-kit/theme'
  import { darkTheme, lightTheme } from '@iris-ui-kit/tokens'
  import type { Direction } from '@iris-ui-kit/theme'
  import ThemeProvider from '../../theme/ThemeProvider.svelte'
  import IrisMenu from './IrisMenu.svelte'
  import IrisMenuTrigger from './IrisMenuTrigger.svelte'
  import IrisMenuContent from './IrisMenuContent.svelte'
  import IrisMenuItem from './IrisMenuItem.svelte'
  import IrisMenuSeparator from './IrisMenuSeparator.svelte'
  import IrisMenuSub from './IrisMenuSub.svelte'

  interface Props {
    onSelect?: (event: MouseEvent) => void
    onDeepSelect?: () => void
    closeOnSelect?: boolean
    withSub?: boolean
    withNestedSub?: boolean
    dir?: Direction
  }

  let {
    onSelect,
    onDeepSelect,
    closeOnSelect = true,
    withSub = false,
    withNestedSub = false,
    dir = 'ltr',
  }: Props = $props()

  const themeStore = createThemeStore({
    themes: { light: lightTheme, dark: darkTheme },
    default: 'light',
  })
</script>

<ThemeProvider store={themeStore} {dir}>
  <IrisMenu>
    <IrisMenuTrigger>Menu</IrisMenuTrigger>
    <IrisMenuContent>
      <IrisMenuItem {closeOnSelect} onclick={onSelect}>Item 1</IrisMenuItem>
      <IrisMenuSeparator />
      <IrisMenuItem>Item 2</IrisMenuItem>
      {#if withSub}
        <IrisMenuSub label="More">
          <IrisMenuItem>Sub 1</IrisMenuItem>
          <IrisMenuItem>Sub 2</IrisMenuItem>
          {#if withNestedSub}
            <IrisMenuSub label="Even more">
              <IrisMenuItem onclick={onDeepSelect}>Deep 1</IrisMenuItem>
            </IrisMenuSub>
          {/if}
        </IrisMenuSub>
      {/if}
    </IrisMenuContent>
  </IrisMenu>
</ThemeProvider>
