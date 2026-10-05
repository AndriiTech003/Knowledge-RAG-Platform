import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import ts from 'typescript';
import {
  Binary,
  BindingPipe,
  Call,
  LiteralPrimitive,
  RecursiveAstVisitor,
  TemplateLiteral,
  TmplAstRecursiveVisitor,
  parseTemplate,
  tmplAstVisitAll,
} from '@angular/compiler';

const ROOT = 'src/app';
const SKIP = [/\/core\/api\//, /\.spec\.ts$/, /\.stories\.ts$/];
const VISIBLE_ATTRIBUTES = new Set([
  'placeholder',
  'aria-label',
  'aria-description',
  'aria-roledescription',
  'aria-valuetext',
  'title',
  'alt',
  'label',
  'matTooltip',
  'mattooltip',
  'hint',
  'message',
]);
const WORD = /[A-Za-z]{2,}/;
const SENTENCE = /^[A-Z][a-z]+(?:[ ,'’-]+[A-Za-z]+)+[.!?…:]?$|^[A-Z][a-z]{2,}(?: [a-z]+)*[.!?…]$/;
const ALLOWED_TEXT = new Set(['⌘K', 'Esc', 'p.', 'ms', 'kB', 'MB', 'RRF', 'MRR', 'nDCG@8', 'ID', 'JSON', 'SSE']);
const TS_ALLOW = [/^[A-Z][a-z]+(?:-[A-Z][a-z]+)+$/, /^[a-z0-9_.:/-]+$/, /^[A-Z_0-9]+$/, /^Bearer /, /^application\//, /^text\//, /^image\//];

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

function report(file, line, message) {
  problems.push(`${relative(process.cwd(), file)}:${line} ${message}`);
}

function visibleLiteral(value) {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  if (!WORD.test(text) || ALLOWED_TEXT.has(text)) return false;
  if (/^[a-z0-9_.:/#@-]+$/.test(text)) return false;
  if (/^[a-z][a-zA-Z0-9]*(?: [a-z][a-zA-Z0-9-]*)*$/.test(text) && !text.includes(' ')) return false;
  return /[A-Z ]/.test(text) || text.length > 3;
}

class LiteralFinder extends RecursiveAstVisitor {
  constructor(onLiteral) {
    super();
    this.onLiteral = onLiteral;
  }

  visitBinary(ast, context) {
    if (['==', '===', '!=', '!==', 'in'].includes(ast.operation)) return null;
    return super.visitBinary(ast, context);
  }

  visitPipe(ast, context) {
    ast.exp.visit(this, context);
    return null;
  }

  visitCall(ast, context) {
    ast.receiver.visit(this, context);
    return null;
  }

  visitKeyedRead(ast, context) {
    ast.receiver.visit(this, context);
    return null;
  }

  visitLiteralPrimitive(ast) {
    if (visibleLiteral(ast.value)) this.onLiteral(ast.value);
    return null;
  }

  visitTemplateLiteral(ast, context) {
    for (const element of ast.elements) if (visibleLiteral(element.text)) this.onLiteral(element.text);
    for (const expression of ast.expressions) expression.visit(this, context);
    return null;
  }
}

void Binary;
void BindingPipe;
void Call;
void LiteralPrimitive;
void TemplateLiteral;

function lineOf(source, offset) {
  return source.slice(0, offset).split('\n').length;
}

function checkTemplate(file, template, baseLine) {
  const parsed = parseTemplate(template, file, { preserveWhitespaces: false });
  if (parsed.errors?.length) {
    for (const error of parsed.errors) report(file, baseLine, `template parse error: ${error.msg}`);
    return;
  }
  const where = (span) => baseLine + (span ? span.start.line : 0);
  const expressionLiterals = (ast, span, label) => {
    const target = ast && ast.ast ? ast.ast : ast;
    if (!target || typeof target.visit !== 'function') return;
    target.visit(new LiteralFinder((value) => report(file, where(span), `untranslated ${label} literal "${value}"`)));
  };

  class Visitor extends TmplAstRecursiveVisitor {
    constructor() {
      super();
      this.translated = 0;
    }

    enter(node, visitChildren) {
      const marked = Boolean(node.i18n) || ['mat-icon', 'kbd', 'code'].includes(node.name);
      if (marked) this.translated += 1;
      visitChildren();
      if (marked) this.translated -= 1;
    }

    visitElement(element) {
      this.enter(element, () => super.visitElement(element));
    }

    visitComponent(component) {
      this.enter(component, () => super.visitComponent(component));
    }

    visitTemplate(template) {
      this.enter(template, () => super.visitTemplate(template));
    }

    visitText(text) {
      const value = text.value.trim();
      if (!this.translated && WORD.test(value) && !ALLOWED_TEXT.has(value)) {
        report(file, where(text.sourceSpan), `untranslated text "${value.slice(0, 60)}"`);
      }
    }

    visitBoundText(text) {
      expressionLiterals(text.value, text.sourceSpan, 'interpolation');
    }

    visitTextAttribute(attribute) {
      if (VISIBLE_ATTRIBUTES.has(attribute.name) && !attribute.i18n && WORD.test(attribute.value)) {
        report(file, where(attribute.sourceSpan), `attribute ${attribute.name}="${attribute.value}" needs i18n-${attribute.name}`);
      }
    }

    visitBoundAttribute(attribute) {
      const name = attribute.name.replace(/^attr\./, '');
      if (VISIBLE_ATTRIBUTES.has(name)) expressionLiterals(attribute.value, attribute.sourceSpan, `[${attribute.name}]`);
    }
  }

  tmplAstVisitAll(new Visitor(), parsed.nodes);
}

function isLocalizeTemplate(node) {
  return ts.isTaggedTemplateExpression(node.parent ?? node) && node.parent.tag.getText() === '$localize';
}

function checkTypeScript(file, sourceText) {
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true);
  const visit = (node) => {
    if (ts.isDecorator(node)) {
      const call = node.expression;
      if (ts.isCallExpression(call) && call.expression.getText() === 'Component') {
        const config = call.arguments[0];
        if (config && ts.isObjectLiteralExpression(config)) {
          for (const prop of config.properties) {
            if (!ts.isPropertyAssignment(prop)) continue;
            const key = prop.name.getText();
            if (key === 'template' && (ts.isNoSubstitutionTemplateLiteral(prop.initializer) || ts.isStringLiteral(prop.initializer))) {
              const start = prop.initializer.getStart() + 1;
              checkTemplate(file, prop.initializer.text, lineOf(sourceText, start) - 1);
            }
            if (key === 'templateUrl' && ts.isStringLiteral(prop.initializer)) {
              const path = join(dirname(file), prop.initializer.text);
              checkTemplate(path, readFileSync(path, 'utf8'), 1);
            }
          }
        }
        return;
      }
    }
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText();
      if (/^console\.|Error$|^new Error|\.(warn|debug|log)$|querySelector|getByTestId|^import$|startsWith|endsWith|includes|split|replace|test$|match/.test(callee)) return;
    }
    if (ts.isNewExpression(node) && /Error|RegExp|URL|Date/.test(node.expression.getText())) return;
    if (ts.isTaggedTemplateExpression(node) && node.tag.getText() === '$localize') return;
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !isLocalizeTemplate(node)) {
      const text = node.text.trim();
      const parent = node.parent;
      const isKey = parent && (ts.isPropertyAssignment(parent) && parent.name === node);
      const isCompare = parent && ts.isBinaryExpression(parent) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken].includes(parent.operatorToken.kind);
      const isType = parent && (ts.isLiteralTypeNode(parent));
      if (!isKey && !isCompare && !isType && SENTENCE.test(text) && !TS_ALLOW.some((re) => re.test(text))) {
        report(file, lineOf(sourceText, node.getStart()), `untranslated string "${text.slice(0, 60)}" (use $localize)`);
      }
    }
    if (ts.isTemplateExpression(node) && !(ts.isTaggedTemplateExpression(node.parent))) {
      const head = node.head.text.trim();
      if (SENTENCE.test(`${head} x`.trim()) && /^[A-Z][a-z]+ [a-z]/.test(head)) {
        report(file, lineOf(sourceText, node.getStart()), `untranslated template string "${head.slice(0, 60)}" (use $localize)`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

for (const file of walk(ROOT)) {
  if (!file.endsWith('.ts') || SKIP.some((re) => re.test(file))) continue;
  checkTypeScript(file, readFileSync(file, 'utf8'));
}

if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`\n${problems.length} untranslated string(s) found`);
  process.exit(1);
}
console.log('i18n check: 0 untranslated strings');
