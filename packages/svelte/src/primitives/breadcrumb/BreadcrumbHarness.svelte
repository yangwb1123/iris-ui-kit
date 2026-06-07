<script lang="ts">
  // Test fixture: a breadcrumb trail with link crumbs + a current crumb.
  import IrisBreadcrumb from './Breadcrumb.svelte'
  import IrisBreadcrumbItem from './BreadcrumbItem.svelte'
</script>

<IrisBreadcrumb>
  <IrisBreadcrumbItem href="/">Home</IrisBreadcrumbItem>
  <IrisBreadcrumbItem href="/docs">Docs</IrisBreadcrumbItem>
  <IrisBreadcrumbItem current>Page</IrisBreadcrumbItem>
</IrisBreadcrumb>
