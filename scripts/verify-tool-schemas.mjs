/**
 * Regression guard for AI tool parameter schemas.
 *
 * Two invariants, both learned the hard way:
 *
 *   1. No union types in any generated JSON Schema. `z.array(x).nullable()`
 *      compiles to an `anyOf` branch union, and unconstrained models (none of
 *      our providers grammar-constrain tool args) emit the *string* "null" into
 *      those far more often than into a plain `{"type":"array"}`. That is what
 *      broke suggest_work_experience_improvement.
 *
 *   2. Every tool schema parses anything without throwing. Field-level
 *      `.catch()` fallbacks mean a malformed argument degrades to a sane
 *      default instead of killing the whole response stream.
 *
 * Run with:  npm run verify:schemas
 * No test framework required — it compiles the two schema modules with the
 * project's own tsc and asserts against the result.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Compile into the project tree so Node still resolves `ai` and `zod` from
// ./node_modules when it imports the output.
const outDir = mkdtempSync(join(process.cwd(), '.schema-check-'));
let tools;
try {
  execFileSync(
    'npx',
    // CommonJS so the emitted extensionless `./tool-coercion` import resolves.
    ['tsc', 'src/lib/tools.ts', 'src/lib/tool-coercion.ts',
     '--outDir', outDir, '--module', 'commonjs', '--target', 'es2022',
     '--moduleResolution', 'node', '--esModuleInterop', '--skipLibCheck'],
    { stdio: 'inherit' },
  );
  ({ tools } = await import(pathToFileURL(join(outDir, 'tools.js')).href));
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

const { zodToJsonSchema } = await import('zod-to-json-schema');

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${ok || !detail ? '' : ` -> ${detail}`}`);
  if (!ok) failures++;
};

// --- Invariant 1: no union types anywhere in any tool's JSON Schema ----------
console.log('\nJSON Schema shape (no anyOf / no union `type` arrays):');
for (const [toolName, tool] of Object.entries(tools)) {
  const schema = zodToJsonSchema(tool.parameters, { $refStrategy: 'none' });
  const unions = [];
  const walk = (node, path) => {
    if (!node || typeof node !== 'object') return;
    if (node.anyOf) unions.push(`${path} anyOf`);
    if (Array.isArray(node.type)) unions.push(`${path} type ${JSON.stringify(node.type)}`);
    if (node.properties) for (const key of Object.keys(node.properties)) walk(node.properties[key], `${path}.${key}`);
    if (node.items) walk(node.items, `${path}[]`);
  };
  walk(schema, toolName);
  check(toolName, unions.length === 0, unions.join(', '));
}

// --- Invariant 2: the work-experience schema cannot fail --------------------
const workExperience = tools.suggest_work_experience_improvement.parameters;

console.log('\nsuggest_work_experience_improvement never rejects:');

// The exact payload from the production error report.
const reported = {
  index: 0,
  bullet_operations: [{
    operation: 'add',
    index: null,
    text: "Optimized mobile app performance by implementing virtualized lists with **React Native**'s FlashList",
  }],
  technologies: 'null',
};
const reportedResult = workExperience.safeParse(reported);
check(
  'reported failing payload parses',
  reportedResult.success,
  reportedResult.success ? '' : JSON.stringify(reportedResult.error?.issues),
);
check(
  '  -> technologies coerced to []',
  reportedResult.success && Array.isArray(reportedResult.data.technologies) && reportedResult.data.technologies.length === 0,
  reportedResult.success ? JSON.stringify(reportedResult.data.technologies) : '',
);
check(
  '  -> add operation keeps its text',
  reportedResult.success && reportedResult.data.bullet_operations[0].text === reported.bullet_operations[0].text,
);

const adversarial = [
  ['CSV technologies are salvaged', { index: 0, bullet_operations: [], technologies: 'React, Detox' },
    (d) => JSON.stringify(d.technologies) === '["React","Detox"]'],
  ['JSON-string technologies are salvaged', { index: 0, bullet_operations: [], technologies: '["Reanimated"]' },
    (d) => JSON.stringify(d.technologies) === '["Reanimated"]'],
  ['numeric-string index is salvaged, not defaulted', { index: 0, bullet_operations: [{ operation: 'replace', index: '2', text: 'y' }], technologies: [] },
    (d) => d.bullet_operations[0].index === 2],
  ['non-array bullet_operations degrades to []', { index: 0, bullet_operations: 'null', technologies: [] },
    (d) => Array.isArray(d.bullet_operations) && d.bullet_operations.length === 0],
  ['empty object gets full defaults', {},
    (d) => d.index === 0 && d.bullet_operations.length === 0 && d.technologies.length === 0],
  ['garbage scalars are absorbed', { index: {}, bullet_operations: 42, technologies: true },
    (d) => d.index === 0 && d.bullet_operations.length === 0 && d.technologies.length === 0],
];

for (const [name, input, assertion] of adversarial) {
  const result = workExperience.safeParse(input);
  check(name, result.success && assertion(result.data), result.success ? JSON.stringify(result.data) : 'rejected');
}

// --- Invariant 3: no tool writes the literal string "null" into the resume ---
// A `z.string().nullable()` field accepts the string "null" and stores it, which
// is how the project/education tools were silently corrupting fields.
console.log('\nNo tool stores the literal string "null":');
const nullish = { index: 'null', improved_project: { name: 'x', description: 'null', date: 'null', technologies: 'null', url: 'null', github_url: 'null' }, improved_education: { school: 'x', degree: 'null', field: 'null', location: 'null', date: 'null', gpa: 'null', achievements: 'null' }, improved_skill: { category: 'x', items: 'null' }, improved_summary: 'x', bullet_operations: [], technologies: 'null' };
for (const [toolName, tool] of Object.entries(tools)) {
  const result = tool.parameters.safeParse(nullish);
  const serialized = result.success ? JSON.stringify(result.data) : '<rejected>';
  check(
    toolName,
    result.success && !serialized.includes('"null"'),
    serialized,
  );
}

// --- Invariant 4: bulletList (prose) vs stringList (tokens) don't cross-split ---
// bulletList must NOT split a free-text description on commas; stringList must
// still split a CSV technologies string. This guards against repointing the
// wrong fields between the two coercions.
console.log('\nsuggest_project_improvement: bulletList vs stringList split behavior:');
const projectImprovement = tools.suggest_project_improvement.parameters;

const bulletResult = projectImprovement.safeParse({
  index: 0,
  improved_project: {
    name: 'x',
    description: 'Built a dashboard, reducing latency by 40%',
    date: 'x',
    technologies: [],
    url: 'x',
    github_url: 'x',
  },
});
check(
  'prose description string is kept as ONE bullet, not split on commas',
  bulletResult.success && Array.isArray(bulletResult.data.improved_project.description) && bulletResult.data.improved_project.description.length === 1,
  bulletResult.success ? JSON.stringify(bulletResult.data.improved_project.description) : JSON.stringify(bulletResult.error?.issues),
);

const technologiesResult = projectImprovement.safeParse({
  index: 0,
  improved_project: {
    name: 'x',
    description: [],
    date: 'x',
    technologies: 'React, Detox',
    url: 'x',
    github_url: 'x',
  },
});
check(
  'CSV technologies string still splits into a TWO-element array',
  technologiesResult.success && Array.isArray(technologiesResult.data.improved_project.technologies) && technologiesResult.data.improved_project.technologies.length === 2,
  technologiesResult.success ? JSON.stringify(technologiesResult.data.improved_project.technologies) : JSON.stringify(technologiesResult.error?.issues),
);

console.log(failures === 0 ? '\nAll schema checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
