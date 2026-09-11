# Design: Nav Card Notes Display

## Overview

Add direct display of bookmark notes in the navigation mode card UI, positioned below the URL with single-line truncation.

## Requirements

1. Display `bookmark.notes` field directly on the card
2. Position: below the URL line in the card footer
3. Visibility: only when notes exist and are non-empty
4. Truncation: single line with ellipsis overflow
5. Styling: match existing description style (font-size: 14px, color: var(--nav-text-secondary))
6. Tooltip: existing tooltip already shows full notes content

## Implementation

### Template Changes

In `src/components/NavCard.vue`, add notes display in the `.nav-card-bottom` section:

```html
<div v-if="bookmark.notes && bookmark.notes.trim()" class="nav-card-notes">
  {{ bookmark.notes }}
</div>
```

### CSS Additions

Add new style rule:

```css
.nav-card-notes {
  font-size: 14px;
  color: var(--nav-text-secondary);
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

### Data Flow

- `bookmark.notes` comes from the existing bookmark data structure
- No API changes required
- No state management changes needed

## Impact Analysis

### Layout Impact

- Card minimum height may increase when notes are present
- Grid layout remains responsive with `auto-fill` and `minmax`
- No breaking changes to existing card dimensions

### Performance Impact

- Negligible: one additional DOM element per card with notes
- No additional data fetching or processing

### Compatibility

- Works with all existing themes (light/dark)
- Maintains responsive design behavior
- Preserves accessibility through existing tooltip mechanism

### Testing

- Visual verification with bookmarks that have/don't have notes
- Verify truncation behavior with long notes
- Confirm tooltip still shows complete notes content
- Test across different screen sizes

## Trade-offs

### Benefits

- Simple implementation with minimal code changes
- Directly meets user requirements
- Maintains design consistency

### Considerations

- Card heights may vary slightly based on notes presence
- Long notes require tooltip for full viewing (existing behavior)

## Future Enhancements (Optional)

- Add user setting to toggle notes display
- Support multi-line notes with expand/collapse
- Add notes-specific styling options

## Approval

This design has been approved by the user.