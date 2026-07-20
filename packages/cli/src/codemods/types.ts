/**
 * A codemod is a pure source-text transform: given the current contents of a
 * file (and its path, for context-sensitive transforms), return the new
 * contents. `run` only writes the file back if `transform` actually changed
 * something.
 *
 * Deliberately NOT AST-based — see packages/cli/README.md for why. Transforms
 * should be scoped, idempotent (running twice = no further change on the
 * second pass), and match the shape of this project's actual breaking
 * changes (renames, small object-literal reshapes), not full refactors.
 */
export interface Codemod {
  name: string
  description: string
  transform: (source: string, filePath: string) => string
}
