const isPrivateFlag = (value) => Number(value) === 1

/**
 * 找出公开书签中、所属分类本身或任一祖先为私有的条目。
 * 分类 ID 统一按字符串建索引，避免数字/字符串混用导致漏判。
 */
export function findPublicBookmarksInPrivateCategories(bookmarks, categories) {
  if (!Array.isArray(bookmarks) || !Array.isArray(categories)) return []

  const categoryMap = new Map()
  for (const category of categories) {
    categoryMap.set(String(category.id), category)
  }

  const privacyCache = new Map()
  const isPrivateBranch = (categoryId) => {
    if (categoryId === null || categoryId === undefined || categoryId === '') return false

    const startKey = String(categoryId)
    if (privacyCache.has(startKey)) return privacyCache.get(startKey)

    const visited = []
    let current = categoryMap.get(startKey)
    let result = false

    while (current) {
      const currentKey = String(current.id)
      if (privacyCache.has(currentKey)) {
        result = privacyCache.get(currentKey)
        break
      }

      visited.push(currentKey)
      if (isPrivateFlag(current.is_private)) {
        result = true
        break
      }

      current = current.parent_id ? categoryMap.get(String(current.parent_id)) : null
    }

    for (const key of visited) privacyCache.set(key, result)
    return result
  }

  return bookmarks.filter((bookmark) => (
    !isPrivateFlag(bookmark.is_private) && isPrivateBranch(bookmark.category_id)
  ))
}
