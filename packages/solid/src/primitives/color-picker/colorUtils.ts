// Color math now lives in @iris-ui-kit/core (single source across all four
// frameworks). Re-exported so existing `./colorUtils` imports keep working.
export {
  clamp01,
  hsvToRgb,
  rgbToHsv,
  rgbToHex,
  hexToRgba,
  rgbaToHsva,
  hsvaToRgba,
  type IrisHsva,
  type IrisRgba,
} from '@iris-ui-kit/core'
