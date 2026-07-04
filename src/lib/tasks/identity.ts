export interface ParsedFolder {
  id: string;
  slug: string;
  folder: string;
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    || "task";
}

export function parseFolderName(folder: string): ParsedFolder | null {
  const m = folder.match(/^(\d+)-(.+)$/);
  if (!m) return null;
  return { id: m[1], slug: m[2], folder };
}
