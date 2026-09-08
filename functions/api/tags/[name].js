function escapeLike(s) {
  return s.replace(/%/g, '\\%').replace(/_/g, '\\_')
}

// PUT rename tag
export async function onRequestPut(context) {
  const { env, request, params } = context;
  const oldName = decodeURIComponent(params.name);
  
  try {
    // Check authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const body = await request.json();
    const { newName } = body;
    
    // Validate new name
    if (!newName || !newName.trim()) {
      return new Response(JSON.stringify({ error: '标签名不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (newName.includes(',')) {
      return new Response(JSON.stringify({ error: '标签名不能包含逗号' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const trimmedNewName = newName.trim();
    
    // Check if old tag exists
    const checkOldTag = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM bookmarks WHERE tags LIKE ?`
    ).bind(`%${escapeLike(oldName)}%`).first();
    
    if (checkOldTag.count === 0) {
      return new Response(JSON.stringify({ error: '标签不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if new name already exists
    const checkNewTag = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM bookmarks WHERE tags LIKE ?`
    ).bind(`%${escapeLike(trimmedNewName)}%`).first();
    
    const merged = checkNewTag.count > 0;
    
    // Update bookmarks - replace old tag with new tag
    const affectedResult = await env.DB.prepare(
      `UPDATE bookmarks 
       SET tags = TRIM(REPLACE(
         REPLACE(tags, ?, ?),
         ?, ?
       )),
       updated_at = CURRENT_TIMESTAMP
       WHERE tags LIKE ?`
    ).bind(
      `${oldName},`, `${trimmedNewName},`,
      `,${oldName}`, `,${trimmedNewName}`,
      `%${escapeLike(oldName)}%`
    ).run();
    
    // Also handle case where old tag is the only tag
    const onlyTagResult = await env.DB.prepare(
      `UPDATE bookmarks 
       SET tags = ?,
       updated_at = CURRENT_TIMESTAMP
       WHERE tags = ?`
    ).bind(trimmedNewName, oldName).run();
    
    return new Response(JSON.stringify({ 
      success: true, 
      merged,
      affectedCount: (affectedResult.meta?.changes || 0) + (onlyTagResult.meta?.changes || 0)
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to rename tag:', error);
    return new Response(JSON.stringify({ error: 'Failed to rename tag' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// DELETE remove tag
export async function onRequestDelete(context) {
  const { env, request, params } = context;
  const tagName = decodeURIComponent(params.name);
  
  try {
    // Check authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if tag exists
    const checkTag = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM bookmarks WHERE tags LIKE ?`
    ).bind(`%${escapeLike(tagName)}%`).first();
    
    if (checkTag.count === 0) {
      return new Response(JSON.stringify({ error: '标签不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Remove tag from bookmarks
    // Single atomic UPDATE handles all 3 cases (first, middle, last) without leaving
    // orphaned commas, leading spaces, or trailing spaces.
    const result = await env.DB.prepare(
      `UPDATE bookmarks 
       SET tags = TRIM(REPLACE(REPLACE(REPLACE(tags, ', ' || ?, ''), ? || ', ', ''), ?, '')),
       updated_at = CURRENT_TIMESTAMP
       WHERE tags LIKE ?`
    ).bind(
      tagName,
      tagName,
      tagName,
      `%${escapeLike(tagName)}%`
    ).run();
    
    return new Response(JSON.stringify({ 
      success: true, 
      affectedCount: result.meta?.changes || 0
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to delete tag:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete tag' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
