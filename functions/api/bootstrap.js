// 聚合启动数据：分类（含完整路径）+ 去重标签
// 供浏览器扩展替代「分类 + 全量书签」两次请求，显著减少传输体积
export async function onRequestGet(context) {
  const { env } = context;

  const json = (data) =>
    new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });

  try {
    // 中间件已验签，只读可信结果
    const isAuthenticated = context.data?.auth?.verified === true;

    const publicModeSetting = await env.DB.prepare(
      'SELECT value FROM settings WHERE key = ?'
    ).bind('publicMode').first();

    const publicMode = publicModeSetting?.value !== 'false';

    // 非公开模式且未登录：不返回任何数据
    if (!publicMode && !isAuthenticated) {
      return json({ categories: [], tags: [], generatedAt: Date.now() });
    }

    const categorySql =
      'SELECT * FROM categories' +
      (isAuthenticated ? '' : ' WHERE is_private = 0') +
      ' ORDER BY depth, position';

    const tagSql =
      "SELECT tags FROM bookmarks WHERE tags IS NOT NULL AND tags != ''" +
      (isAuthenticated ? '' : ' AND is_private = 0');

    const [categoryRows, tagRows] = await Promise.all([
      env.DB.prepare(categorySql).all(),
      env.DB.prepare(tagSql).all()
    ]);

    const rawCategories = categoryRows.results || [];
    const categoryMap = new Map(rawCategories.map((cat) => [cat.id, cat]));

    const categories = rawCategories.map((cat) => {
      const segments = [];
      const visited = new Set();
      let current = categoryMap.get(cat.id);

      while (current) {
        if (visited.has(current.id)) break;
        visited.add(current.id);
        segments.unshift(current.name || '未命名');
        if (!current.parent_id) break;
        current = categoryMap.get(current.parent_id);
      }

      return { ...cat, path: segments.join(' / ') };
    });

    const tagSet = new Set();
    for (const row of tagRows.results || []) {
      String(row.tags || '')
        .split(',')
        .forEach((tag) => {
          const trimmed = tag.trim();
          if (trimmed) tagSet.add(trimmed);
        });
    }
    const tags = Array.from(tagSet).sort((a, b) => a.localeCompare(b, 'zh-CN'));

    return json({ categories, tags, generatedAt: Date.now() });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to load bootstrap data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
