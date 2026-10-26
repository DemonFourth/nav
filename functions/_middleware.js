// Token 验证辅助函数
async function validateToken(token, env) {
  try {
    const parts = token.split('.');
    
    // 支持新格式（timestamp.type.hash）和旧格式（timestamp.hash）
    let timestamp, tokenType, hash;
    
    if (parts.length === 3) {
      // 新格式：timestamp.type.hash
      [timestamp, tokenType, hash] = parts;
    } else if (parts.length === 2) {
      // 旧格式（兼容性）：timestamp.hash
      [timestamp, hash] = parts;
      tokenType = 'short'; // 默认为短期token
    } else {
      return { valid: false, error: 'Invalid token format' };
    }
    
    const tokenTime = parseInt(timestamp);
    const now = Date.now();
    
    // 根据token类型设置有效期
const expiryTime = tokenType === 'long'
      ? 30 * 24 * 60 * 60 * 1000  // 30天
      : 30 * 60 * 1000;            // 30分钟
    
    // 检查token是否过期
    if (now - tokenTime > expiryTime) {
      return { valid: false, error: 'Token expired' };
    }
    
    // 验证hash
    const tokenData = timestamp + '_' + tokenType + '_' + env.JWT_SECRET;
    const encoder = new TextEncoder();
    const data = encoder.encode(tokenData);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const expectedHash = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
    
    if (hash !== expectedHash) {
      return { valid: false, error: 'Invalid token' };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Invalid token format' };
  }
}

const PUBLIC_READ_PATHS = new Set([
  '/api/bookmarks',
  '/api/categories',
  '/api/fetch-metadata',
  '/api/icon-proxy',
  '/api/settings',
  '/api/ai/status'
]);

// JWT验证中间件
export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // CORS 头
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  }

  // 处理 OPTIONS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }
  
  // 添加安全响应头
  const securityHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
  };
  
  const unauthorized = (error = 'Unauthorized') => new Response(
    JSON.stringify({ error }),
    { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );

  // 登录接口不需要验证
  if (url.pathname === '/api/login') {
    return await next();
  }

  // 任何带认证头的 API 请求都先验签，结果写入 context.data 供 handler 使用
  if (url.pathname.startsWith('/api/')) {
    if (!context.data) context.data = {};

    const authHeader = request.headers.get('Authorization');
    let verified = false;

    if (authHeader) {
      if (!authHeader.startsWith('Bearer ')) {
        return unauthorized();
      }

      const validation = await validateToken(authHeader.substring(7), env);
      if (!validation.valid) {
        return unauthorized(validation.error);
      }
      verified = true;
    }

    context.data.auth = { verified };

    const isPublicRead = request.method === 'GET' && PUBLIC_READ_PATHS.has(url.pathname);
    if (!verified && !isPublicRead) {
      return unauthorized();
    }
  }
  
  const response = await next();
  
  // 添加安全头和 CORS 头到响应
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return response;
}

