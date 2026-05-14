# NavSettingsModal Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign `NavSettingsModal.vue` with sidebar layout, bento grid, emerald accent theme, draggable menu ordering.

**Architecture:** Single-file Vue SFC rewrite. Template → sidebar nav + content area with bento card grid. Style → CSS custom properties for dark/light theme. Script → preserve all composable calls, add sortable category list logic.

**Tech Stack:** Vue 3 `<script setup>`, CSS custom properties, native HTML5 drag-and-drop API

---

### Task 1: Rewrite Template

**Files:**
- Modify: `src/components/NavSettingsModal.vue:1-544`

Replace entire `<template>` block:
- Sidebar (220px) with tab nav buttons (Appearance, Data, Menu, AI, About)
- Content area with panel-header + bento settings-grid
- Menu tab: sortable list with drag handle + arrow buttons + visibility toggles

### Task 2: Add Menu Tab Logic to Script

**Files:**
- Modify: `src/components/NavSettingsModal.vue:546-864`

- Add `menu` to tabs array
- Add `categoryList` computed from categories
- Add drag reorder state/handlers
- Keep all existing composable logic intact

### Task 3: Rewrite Styles

**Files:**
- Modify: `src/components/NavSettingsModal.vue:865-2009`

Replace all `<style scoped>` with CSS variable-based theme system:
- `:root` light theme variables
- `html.dark` overrides  
- Emerald accent (#10b981 / #34d399)
- Sidebar layout, bento cards, sortable list styles
- Scrollbar, transitions, responsive rules

### Task 4: Verify Build

Run: `npm run build`
Expected: Success with no errors
