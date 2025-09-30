import { ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

type JsonSchemaLike = {
  type?: unknown;
  anyOf?: unknown;
  oneOf?: unknown;
  allOf?: unknown;
  properties?: Record<string, unknown>;
  required?: unknown;
  [key: string]: unknown;
};

/**
 * Convert a Zod schema into a JSON Schema compatible with MCP expectations.
 * Ensures the root schema is an object and strips top-level union keywords that
 * the current MCP clients reject (anyOf/oneOf/allOf).
 */
export function toMcpJsonSchema<Schema extends ZodTypeAny>(
  schema: Schema,
  description?: string
): Record<string, unknown> {
  const describedSchema = description ? schema.describe(description) : schema;
  const jsonSchema = zodToJsonSchema(describedSchema, {
    strictUnions: true,
  });

  if (!jsonSchema || Array.isArray(jsonSchema) || typeof jsonSchema !== 'object') {
    return {
      type: 'object',
    } satisfies Record<string, unknown>;
  }

  const typedSchema = jsonSchema as JsonSchemaLike;

  // The MCP SDK currently insists on a root object schema for tool inputs.
  typedSchema.type = 'object';

  mergeUnionVariants('anyOf', typedSchema);
  mergeUnionVariants('oneOf', typedSchema);
  mergeUnionVariants('allOf', typedSchema);

  if (!typedSchema.properties) {
    typedSchema.properties = {};
  }

  if (!Array.isArray(typedSchema.required)) {
    if (typedSchema.properties.action) {
      typedSchema.required = ['action'];
    } else {
      typedSchema.required = [];
    }
  }

  return typedSchema as Record<string, unknown>;
}

function mergeUnionVariants(key: 'anyOf' | 'oneOf' | 'allOf', schema: JsonSchemaLike): void {
  const value = schema[key];
  if (!Array.isArray(value) || value.length === 0) {
    delete schema[key];
    return;
  }

  const mergedProperties: Record<string, unknown> = {
    ...(schema.properties ?? {}),
  };

  let requiredIntersection: Set<string> | null = null;
  let sawRequired = false;

  for (const variant of value) {
    if (!variant || typeof variant !== 'object') {
      continue;
    }

    const typedVariant = variant as {
      properties?: Record<string, unknown>;
      required?: unknown;
    };

    if (typedVariant.properties) {
      for (const [propKey, propValue] of Object.entries(typedVariant.properties)) {
        mergePropertySchema(mergedProperties, propKey, propValue);
      }
    }

    if (Array.isArray(typedVariant.required)) {
      sawRequired = true;
      if (requiredIntersection === null) {
        requiredIntersection = new Set(typedVariant.required);
      } else {
        for (const existingKey of Array.from(requiredIntersection)) {
          if (!typedVariant.required.includes(existingKey)) {
            requiredIntersection.delete(existingKey);
          }
        }
      }
    }
  }

  schema.properties = mergedProperties;

  if (requiredIntersection && requiredIntersection.size > 0) {
    schema.required = Array.from(requiredIntersection);
  } else if (!sawRequired && !Array.isArray(schema.required)) {
    if (mergedProperties.action) {
      schema.required = ['action'];
    }
  }

  delete schema[key];
}

function mergePropertySchema(
  target: Record<string, unknown>,
  key: string,
  incoming: unknown
): void {
  const existing = target[key];

  if (!existing || typeof existing !== 'object' || !incoming || typeof incoming !== 'object') {
    target[key] = incoming;
    return;
  }

  const existingObj = existing as Record<string, unknown>;
  const incomingObj = incoming as Record<string, unknown>;

  mergeEnumOrConst(existingObj, incomingObj);
  delete existingObj['$ref'];
  delete incomingObj['$ref'];

  for (const [innerKey, innerValue] of Object.entries(incomingObj)) {
    if (innerKey === 'const') {
      continue;
    }

    if (innerKey === 'enum' && Array.isArray(innerValue)) {
      const existingEnum = Array.isArray(existingObj.enum)
        ? (existingObj.enum as unknown[])
        : [];
      const merged = new Set([...existingEnum, ...innerValue]);
      existingObj.enum = Array.from(merged);
      continue;
    }

    if (!(innerKey in existingObj)) {
      existingObj[innerKey] = innerValue;
    }
  }
}

function mergeEnumOrConst(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>
): void {
  const values = new Set<unknown>();

  collectEnumValues(existing, values);
  collectEnumValues(incoming, values);

  if (values.size > 0) {
    existing.enum = Array.from(values);
    delete existing.const;
    delete incoming.const;
  }
}

function collectEnumValues(schema: Record<string, unknown>, values: Set<unknown>): void {
  if (Array.isArray(schema.enum)) {
    for (const entry of schema.enum) {
      values.add(entry);
    }
  }

  if (schema.const !== undefined) {
    values.add(schema.const);
  }
}
