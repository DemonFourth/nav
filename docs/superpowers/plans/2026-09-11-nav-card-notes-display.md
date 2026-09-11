# Nav Card Notes Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add direct display of bookmark notes in the navigation mode card UI, positioned below the URL with single-line truncation.

**Architecture:** Modify the existing NavCard.vue component to include a new notes display element. The implementation adds a conditional div for notes with CSS styling matching the existing description style.

**Tech Stack:** Vue 3 Composition API, CSS custom properties for theming.

## Global Constraints

- Use existing CSS custom properties for theming (var(--nav-text-secondary), etc.)
- Maintain compatibility with both light and dark themes
- Preserve responsive design behavior
- No breaking changes to existing card dimensions
- Follow existing code conventions in NavCard.vue

---

### Task 1: Add Notes Display to NavCard Component

**Files:**
- Modify: `src/components/NavCard.vue:22-50` (template section)
- Modify: `src/components/NavCard.vue:154-370` (style section)

**Interfaces:**
- Consumes: `bookmark.notes` property from existing bookmark object
- Produces: Visual display of notes in the card UI

- [ ] **Step 1: Add notes display element to template**

In `src/components/NavCard.vue`, locate the `.nav-card-bottom` section (lines 30-50). Add the following div after the URL div (line 49):

```html
<div v-if="bookmark.notes && bookmark.notes.trim()" class="nav-card-notes">
  {{ bookmark.notes }}
</div>
```

The complete modified section should look like:

```html
<!-- 第二行：标签 + URL -->
<div class="nav-card-bottom">
  <div v-if="bookmark.tags && bookmark.tags.trim()" class="nav-card-tags">
    <span 
      v-for="(tag, index) in visibleTags" 
      :key="index"
      class="tag-badge"
      @click.stop="handleTagClick(tag)"
    >
      {{ tag }}
    </span>
    <span 
      v-if="remainingCount > 0" 
      class="tag-badge more-tags"
      @click.stop="toggleExpand"
    >
      {{ expanded ? '收起' : `+${remainingCount}` }}
    </span>
  </div>
  <div class="nav-card-url">{{ bookmark.url }}</div>
  <div v-if="bookmark.notes && bookmark.notes.trim()" class="nav-card-notes">
    {{ bookmark.notes }}
  </div>
</div>
```

- [ ] **Step 2: Add CSS styling for notes**

In `src/components/NavCard.vue`, add the following CSS rule in the `<style scoped>` section, after the `.nav-card-url` rule (around line 335):

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

- [ ] **Step 3: Verify build succeeds**

Run: `npm run build`
Expected: Build completes without errors

- [ ] **Step 4: Visual verification**

1. Start development server: `npm run dev`
2. Navigate to the application in browser
3. Switch to navigation mode (if not already)
4. Find bookmarks with notes - verify notes appear below URL
5. Find bookmarks without notes - verify no empty space appears
6. Test with long notes - verify single-line truncation with ellipsis
7. Hover over card - verify tooltip still shows complete notes content
8. Test in both light and dark themes

- [ ] **Step 5: Commit changes**

```bash
git add src/components/NavCard.vue
git commit -m "feat: add notes display to navigation mode cards"
```