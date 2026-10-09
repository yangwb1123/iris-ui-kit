/* global module */
'use strict'
// Both vendor loaders use the same implementation; no parallel crypto policy.
const bridge = import('./index.mjs')
module.exports = {
  generateCACert: (options) => bridge.then((api) => api.generateCACert(options)),
  generateTLSCert: (options) => bridge.then((api) => api.generateTLSCert(options)),
  resolvePfx: (options) => bridge.then((api) => api.resolvePfx(options)),
}
