import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * index.html ne charge que les icônes listées dans `icon_names` (police allégée).
 * Ce test échoue si le code utilise une icône absente de cette liste : elle s'afficherait cassée.
 */

const root = join(import.meta.dirname, '..', '..');

const loadedIcons = (() => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const match = html.match(/icon_names=([a-z0-9_,]+)/);
  return new Set(match ? match[1].split(',') : []);
})();

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !name.includes('.test.') ? [path] : [];
  });

/** Noms d'icônes repérables dans le code : contenu des <span class="material-symbols-outlined">, props `icon`. */
const usedIcons = () => {
  const found = new Map<string, string>();
  for (const file of sourceFiles(join(root, 'src'))) {
    const code = readFileSync(file, 'utf8');
    const spans = code.matchAll(/material-symbols-outlined[^>]*>([\s\S]*?)<\/span>/g);
    for (const [, content] of spans) {
      const names = content.trim().match(/^[a-z][a-z0-9_]*$/)
        ? [content.trim()]
        : [...content.matchAll(/'([a-z][a-z0-9_]*)'/g)].map((m) => m[1]);
      names.forEach((n) => found.set(n, file));
    }
    for (const [, name] of code.matchAll(/\bicon(?:=|: )['"]([a-z][a-z0-9_]*)['"]/g)) {
      found.set(name, file);
    }
  }
  return found;
};

describe('icônes Material Symbols', () => {
  it('la liste icon_names est triée (exigé par Google Fonts)', () => {
    const list = [...loadedIcons];
    expect(list).toEqual(list.toSorted());
  });

  it('chaque icône utilisée est chargée par index.html', () => {
    const missing = [...usedIcons()].filter(([name]) => !loadedIcons.has(name));
    expect(missing, 'Ajoutez ces noms à icon_names dans index.html').toEqual([]);
  });
});
