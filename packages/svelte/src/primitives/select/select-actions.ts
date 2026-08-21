export type SelectElementAction = (node: HTMLElement) => { destroy: () => void }

export function createSelectElementAction(
  assign: (node: HTMLElement | undefined) => void,
): SelectElementAction {
  return (node) => {
    assign(node)
    return { destroy: () => assign(undefined) }
  }
}
