import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const root = process.argv[2] ?? 'src/app/core/api';

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith('.ts')) out.push(full);
  }
  return out;
}

const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed });
let count = 0;
for (const file of walk(root)) {
  const text = readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const printed = printer.printFile(source);
  writeFileSync(file, printed);
  count += 1;
}
console.log(`stripped comments from ${count} files in ${root}`);
