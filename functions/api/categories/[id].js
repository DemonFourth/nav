// PUT update category (support nested structure)
export async function onRequestPut(context) {
  const { request, env, params } = context;
  const id = Number(params.id);
  let name, newParentId;
  
  try {
    const body = await request.json();
    name = body.name;
    const { parent_id, position, is_private, description } = body;
    
    const existing = await env.DB.prepare(
      'SELECT id, parent_id, depth, position, is_private, description FROM categories WHERE id = ?'
    ).bind(id).first();
    
    if (!existing) {
      return new Response(JSON.stringify({ error: '分类不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 处理 parent_id 更新
    newParentId = existing.parent_id;
    let newDepth = existing.depth;
    const parentProvided = Object.prototype.hasOwnProperty.call(body, 'parent_id');
    if (parentProvided) {
      if (parent_id === id) {
        return new Response(JSON.stringify({ error: '不能把分类设为自己的父级' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (parent_id === null || parent_id === undefined) {
        newParentId = null;
        newDepth = 0;
      } else {
        const parent = await env.DB.prepare(
          'SELECT id, parent_id, depth FROM categories WHERE id = ?'
        ).bind(parent_id).first();
        
        if (!parent) {
          return new Response(JSON.stringify({ error: '父分类不存在' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // 检查循环引用
        let currentParentId = parent.parent_id;
        while (currentParentId !== null && currentParentId !== undefined) {
          if (currentParentId === id) {
            return new Response(JSON.stringify({ error: '不能把分类移动到自己的子分类下' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          const ancestor = await env.DB.prepare(
            'SELECT parent_id FROM categories WHERE id = ?'
          ).bind(currentParentId).first();
          currentParentId = ancestor?.parent_id ?? null;
        }
        
        newParentId = parent_id;
        newDepth = parent.depth + 1;
        
        if (newDepth > 5) {
          return new Response(JSON.stringify({ error: '分类层级已达上限（5 层）' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
    }
    
    // 处理 position
    let newPosition = existing.position;
    const positionProvided = Object.prototype.hasOwnProperty.call(body, 'position');
    if (positionProvided && typeof position === 'number') {
      newPosition = position;
    } else if (parentProvided && newParentId !== existing.parent_id) {
      const whereClause = newParentId ? 'WHERE parent_id = ?' : 'WHERE parent_id IS NULL';
      const query = `SELECT COALESCE(MAX(position), -1) as position FROM categories ${whereClause}`;
      const { position: maxPosition } = newParentId
        ? await env.DB.prepare(query).bind(newParentId).first()
        : await env.DB.prepare(query).first();
      newPosition = (maxPosition || -1) + 1;
    }
    
    // 处理 is_private
    let newIsPrivate = existing.is_private;
    if (Object.prototype.hasOwnProperty.call(body, 'is_private')) {
      newIsPrivate = is_private ? 1 : 0;
    }
    
    // 处理 description
    let newDescription = existing.description;
    if (Object.prototype.hasOwnProperty.call(body, 'description')) {
      newDescription = (description || '').substring(0, 50);
    }
    
    // 检查同一父分类下是否已存在同名分类（排除自己）
    const checkWhereClause = newParentId ? 'WHERE name = ? AND parent_id = ? AND id != ?' : 'WHERE name = ? AND parent_id IS NULL AND id != ?';
    const checkQuery = `SELECT id FROM categories ${checkWhereClause}`;
    const existingCategory = newParentId
      ? await env.DB.prepare(checkQuery).bind(name, newParentId, id).first()
      : await env.DB.prepare(checkQuery).bind(name, id).first();
    
    if (existingCategory) {
      const parentText = newParentId ? '该父分类下' : '根目录下';
      return new Response(JSON.stringify({ 
        error: `分类"${name}"已存在于${parentText}，请使用其他名称` 
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 先算清所有后代的新 depth，有任何一级超过 5 层就整单拒绝，不写半截数据
    const depthDiff = newDepth - existing.depth;
    const descendants = depthDiff !== 0 ? await collectDescendants(env.DB, id) : [];

    for (const child of descendants) {
      if (child.depth + depthDiff > 5) {
        return new Response(JSON.stringify({ error: '分类层级已达上限（5 层）' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // D1 batch 事务性执行：主行与所有后代的 depth 要么全改，要么全不改
    const statements = [
      env.DB.prepare(
        'UPDATE categories SET name = ?, parent_id = ?, depth = ?, position = ?, is_private = ?, description = ? WHERE id = ?'
      ).bind(name, newParentId || null, newDepth, newPosition, newIsPrivate, newDescription, id)
    ];

    for (const child of descendants) {
      statements.push(
        env.DB.prepare('UPDATE categories SET depth = ? WHERE id = ?')
          .bind(child.depth + depthDiff, child.id)
      );
    }

    await env.DB.batch(statements);
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    // 检测 SQLite UNIQUE 约束错误
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      const parentText = newParentId ? '该父分类下' : '根目录下';
      return new Response(JSON.stringify({ 
        error: `分类"${name}"已存在于${parentText}，请使用其他名称` 
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ error: '更新分类失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 收集某个分类的所有后代（广度优先），只读 id / depth
async function collectDescendants(db, rootId) {
  const descendants = [];
  const queue = [rootId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    const children = await db.prepare(
      'SELECT id, depth FROM categories WHERE parent_id = ?'
    ).bind(currentId).all();

    for (const child of children.results) {
      descendants.push(child);
      queue.push(child.id);
    }
  }

  return descendants;
}

// DELETE category (with cascade option for bookmarks)
export async function onRequestDelete(context) {
  const { env, params, request } = context;
  const id = Number(params.id);

  try {
    // Collect all descendant category IDs (recursive)
    const allDescendantIds = [];
    const queue = [id];
    while (queue.length > 0) {
      const current = queue.shift();
      const children = await env.DB.prepare(
        'SELECT id FROM categories WHERE parent_id = ?'
      ).bind(current).all();
      for (const child of children.results) {
        allDescendantIds.push(child.id);
        queue.push(child.id);
      }
    }

    // Count bookmarks in current category + all descendants
    const allIds = [id, ...allDescendantIds];
    const placeholders = allIds.map(() => '?').join(',');
    const { count: totalBookmarkCount } = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM bookmarks WHERE category_id IN (${placeholders})`
    ).bind(...allIds).first();

    const url = new URL(request.url);
    const cascade = url.searchParams.get('cascade');

    // If there are bookmarks and cascade not requested, ask frontend to decide
    if (totalBookmarkCount > 0 && cascade !== 'true') {
      return new Response(JSON.stringify({
        success: false,
        hasBookmarks: true,
        bookmarkCount: totalBookmarkCount,
        needsDecision: true
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Delete all bookmarks in this category tree
    if (totalBookmarkCount > 0) {
      await env.DB.prepare(
        `DELETE FROM bookmarks WHERE category_id IN (${placeholders})`
      ).bind(...allIds).run();
    }

    // Delete all descendant categories (bottom-up to avoid FK issues)
    for (const childId of allDescendantIds.reverse()) {
      await env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(childId).run();
    }
    await env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();

    return new Response(JSON.stringify({
      success: true,
      ...(totalBookmarkCount > 0 ? { deletedBookmarks: totalBookmarkCount } : {})
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to delete category' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

