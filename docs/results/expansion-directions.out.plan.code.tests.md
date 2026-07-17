I see the meta-roleplay — I'm supposed to act as the **Code Implementer** asking for design documents before starting implementation. But you've given me the **QA Lead** role prompt and checklist.

Let me clarify: **which role do you want me to act in, and which subsystem should I review?**

**If QA Lead**: please tell me which subsystem you want me to review (e.g., selection model, form engine, admin shell, skin system, a specific adapter like React/Vue/Solid/Svelte, or the entire project).

**If Code Implementer**: please provide the `.arch.md` and `.impl-plan.md` (or describe what you want built).

From the project context, iris-ui has many subsystems I could review:

| Subsystem               | Key files                               |
| ----------------------- | --------------------------------------- |
| **Selection Model**     | core → `createSelectionModel`           |
| **Expansion**           | core → `createExpansion`                |
| **Data View**           | core → data-view (filter/sort/paginate) |
| **Form Engine**         | core → form                             |
| **Pagination**          | core → async/pagination                 |
| **Admin Shell**         | core → admin-shell + `createAdminShell` |
| **Resource Controller** | core → resource                         |
| **Skin / Theme**        | tokens/theme/skins                      |
| **I18n**                | core → i18n                             |
| **Plugin System**       | core → `createPlugin`/`runPlugins`      |
| **Roving Tabindex**     | core → roving                           |
| **Floating Machine**    | core → floating machine                 |
| **Virtual Scroller**    | core → virtual                          |
| **Toasts**              | core → toasts                           |
| **React Adapter**       | packages/react                          |
| **Vue Adapter**         | packages/vue                            |
| **Solid Adapter**       | packages/solid                          |
| **Svelte Adapter**      | packages/svelte                         |

Which one should I QA review?
