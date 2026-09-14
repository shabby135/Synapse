/** A deliberately small reference language. No JavaScript evaluation. */
export type MappingContext = {
  trigger: Record<string, unknown>;
  input: Record<string, unknown>;
  nodes: Record<string, Record<string, unknown>>;
};

type Connection = { source: string; target: string };
type Token = { start: number; end: number; path: string[] };
const BLOCKED = new Set(["__proto__", "prototype", "constructor"]);
const MAX_LENGTH = 262_144;

export class DataMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataMappingError";
  }
}

export function getAncestorNodeIds(nodeId: string, edges: readonly Connection[]): Set<string> {
  const ancestors = new Set<string>();
  const pending = [nodeId];
  while (pending.length) {
    const target = pending.pop();
    for (const edge of edges) {
      if (edge.target === target && edge.source !== nodeId && !ancestors.has(edge.source)) {
        ancestors.add(edge.source);
        pending.push(edge.source);
      }
    }
  }
  return ancestors;
}

export function parseReference(expression: string): string[] {
  const source = expression.trim();
  const root = /^(trigger|input|nodes)(?=$|\.|\[)/.exec(source);
  if (!root) throw new DataMappingError("References must start with trigger, input, or nodes.");
  const path = [root[0]];
  let rest = source.slice(root[0].length);
  while (rest) {
    const match = /^(?:\.([A-Za-z_$][\w$-]*)|\[(0|[1-9]\d*)\]|\["((?:[^"\\]|\\.)*)"\])/.exec(rest);
    if (!match) throw new DataMappingError("Invalid reference. Use dot fields, numeric array indexes, or double-quoted keys.");
    let key: string;
    try {
      key = match[1] ?? match[2] ?? JSON.parse(`"${match[3]}"`) as string;
    } catch {
      throw new DataMappingError("Invalid quoted reference key.");
    }
    if (BLOCKED.has(key)) throw new DataMappingError("This reference key is not allowed.");
    path.push(key);
    if (path.length > 32) throw new DataMappingError("Reference is too deeply nested.");
    rest = rest.slice(match[0].length);
  }
  if (path[0] === "nodes" && path.length < 2) {
    throw new DataMappingError("Select a specific earlier node, such as nodes[\"node-id\"].text.");
  }
  return path;
}

function tokenize(template: string): Token[] {
  if (template.length > MAX_LENGTH) throw new DataMappingError("Mapping template exceeds 256 KB of text.");
  const tokens: Token[] = [];
  let offset = 0;
  while (offset < template.length) {
    const start = template.indexOf("{{", offset);
    if (start === -1) break;
    const close = template.indexOf("}}", start + 2);
    if (close === -1) throw new DataMappingError("Expression is missing closing braces.");
    tokens.push({ start, end: close + 2, path: parseReference(template.slice(start + 2, close)) });
    if (tokens.length > 100) throw new DataMappingError("Use at most 100 references in one field.");
    offset = close + 2;
  }
  return tokens;
}

function formatValue(value: unknown): string {
  if (typeof value === "string") return value;
  const serialized = JSON.stringify(value, null, 2);
  if (serialized === undefined) throw new DataMappingError("Referenced value is not JSON data.");
  return serialized;
}

function applyTemplate(template: string, lookup: (path: string[]) => unknown, preserveType: boolean): unknown {
  const tokens = tokenize(template);
  const only = tokens[0];
  if (preserveType && tokens.length === 1 && only?.start === 0 && only.end === template.length) {
    const value = lookup(only.path);
    if (formatValue(value).length > MAX_LENGTH) throw new DataMappingError("Resolved value is too large.");
    return value;
  }
  let output = "";
  let offset = 0;
  for (const token of tokens) {
    output += template.slice(offset, token.start) + formatValue(lookup(token.path));
    if (output.length > MAX_LENGTH) throw new DataMappingError("Resolved text is too large.");
    offset = token.end;
  }
  output += template.slice(offset);
  if (output.length > MAX_LENGTH) throw new DataMappingError("Resolved text is too large.");
  return output;
}

