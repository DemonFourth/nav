# Category Description Feature Design

## Overview

Add an optional description field to categories in nav mode, displayed as a native tooltip on hover.

## Requirements

- Description is optional (default empty string)
- Max 50 characters
- Visible to all users (including public mode, non-logged-in)
- Displayed via native `title` tooltip on hover
- Editable in NavSettingsModal category detail form

## Changes

### Database

New migration `005_add_category_description.sql`:
```sql
ALTER TABLE categories ADD COLUMN description TEXT DEFAULT '';
```

### Backend API

- `POST /api/categories` — accept `description` parameter
- `PUT /api/categories/:id` — support updating `description`

### Frontend

| File | Change |
|------|--------|
| `useCategoryEditor.js:38` | Add `description` to editForm |
| `useCategoryEditor.js:51` | sync description in resetEditForm |
| `useCategoryEditor.js:515` | Pass description in applyFormChanges |
| `NavSettingsModal.vue:476` | Add description input (50 char limit) |
| `NavMenuItem.vue:10` | Add `:title="item.description"` for tooltip |

## Behavior

- Tooltip shows after ~0.5s hover delay (browser native)
- Empty description = no tooltip shown
- Description saved immediately with other category changes (no separate save)
