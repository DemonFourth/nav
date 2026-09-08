# Category Description Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional description field to categories in nav mode, displayed as a native tooltip on hover.

**Architecture:** Add `description` column to categories table, thread it through the API layer, and display via native `title` tooltip in NavMenuItem.

**Tech Stack:** SQLite (D1), Cloudflare Functions, Vue 3 Composition API

## Global Constraints

- Description max 50 characters
- Optional field (default empty string)
- Visible to all users including public mode
- Native browser tooltip only (no custom component)

---

## File Structure

| File | Change |
|------|--------|
| `migrations/005_add_category_description.sql` | Create — add description column |
| `functions/api/categories/index.js:111-113` | Modify — accept description in POST |
| `functions/api/categories/[id].js:10-116` | Modify — accept description in PUT |
| `src/composables/useCategoryEditor.js:38-43` | Modify — add description to editForm |
| `src/composables/useCategoryEditor.js:48` | Modify — add description to formOriginal |
| `src/composables/useCategoryEditor.js:51-59` | Modify — sync description in resetEditForm |
| `src/composables/useCategoryEditor.js:480-505` | Modify — track description changes |
| `src/composables/useCategoryEditor.js:515-518` | Modify — pass description to editCategory |
| `src/components/NavSettingsModal.vue:476` | Modify — add description input field |
| `src/components/NavMenuItem.vue:10` | Modify — add title attribute |

---

### Task 1: Database Migration

**Files:**
- Create: `migrations/005_add_category_description.sql`

- [ ] **Step 1: Create migration file**

```sql
-- 为分类表添加 description 字段
ALTER TABLE categories ADD COLUMN description TEXT DEFAULT '';
```

- [ ] **Step 2: Apply to local database**

Run: `npm run db:init:local`

- [ ] **Step 3: Commit**

```bash
git add migrations/005_add_category_description.sql
git commit -m "feat: add description column to categories table"
```

---

### Task 2: Backend API — POST /api/categories

**Files:**
- Modify: `functions/api/categories/index.js:48-138`

- [ ] **Step 1: Accept description in POST handler**

In `functions/api/categories/index.js`, find the POST handler. After line 56 (`const is_private = body.is_private;`), add:

```javascript
const description = body.description || '';
```

- [ ] **Step 2: Insert description into database**

Find the INSERT statement (line 111-113). Change from:

```javascript
'INSERT INTO categories (name, position, parent_id, depth, is_private) VALUES (?, ?, ?, ?, ?)'
).bind(name, newPosition, parent_id || null, depth, isPrivate).run();
```

To:

```javascript
'INSERT INTO categories (name, position, parent_id, depth, is_private, description) VALUES (?, ?, ?, ?, ?, ?)'
).bind(name, newPosition, parent_id || null, depth, isPrivate, description).run();
```

- [ ] **Step 3: Commit**

```bash
git add functions/api/categories/index.js
git commit -m "feat: accept description in POST /api/categories"
```

---

### Task 3: Backend API — PUT /api/categories/:id

**Files:**
- Modify: `functions/api/categories/[id].js:1-145`

- [ ] **Step 1: Accept description in PUT handler**

In `functions/api/categories/[id].js`, find line 10:

```javascript
const { parent_id, position, is_private } = body;
```

Change to:

```javascript
const { parent_id, position, is_private, description } = body;
```

- [ ] **Step 2: Handle description update**

After line 95 (`let newIsPrivate = existing.is_private;`), add:

```javascript
let newDescription = existing.description;
if (Object.prototype.hasOwnProperty.call(body, 'description')) {
  newDescription = description || '';
}
```

- [ ] **Step 3: Update the UPDATE query**

Find line 114-116:

```javascript
await env.DB.prepare(
  'UPDATE categories SET name = ?, parent_id = ?, depth = ?, position = ?, is_private = ? WHERE id = ?'
).bind(name, newParentId || null, newDepth, newPosition, newIsPrivate, id).run();
```

Change to:

```javascript
await env.DB.prepare(
  'UPDATE categories SET name = ?, parent_id = ?, depth = ?, position = ?, is_private = ?, description = ? WHERE id = ?'
).bind(name, newParentId || null, newDepth, newPosition, newIsPrivate, newDescription, id).run();
```

- [ ] **Step 4: Commit**

```bash
git add functions/api/categories/[id].js
git commit -m "feat: accept description in PUT /api/categories/:id"
```

---

### Task 4: Frontend — useCategoryEditor composable

**Files:**
- Modify: `src/composables/useCategoryEditor.js:38-59, 480-518`

- [ ] **Step 1: Add description to editForm**

Find line 38-43:

```javascript
const editForm = reactive({
  name: '',
  parentId: null,
  position: 1,
  maxPosition: 1
})
```

Change to:

```javascript
const editForm = reactive({
  name: '',
  parentId: null,
  position: 1,
  maxPosition: 1,
  description: ''
})
```

