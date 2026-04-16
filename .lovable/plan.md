

## Plan: Expand sidebar on click anywhere in collapsed strip

### Problem
When the sidebar is collapsed (w-16, icons only), the small chevron button in the header is hard to find or invisible. The user wants to click **anywhere** on the collapsed sidebar strip to expand it.

### Changes — `src/components/AppSidebar.tsx`

1. **Add a click handler on the `<aside>` element** that expands the sidebar when it's collapsed. When clicked while collapsed, call `setCollapsed(false)` instead of navigating.

2. **When collapsed, make the entire sidebar act as an expand trigger**: wrap the aside with an `onClick` that checks `if (collapsed) setCollapsed(false)`. This means clicking any icon or empty space in the collapsed strip expands the menu first.

3. **Remove navigation on collapsed icon click** — currently clicking a parent icon while collapsed navigates to the first child. Instead, it should expand the sidebar so the user can see and choose sub-items.

4. **Keep the chevron button** in the header for explicit collapse/expand, but now the entire collapsed strip is also clickable.

### Technical detail

```tsx
// On the <aside> element:
onClick={() => { if (collapsed) setCollapsed(false); }}
className={`... ${collapsed ? "cursor-pointer" : ""}`}

// Remove the navigate logic from collapsed parent clicks
// (the aside onClick will fire first and expand)
```

Single file change, no other modules affected.

