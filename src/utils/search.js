export const SEARCH_FIELD_OPTIONS = [
  { value: 'all', label: '全部字段' },
  { value: 'name', label: '名称' },
  { value: 'url', label: 'URL' },
  { value: 'description', label: '描述' },
  { value: 'tags', label: '标签' },
  { value: 'notes', label: '备注' },
]

export function searchBookmarks(bookmarks, query, options = {}) {
  const q = query.toLowerCase().trim()
  if (!q) return bookmarks

  let fields
  if (options.fields) {
    fields = options.fields
  } else if (options.field && options.field !== 'all') {
    fields = [options.field]
  } else {
    fields = ['name', 'url', 'description', 'tags', 'notes']
  }

  return bookmarks.filter(b =>
    fields.some(f => b[f] && b[f].toLowerCase().includes(q))
  )
}