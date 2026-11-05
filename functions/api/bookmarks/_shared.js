// 生成用于查重比较的 URL 变体。
// 忽略三类常见但等价的差异（任意路径，不只是根路径）：
//   1. http / https
//   2. www. / 非 www.
//   3. 尾部斜杠
// 变体对输入是「对称」的：只要存储值与输入只差这三类，就一定能命中其中一个变体。
export function getUrlComparisonVariants(rawUrl) {
  const trimmed = String(rawUrl ?? '').trim();
  if (!trimmed) return [];

  const variants = new Set([trimmed]);

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (e) {
    // 非法 URL 由调用方校验
    return Array.from(variants);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return Array.from(variants);
  }

  // URL 解析器已归一化主机大小写、默认端口、空格转义等
  variants.add(parsed.href);

  const protocols = [parsed.protocol, parsed.protocol === 'https:' ? 'http:' : 'https:'];

  const hostname = parsed.hostname;
  const port = parsed.port ? `:${parsed.port}` : '';
  const hostnames = hostname.startsWith('www.')
    ? [hostname, hostname.slice(4)]
    : [hostname, `www.${hostname}`];

  const pathWithoutSlash = parsed.pathname.replace(/\/+$/, '');
  const paths = pathWithoutSlash ? [pathWithoutSlash, `${pathWithoutSlash}/`] : ['/', ''];

  const tail = `${parsed.search}${parsed.hash}`;

  protocols.forEach(protocol => {
    hostnames.forEach(host => {
      paths.forEach(path => {
        variants.add(`${protocol}//${host}${port}${path}${tail}`);
      });
    });
  });

  return Array.from(variants);
}
