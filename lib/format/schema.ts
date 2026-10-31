// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

export type Schema = { readonly [keyword: string]: unknown };

export const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const TYPES = ["object", "array", "string", "number", "integer", "boolean", "null"];
const isText = (value: unknown): boolean => typeof value === "string";
const isCount = (value: unknown): boolean => Number.isInteger(value) && (value as number) >= 0;
const isPrimitive = (value: unknown): boolean => value === null || ["string", "number", "boolean"].includes(typeof value);
const isSchema = (value: unknown): boolean => isObject(value);

function isPattern(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    new RegExp(value, "u");
    return true;
  } catch {
    return false;
  }
}

const KEYWORDS: Record<string, (value: unknown) => boolean> = {
  $schema: isText,
  $id: isText,
  title: isText,
  description: isText,
  $comment: isText,
  errorMessage: isText,
  type: (value) => {
    const list: unknown[] = Array.isArray(value) ? value : [value];
    return list.length > 0 && list.every((type) => TYPES.includes(type as string));
  },
  enum: (value) => Array.isArray(value) && value.length > 0 && value.every(isPrimitive),
  const: isPrimitive,
  minLength: isCount,
  maxLength: isCount,
  pattern: isPattern,
  minItems: isCount,
  minProperties: isCount,
  properties: (value) => isObject(value) && Object.values(value).every(isSchema),
  required: (value) => Array.isArray(value) && value.every(isText),
  additionalProperties: (value) => value === false || isSchema(value),
  items: isSchema,
};

const child = (path: string, key: string): string => (path === "" ? key : `${path}.${key}`);
const typesOf = (schema: Schema): unknown[] | undefined => (schema.type === undefined ? undefined : Array.isArray(schema.type) ? schema.type : [schema.type]);
const count = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? "" : "s"}`;

export function schemaKeywordProblems(schema: Schema, path = ""): string[] {
  const at = path === "" ? "the top" : path;
  const problems: string[] = [];
  for (const [keyword, value] of Object.entries(schema)) {
    if (!Object.hasOwn(KEYWORDS, keyword)) problems.push(`the schema uses ${keyword} at ${at}, which this checker doesn't know`);
    else if (!KEYWORDS[keyword]!(value)) problems.push(`the schema's ${keyword} at ${at} is not a value this checker knows`);
  }
  if (problems.length > 0) return problems;
  if (isObject(schema.properties)) for (const [key, field] of Object.entries(schema.properties)) problems.push(...schemaKeywordProblems(field as Schema, child(path, key)));
  if (isObject(schema.additionalProperties)) problems.push(...schemaKeywordProblems(schema.additionalProperties, child(path, "*")));
  if (isObject(schema.items)) problems.push(...schemaKeywordProblems(schema.items, `${path}[]`));
  return problems;
}

function isType(value: unknown, type: unknown): boolean {
  switch (type) {
    case "object":
      return isObject(value);
    case "array":
      return Array.isArray(value);
    case "null":
      return value === null;
    case "integer":
      return Number.isInteger(value);
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    default:
      return typeof value === type;
  }
}

function ownFailures(value: unknown, schema: Schema): string[] {
  const failures: string[] = [];
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) failures.push(`must be one of ${schema.enum.map((v) => JSON.stringify(v)).join(", ")}`);
  if ("const" in schema && value !== schema.const) failures.push(`must be ${JSON.stringify(schema.const)}`);
  if (typeof value === "string") {
    const length = [...value].length;
    if (typeof schema.minLength === "number" && length < schema.minLength) failures.push(`must be at least ${count(schema.minLength, "character")}`);
    if (typeof schema.maxLength === "number" && length > schema.maxLength) failures.push(`must be at most ${count(schema.maxLength, "character")}`);
    if (typeof schema.pattern === "string" && !new RegExp(schema.pattern, "u").test(value)) failures.push(`must match ${schema.pattern}`);
  }
  if (Array.isArray(value) && typeof schema.minItems === "number" && value.length < schema.minItems) failures.push(`must have at least ${count(schema.minItems, "item")}`);
  if (isObject(value) && typeof schema.minProperties === "number" && Object.keys(value).length < schema.minProperties) failures.push(`must have at least ${count(schema.minProperties, "field")}`);
  return failures;
}

export function schemaProblems(value: unknown, schema: Schema, path = ""): string[] {
  const problems: string[] = [];
  const name = path === "" ? "value" : path;
  const types = typesOf(schema);
  const wrongType = types !== undefined && !types.some((type) => isType(value, type));
  const failures = wrongType ? [`must be ${types.join(" or ")}`] : ownFailures(value, schema);
  if (failures.length > 0) problems.push(typeof schema.errorMessage === "string" ? `${name} must be ${schema.errorMessage}` : `${name} ${failures.join(", ")}`);
  if (wrongType) return problems;
  if (isObject(value)) {
    const properties = (isObject(schema.properties) ? schema.properties : {}) as Record<string, Schema>;
    if (Array.isArray(schema.required)) for (const key of schema.required as string[]) if (!Object.hasOwn(value, key)) problems.push(`${child(path, key)} is missing`);
    for (const [key, field] of Object.entries(value)) {
      const fieldSchema = Object.hasOwn(properties, key) ? properties[key] : isObject(schema.additionalProperties) ? (schema.additionalProperties as Schema) : undefined;
      if (fieldSchema !== undefined) problems.push(...schemaProblems(field, fieldSchema, child(path, key)));
      else if (schema.additionalProperties === false) problems.push(`${child(path, key)} is not a known field`);
    }
  }
  if (Array.isArray(value) && isObject(schema.items)) for (const [i, item] of value.entries()) problems.push(...schemaProblems(item, schema.items as Schema, `${path}[${i}]`));
  return problems;
}
