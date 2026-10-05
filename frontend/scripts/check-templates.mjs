import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const roots = ['src'];
const patterns = [
  { ext: '.html', re: /<!--/g, label: 'HTML comment' },
  { ext: '.scss', re: /\/\*|(^|[^:'"])\/\/(?!\/)/gm, label: 'SCSS comment' },
  { ext: '.ts', re: /<!--/g, label: 'HTML comment in inline template' },
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const problems = [];
for (const root of roots) {
  for (const file of walk(root)) {
    const rule = patterns.find((p) => file.endsWith(p.ext));
    if (!rule) continue;
    const text = readFileSync(file, 'utf8');
    const lines = text.split('\n');
    lines.forEach((line, index) => {
      rule.re.lastIndex = 0;
      if (rule.ext === '.scss' && /url\(/.test(line)) return;
      if (rule.re.test(line)) problems.push(`${relative(process.cwd(), file)}:${index + 1} ${rule.label} is not allowed`);
    });
  }
}

if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`\n${problems.length} comment problem(s) found`);
  process.exit(1);
}
console.log('template/style comment check: 0 problems');