export function resolveTemplate(template: string, context: MappingContext, preserveType = false): unknown {
  return applyTemplate(template, (path) => {
    let value: unknown = context;
    for (const key of path) {
      if (value === null || typeof value !== "object" ||
          !Object.prototype.hasOwnProperty.call(value, key)) {
        throw new DataMappingError(`Missing or unavailable reference: ${path.map((part) => JSON.stringify(part)).join(".")}.`);
      }
      value = (value as Record<string, unknown>)[key];
    }
    if (value === undefined) throw new DataMappingError("Referenced value is undefined.");
    return value;
  }, preserveType);
}

export function hasMapping(value: unknown): boolean {
  return typeof value === "string" && value.includes("{{");
}

type Transform = (value: string, preserveType: boolean, field: string) => unknown;

function transformConfiguration(configuration: Record<string, unknown>, transform: Transform): Record<string, unknown> {
  const result = { ...configuration };
  const type = configuration.actionType;
  const fields = type === "AI_PROMPT" ? ["prompt", "systemPrompt"]
    : type === "HTTP_REQUEST" ? ["url", "headersJson", "body"]
    : type === "SLACK_MESSAGE" || type === "DISCORD_MESSAGE" ? ["message"] : [];
  let visited = 0;
  const walk = (value: unknown, field: string, depth = 0): unknown => {
    if (++visited > 10_000 || depth > 32) throw new DataMappingError("Mapping configuration is too large or deeply nested.");
    if (typeof value === "string") return transform(value, true, field);
    if (Array.isArray(value)) return value.map((item) => walk(item, field, depth + 1));
    if (value !== null && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => {
        if (BLOCKED.has(key) || hasMapping(key)) throw new DataMappingError("JSON keys must be static and cannot use reserved property names.");
        return [key, walk(item, field, depth + 1)];
      }));
    }
    return value;
  };
  for (const [field, value] of Object.entries(configuration)) {
    if (!fields.includes(field)) {
      if (hasMapping(value)) throw new DataMappingError(`Expressions are not supported in ${field}.`);
      continue;
    }
    if (field === "headersJson" || field === "body") {
      if (typeof value === "string") {
        let parsed: unknown;
        let isJson = false;
        try { parsed = JSON.parse(value); isJson = true; } catch { /* Plain text or a whole reference. */ }
        if (isJson) result[field] = JSON.stringify(walk(parsed, `${field}.value`));
        else if (hasMapping(value)) {
          const resolved = transform(value, true, field);
          result[field] = typeof resolved === "string" ? resolved : JSON.stringify(resolved);
        }
      } else if (value !== undefined) {
        const resolved = walk(value, `${field}.value`);
        result[field] = field === "body" ? JSON.stringify(resolved) : resolved;
      }
    } else if (typeof value === "string") {
      result[field] = transform(value, false, field);
    }
  }
  return result;
}

export function resolveActionConfiguration(configuration: Record<string, unknown>, context: MappingContext): Record<string, unknown> {
  return transformConfiguration(configuration, (text, preserve) => resolveTemplate(text, context, preserve));
}

/** Validate syntax and graph references before publish; runtime validates actual values. */
export function configurationForPublish(configuration: Record<string, unknown>, ancestors: Set<string>): Record<string, unknown> {
  return transformConfiguration(configuration, (text, preserve, field) => applyTemplate(text, (path) => {
    if (path[0] === "nodes" && !ancestors.has(path[1])) {
      throw new DataMappingError(`Node ${JSON.stringify(path[1])} must be connected before this action.`);
    }
    // Stand-ins validate static configuration while deferring unknown payload types to execution.
    if (field === "url" && text.trim().startsWith("{{")) return "https://example.com";
    if (field === "headersJson" && text.trim().startsWith("{{")) return {};
    return "mapped-value";
  }, preserve));
}
