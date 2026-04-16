

## Plan: Move Sidebar Collapse Button to Top + Auto-Collapse

### What changes

**File: `src/components/AppSidebar.tsx`**

1. **Move the collapse/expand arrow from the bottom to the top** — place it inside the logo/header area (line ~125-135), right-aligned. Remove the bottom button (lines ~210-217).

2. **Auto-collapse sidebar on navigation** — add a `useEffect` watching `location.pathname`: when the user navigates to any route (clicks a module), automatically set `collapsed = true`. This gives maximum screen space for content. The user can expand again by clicking the top arrow.

3. **Visual**: When collapsed, the arrow shows `ChevronRight` in the header area next to the "AG" logo. When expanded, shows `ChevronLeft` at the same position.

### No other modules affected
Only `AppSidebar.tsx` is modified. No changes to Dashboard, Financeiro, or any other page.

