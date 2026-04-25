export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function uniqueSlug(title: string, existingSlugs: Set<string>): string {
  const base = slugify(title) || 'untitled';
  if (!existingSlugs.has(base)) {
    existingSlugs.add(base);
    return base;
  }
  let i = 2;
  while (existingSlugs.has(`${base}-${i}`)) i++;
  const slug = `${base}-${i}`;
  existingSlugs.add(slug);
  return slug;
}
