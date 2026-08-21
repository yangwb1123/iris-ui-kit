/**
 * Public form engine barrel. The stateful store, type contracts, validation,
 * step navigation, value operations, and dirty guard each have a focused
 * implementation module while existing `./form` imports remain stable.
 */
export * from './form/types'
export { createFormStore } from './form/store'
export { createDirtyGuard } from './form/dirty-guard'
export { createValidationEngine, type ValidationEngine } from './form/validation'
export { createStepNavigation, type StepNavigation } from './form/steps'
export {
  createFieldValueOps,
  type FieldValueOps,
  insertItem,
  removeItem,
  swapItems,
  moveItem,
  insertRemap,
  removeRemap,
  swapRemap,
  moveRemap,
  rekeyMetadata,
} from './form/values'