- [ ] **Step 2: Add description to formOriginal**

Find line 48:

```javascript
const formOriginal = reactive({ name: '', parentId: null, position: 1 })
```

Change to:

```javascript
const formOriginal = reactive({ name: '', parentId: null, position: 1, description: '' })
```

- [ ] **Step 3: Sync description in resetEditForm**

In `resetEditForm()` function (line 51-60), add after line 54:

```javascript
editForm.description = selectedCategory.value.description || ''
```

- [ ] **Step 4: Update applyFormChanges to pass description**

Find line 515-518:

```javascript
const result = await editCategory(
  selectedCategoryId.value,
  editForm.name.trim(),
  editForm.parentId
)
```

Change to:

```javascript
const result = await editCategory(
  selectedCategoryId.value,
  editForm.name.trim(),
  editForm.parentId,
  undefined,
  editForm.description.trim()
)
```

- [ ] **Step 5: Update editCategory to accept description**

Find line 219-220:

```javascript
async function editCategory(id, name, parentId, isPrivate = undefined) {
  const result = await updateCategory(id, name, parentId, isPrivate)
```

Change to:

```javascript
async function editCategory(id, name, parentId, isPrivate = undefined, description = undefined) {
  const result = await updateCategory(id, name, parentId, isPrivate, description)
```

- [ ] **Step 6: Update formOriginal after save**

In `applyFormChanges()` (line 521-525), find:

```javascript
formOriginal.name = editForm.name.trim()
formOriginal.parentId = editForm.parentId
```

Change to:

```javascript
formOriginal.name = editForm.name.trim()
formOriginal.parentId = editForm.parentId
formOriginal.description = editForm.description.trim()
```

- [ ] **Step 7: Commit**

```bash
git add src/composables/useCategoryEditor.js
git commit -m "feat: thread description through useCategoryEditor"
```

---

### Task 5: Frontend — useBookmarks composable

**Files:**
- Modify: `src/composables/useBookmarks.js:338-365`

- [ ] **Step 1: Update updateCategory to accept description**

Find line 338:

```javascript
const updateCategory = async (id, name, parentId = undefined, isPrivate = undefined) => {
```

Change to:

```javascript
const updateCategory = async (id, name, parentId = undefined, isPrivate = undefined, description = undefined) => {
```

- [ ] **Step 2: Add description to request body**

Find line 340-346:

```javascript
const body = { name }
if (parentId !== undefined) {
  body.parent_id = parentId
}
if (isPrivate !== undefined) {
  body.is_private = isPrivate
}
```

Change to:

```javascript
const body = { name }
if (parentId !== undefined) {
  body.parent_id = parentId
}
if (isPrivate !== undefined) {
  body.is_private = isPrivate
}
if (description !== undefined) {
  body.description = description
}
```

- [ ] **Step 3: Commit**

```bash
git add src/composables/useBookmarks.js
git commit -m "feat: accept description in updateCategory API call"
```

---

### Task 6: Frontend — NavSettingsModal UI

**Files:**
- Modify: `src/components/NavSettingsModal.vue:476`

- [ ] **Step 1: Add description input field**

Find line 475-476:

```vue
<input type="text" v-model="editCategoryForm.name" class="setting-input" @change="handleRecordCategoryChange" />
```

After this line, add:

```vue
</div>
<div class="form-group-menu">
  <label>描述</label>
  <input
    type="text"
    v-model="editCategoryForm.description"
    class="setting-input"
    maxlength="50"
    placeholder="可选，悬浮时显示"
    @change="handleRecordCategoryChange"
  />
  <span class="char-count">{{ (editCategoryForm.description || '').length }}/50</span>
```

- [ ] **Step 2: Add char-count style**

Find the `<style>` section and add:

```css
.char-count {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 0.25rem;
  display: block;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/NavSettingsModal.vue
git commit -m "feat: add description input to NavSettingsModal"
```

---

### Task 7: Frontend — NavMenuItem tooltip

**Files:**
- Modify: `src/components/NavMenuItem.vue:10`

- [ ] **Step 1: Add title attribute**

Find line 10:

```vue
<span class="submenu-text">{{ item.name }}</span>
```

Change to:

```vue
<span class="submenu-text" :title="item.description || ''">{{ item.name }}</span>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/NavMenuItem.vue
git commit -m "feat: show category description as tooltip in NavMenuItem"
```

---

### Task 8: Verify

- [ ] **Step 1: Build project**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Test locally**

Run: `npm run dev`

1. Open nav mode settings → 菜单 tab
2. Select a category → verify description input appears
3. Type a description → click 确认
4. Hover over the category in NavBar → verify tooltip shows
5. Refresh page → verify description persists

- [ ] **Step 3: Final commit if needed**

```bash
git status
git add -A
git commit -m "feat: category description feature complete"
```
