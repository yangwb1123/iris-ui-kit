# @iris-ui-kit/registry

## 0.1.1

### Patch Changes

- Publish a coherent public graph after the shared layout/size/Toast and bounded SVG
  security fixes. Rebuild every public package and resolve production workspace
  dependencies to matching concrete versions. Advance otherwise unchanged package
  versions when their packaged dependency manifests or generated public contracts
  change; never replace an immutable existing artifact. Keep the native dev TLS
  certificate helper private. The explicitly authorized core/icons size rebaseline
  retains finite 72/12KiB entry-gzip limits and the existing single-icon hard gate.
