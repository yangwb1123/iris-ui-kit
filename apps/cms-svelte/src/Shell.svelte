<script lang="ts">
  import {
    IrisAdminLayout,
    IrisAvatar,
    IrisButton,
    IrisDropdown,
    IrisDropdownTrigger,
    IrisDropdownMenu,
    IrisDropdownItem,
    IrisIcon,
    IrisToastViewport,
    useSkin,
    useTabsNav,
  } from '@iris-ui/svelte'
  import { filterNavByAccess } from '@iris-ui/core'
  import { menus } from './menus'
  import { tabsNav } from './tabs'
  import { useAuth } from './auth'
  import PageHost from './PageHost.svelte'

  const { skin, setSkin, setMode, getActiveId, availableSkins } = useSkin()
  const t = useTabsNav(tabsNav)
  const { tabs, cacheKeys } = t
  const { session, logout } = useAuth()

  // RBAC: filter nav tree by the current user's role.
  const role = $derived($session?.role)
  const visibleMenus = $derived(role ? filterNavByAccess(menus, [role]) : menus)

  let activeKey = $state('dashboard')

  // Skin switcher: 'auto' follows the system, anything else pins a fixed skin.
  function selectSkin(id: string): void {
    if (id === 'auto') setMode('system')
    else setMode('fixed')
    setSkin(id)
  }
  const isDark = $derived($skin.type === 'dark')
  function toggleDark(): void {
    setMode('fixed')
    setSkin(isDark ? 'light' : 'dark')
  }

  const skins = availableSkins()
  // Re-read the active id whenever the skin changes (getActiveId is a plain fn).
  const activeId = $derived.by(() => {
    void $skin
    return getActiveId()
  })

  function cacheKeyFor(key: string): string {
    return $cacheKeys.find((k) => k.slice(0, k.lastIndexOf(':')) === key) ?? key
  }
</script>

<IrisAdminLayout
  menus={visibleMenus}
  {activeKey}
  onActiveKeyChange={(k) => (activeKey = k)}
  tabs={tabsNav}
  appTitle="Iris CMS"
>
  {#snippet toolbar()}
    <select
      class="skin-select"
      aria-label="Theme"
      onchange={(e) => selectSkin(e.currentTarget.value)}
    >
      {#each skins as s (s.id)}
        <option value={s.id} selected={s.id === activeId}>{s.name ?? s.id}</option>
      {/each}
    </select>

    <IrisButton
      size="sm"
      variant="outline"
      aria-label={isDark ? 'Light mode' : 'Dark mode'}
      onclick={toggleDark}
    >
      <IrisIcon name={isDark ? 'sun' : 'moon'} size={16} />
    </IrisButton>

    <IrisDropdown>
      <IrisDropdownTrigger
        aria-label="Account"
        style="border: none; background: transparent; cursor: pointer; padding: 0"
      >
        <IrisAvatar name={$session?.username ?? 'User'} size={32} />
      </IrisDropdownTrigger>
      <IrisDropdownMenu>
        <IrisDropdownItem>Profile</IrisDropdownItem>
        <IrisDropdownItem>Account settings</IrisDropdownItem>
        <IrisDropdownItem onclick={logout}>Sign out</IrisDropdownItem>
      </IrisDropdownMenu>
    </IrisDropdown>
  {/snippet}

  {#snippet footer()}
    <div class="cms-footer">
      <span>Iris CMS — built with @iris-ui/svelte</span>
      <span>v0.1.x</span>
    </div>
  {/snippet}

  {#snippet children(s)}
    <!-- Keep-alive: render one page per open tab; only the active one shown
         (inactive stay mounted so their local state survives switching). The
         {#key} re-creates a page when its cacheKey changes, so the tab "Refresh"
         action remounts it. -->
    {#each $tabs as tab (tab.key)}
      <div style="display: {tab.key === s.activeKey ? 'block' : 'none'}">
        {#key cacheKeyFor(tab.key)}
          <PageHost routeKey={tab.key} />
        {/key}
      </div>
    {/each}
  {/snippet}
</IrisAdminLayout>

<!-- Global toast queue: one viewport for the whole app (UsersPage CRUD pushes here). -->
<IrisToastViewport position="bottom-right" />
