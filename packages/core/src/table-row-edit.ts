/**
 * Public barrel for the framework-free multi-cell row-edit model.
 *
 * The implementation is split into focused, dependency-free modules while
 * this entry point preserves the existing package API.
 */
export { createTableRowEditModel } from './table-row-edit-model'
export type {
  TableRowEditActive,
  TableRowEditCommit,
  TableRowEditKey,
  TableRowEditModel,
  TableRowEditOptions,
  TableRowEditSession,
  TableRowEditState,
  TableRowEditValidation,
} from './table-row-edit-types'
