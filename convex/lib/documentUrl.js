export function documentUrl(id) {
  return `${process.env.CONVEX_SITE_URL}/documents?id=${encodeURIComponent(id)}`;
}
