// 生成用于查重比较的 URL 变体：仅根路径下忽略尾斜杠差异
export function getUrlComparisonVariants(rawUrl) {
  const trimmed = String(rawUrl ?? '').trim();
  if (!trimmed) return [];

  const variants = new Set([trimmed]);

  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return Array.from(variants);
    }

    variants.add(parsed.href);

    if (parsed.pathname === '/') {
      variants.add(`${parsed.origin}${parsed.search}${parsed.hash}`);
      variants.add(trimmed.replace(/\/$/, ''));
    }
  } catch (e) {
    // 非法 URL 由调用方校验
  }

  return Array.from(variants);
}
