import { z } from 'zod';

/**
 * Tolerant field builders for AI tool parameter schemas.
 *
 * None of our providers grammar-constrain tool arguments (OpenAI only enables
 * `strict` for reasoning models, Anthropic never does, and OpenRouter passes
 * through), so the JSON schema we send is advisory prose to the model — it can
 * and does emit malformed values. The most common one is the *string* "null"
 * where an array or number was expected, which used to fail the whole stream.
 *
 * Each builder below is `preprocess(salvage) -> base -> catch(fallback)`:
 * salvage recovers whatever the model plausibly meant, and `catch` guarantees
 * the field can never fail validation. Prefer these over `.nullable()` — a
 * nullable array compiles to an `anyOf` branch union, which models get wrong
 * far more often than a plain `{"type": "array"}`.
 */

const NULLISH = /^(null|undefined|none|n\/a|)$/i;

/** Recover an array of strings from a JSON array, a JSON string, or a CSV string. */
export const salvageArray = (v: unknown) => {
  if (Array.isArray(v)) return v;
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  if (NULLISH.test(t)) return [];
  try {
    const parsed = JSON.parse(t);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // not JSON — fall through to the CSV reading below
  }
  return t.split(',').map((s) => s.trim()).filter(Boolean);
};

/** Like `salvageArray`, but a bare string fallback becomes one bullet instead of a CSV split. */
export const salvageBullets = (v: unknown) => {
  if (Array.isArray(v)) return v;
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  if (NULLISH.test(t)) return [];
  try {
    const parsed = JSON.parse(t);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // not JSON — fall through to treating the whole string as one bullet
  }
  return [t];
};

/** Recover an integer from a number or a numeric string. */
export const salvageInt = (v: unknown) => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && /^-?\d+$/.test(v.trim())) return parseInt(v.trim(), 10);
  return undefined;
};

/** Recover a string, treating null-ish placeholders and nullish values as empty. */
export const salvageStr = (v: unknown) => {
  if (typeof v === 'string') return NULLISH.test(v.trim()) ? '' : v;
  if (v == null) return '';
  return undefined;
};

/** An array of strings that always parses. Falls back to `[]`. Use for comma-delimited token lists (e.g. technologies, items) — a bare string is split on commas. */
export const stringList = z.preprocess(salvageArray, z.array(z.string())).catch([]);

/** An array of strings that always parses. Falls back to `[]`. Use for prose/free-text bullet arrays (e.g. descriptions, achievements) — a bare string becomes a single-element array, not split on commas. */
export const bulletList = z.preprocess(salvageBullets, z.array(z.string())).catch([]);

/** An integer that always parses. Falls back to `fallback`. */
export const intOr = (fallback: number) =>
  z.preprocess(salvageInt, z.number().int()).catch(fallback);

/** A string that always parses. Falls back to `''`. */
export const textOrEmpty = z.preprocess(salvageStr, z.string()).catch('');

/**
 * An "omit to leave unchanged" field that always parses. Null-ish values become
 * `undefined` rather than `null`, so callers can rely on a plain
 * `value !== undefined` check without a stray null wiping the target.
 */
export const optionalOf = <T extends z.ZodTypeAny>(inner: T) =>
  z
    .preprocess(
      (v) => (v == null || (typeof v === 'string' && NULLISH.test(v.trim())) ? undefined : v),
      inner.optional(),
    )
    .catch(undefined);

/** An optional string: absent or null-ish means "leave unchanged". */
export const optionalText = optionalOf(z.string());
