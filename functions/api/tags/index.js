// GET list all tags with bookmark counts
export async function onRequestGet(context) {
  const { env, request } = context;
  
  try {
    // Check authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Query to split comma-separated tags and count occurrences
    const query = `
      WITH RECURSIVE SplitTags AS (
        SELECT 
          id,
          name,
          url,
          TRIM(SUBSTR(tags, 1, CASE WHEN INSTR(tags, ',') > 0 THEN INSTR(tags, ',') - 1 ELSE LENGTH(tags) END)) as tag,
          CASE 
            WHEN INSTR(tags, ',') > 0 THEN SUBSTR(tags, INSTR(tags, ',') + 1)
            ELSE NULL
          END as remaining
        FROM bookmarks
        WHERE tags != '' AND tags IS NOT NULL AND tags != ' '
        
        UNION ALL
        
        SELECT 
          id,
          name,
          url,
          TRIM(SUBSTR(remaining, 1, CASE WHEN INSTR(remaining, ',') > 0 THEN INSTR(remaining, ',') - 1 ELSE LENGTH(remaining) END)),
          CASE 
            WHEN INSTR(remaining, ',') > 0 THEN SUBSTR(remaining, INSTR(remaining, ',') + 1)
            ELSE NULL
          END
        FROM SplitTags
        WHERE remaining IS NOT NULL AND TRIM(remaining) != ''
      )
      SELECT 
        tag as name,
        COUNT(*) as count,
        GROUP_CONCAT(id) as bookmark_ids
      FROM SplitTags
      WHERE tag IS NOT NULL AND TRIM(tag) != ''
      GROUP BY tag
      ORDER BY tag
    `;

    const result = await env.DB.prepare(query).all();
    
    // Process results and fetch bookmark details for each tag
    const tags = [];
    
    for (const row of result.results) {
      const bookmarkIds = row.bookmark_ids.split(',').map(Number);
      
      // Fetch bookmark details
      const placeholders = bookmarkIds.map(() => '?').join(',');
      const bookmarksResult = await env.DB.prepare(
        `SELECT id, name, url FROM bookmarks WHERE id IN (${placeholders}) LIMIT 10`
      ).bind(...bookmarkIds).all();
      
      tags.push({
        name: row.name,
        count: row.count,
        bookmarks: bookmarksResult.results || []
      });
    }
    
    // Calculate summary
    const totalTags = tags.length;
    const totalBookmarksWithTags = tags.reduce((sum, tag) => sum + tag.count, 0);
    
    return new Response(JSON.stringify({ 
      success: true, 
      data: tags,
      summary: {
        totalTags,
        totalBookmarksWithTags
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to fetch tags:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch tags' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
