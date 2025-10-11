import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * Converts a Zod schema to JSON Schema with explicit target version
 * @param {import('zod').ZodTypeAny} schema - The Zod schema to convert
 * @param {string} target - The JSON Schema target version ('jsonSchema7' or 'jsonSchema2019-09')
 * @returns {Promise<Object>} The JSON Schema object
 */
export async function convertZodToJSONSchema(schema, target = 'jsonSchema7') {
  // Use zod-to-json-schema directly with target option
  const jsonSchema = zodToJsonSchema(schema, { target });
  
  // Ensure the $schema property is set correctly
  if (target === 'jsonSchema7') {
    jsonSchema.$schema = 'http://json-schema.org/draft-07/schema#';
  } else if (target === 'jsonSchema2019-09') {
    jsonSchema.$schema = 'https://json-schema.org/draft/2019-09/schema#';
  }
  
  return jsonSchema;
}