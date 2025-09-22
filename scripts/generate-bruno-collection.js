#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Read .env file if it exists
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  const envVars = {};

  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      // Skip comments and empty lines
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          envVars[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
  }

  return envVars;
}

const envVars = loadEnvFile();

// Read OpenAPI spec
const openApiSpec = yaml.load(fs.readFileSync('openapi.yaml', 'utf8'));

// Create collection directory
const collectionDir = 'bruno-collection';
if (!fs.existsSync(collectionDir)) {
  fs.mkdirSync(collectionDir, { recursive: true });
}

// Create bruno.json with correct format
const brunoConfig = {
  version: '1',
  name: openApiSpec.info.title,
  type: 'collection'
};

fs.writeFileSync(
  path.join(collectionDir, 'bruno.json'),
  JSON.stringify(brunoConfig, null, 2)
);

// Create collection.bru
const collectionBru = `meta {
  name: ${openApiSpec.info.title}
  type: collection
}`;

fs.writeFileSync(
  path.join(collectionDir, 'collection.bru'),
  collectionBru
);

// Create environments
const envDir = path.join(collectionDir, 'environments');
if (!fs.existsSync(envDir)) {
  fs.mkdirSync(envDir, { recursive: true });
}

// Local environment - use values from .env file if available
const localEnv = `vars {
  baseUrl: http://localhost:8787
  apiKey: ${envVars.WORKER_API_KEY || 'test-api-key'}
  bearerToken: ${envVars.WORKER_API_KEY || 'test-bearer-token'}
  googleApiKey: ${envVars.GOOGLE_AI_API_KEY || 'your-google-api-key'}
}`;

fs.writeFileSync(
  path.join(envDir, 'local.bru'),
  localEnv
);

// Production environment
const prodEnv = `vars {
  baseUrl: https://cute-bird-slop-machine.example.workers.dev
  apiKey: {{WORKER_API_KEY}}
  bearerToken: {{WORKER_API_KEY}}
}

vars:secret [
  apiKey,
  bearerToken
]`;

fs.writeFileSync(
  path.join(envDir, 'production.bru'),
  prodEnv
);

// Group endpoints by tags
const endpointsByTag = {};

// Process each path
for (const [pathKey, pathValue] of Object.entries(openApiSpec.paths)) {
  for (const [method, operation] of Object.entries(pathValue)) {
    if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
      const tags = operation.tags || ['Other'];
      const tag = tags[0];

      if (!endpointsByTag[tag]) {
        endpointsByTag[tag] = [];
      }

      endpointsByTag[tag].push({
        path: pathKey,
        method,
        operation
      });
    }
  }
}

// Create folders and request files
for (const [tag, endpoints] of Object.entries(endpointsByTag)) {
  const tagDir = path.join(collectionDir, tag);
  if (!fs.existsSync(tagDir)) {
    fs.mkdirSync(tagDir, { recursive: true });
  }

  // Create folder meta file
  const folderMeta = `meta {
  name: ${tag}
  type: folder
}`;

  fs.writeFileSync(
    path.join(tagDir, 'folder.bru'),
    folderMeta
  );

  // Create request files
  for (const endpoint of endpoints) {
    const fileName = `${endpoint.operation.operationId || endpoint.method + '-' + endpoint.path.replace(/[^a-zA-Z0-9]/g, '-')}.bru`;

    let requestContent = `meta {
  name: ${endpoint.operation.summary || endpoint.path}
  type: http
  seq: ${endpoints.indexOf(endpoint) + 1}
}

${endpoint.method.toLowerCase()} {
  url: {{baseUrl}}${endpoint.path}
  body: ${['post', 'put', 'patch'].includes(endpoint.method) ? 'json' : 'none'}
  auth: ${getAuthType(endpoint.operation)}
}
`;

    // Add headers
    if (getAuthType(endpoint.operation) !== 'none') {
      requestContent += `
headers {`;

      if (endpoint.operation.security?.some(s => s.ApiKeyAuth)) {
        requestContent += `
  X-API-Key: {{apiKey}}`;
      }

      if (endpoint.operation.security?.some(s => s.BearerAuth)) {
        requestContent += `
  Authorization: Bearer {{bearerToken}}`;
      }

      if (['post', 'put', 'patch'].includes(endpoint.method)) {
        requestContent += `
  Content-Type: application/json`;
      }

      requestContent += `
}
`;
    } else if (['post', 'put', 'patch'].includes(endpoint.method)) {
      requestContent += `
headers {
  Content-Type: application/json
}
`;
    }

    // Add query parameters
    if (endpoint.operation.parameters?.filter(p => p.in === 'query').length > 0) {
      requestContent += `
params:query {`;

      for (const param of endpoint.operation.parameters.filter(p => p.in === 'query')) {
        const defaultValue = param.schema?.default || (param.schema?.type === 'boolean' ? 'false' : '');
        requestContent += `
  ${param.name}: ${defaultValue}`;
      }

      requestContent += `
}
`;
    }

    // Add path parameters
    if (endpoint.operation.parameters?.filter(p => p.in === 'path').length > 0) {
      requestContent += `
params:path {`;

      for (const param of endpoint.operation.parameters.filter(p => p.in === 'path')) {
        requestContent += `
  ${param.name}: ${param.example || 'YOUR_VALUE_HERE'}`;
      }

      requestContent += `
}
`;
    }

    // Add body examples
    if (['post', 'put', 'patch'].includes(endpoint.method) && endpoint.operation.requestBody) {
      const content = endpoint.operation.requestBody.content?.['application/json'];
      if (content) {
        const example = content.example || content.schema?.example || generateExampleFromSchema(content.schema);
        if (example) {
          requestContent += `
body:json {
${JSON.stringify(example, null, 2).split('\n').map(line => '  ' + line).join('\n').trim()}
}
`;
        }
      }
    }

    // Add description/docs
    if (endpoint.operation.description) {
      requestContent += `
docs {
  ${endpoint.operation.description.replace(/\n/g, '\n  ')}
}
`;
    }

    fs.writeFileSync(
      path.join(tagDir, fileName),
      requestContent
    );
  }
}

function getAuthType(operation) {
  if (!operation.security || operation.security.length === 0) {
    return 'none';
  }

  if (operation.security.some(s => s.BearerAuth)) {
    return 'bearer';
  }

  if (operation.security.some(s => s.ApiKeyAuth)) {
    return 'apikey';
  }

  return 'none';
}

function generateExampleFromSchema(schema) {
  if (!schema) return null;

  if (schema.$ref) {
    const refPath = schema.$ref.split('/').slice(1);
    let refSchema = openApiSpec;
    for (const part of refPath) {
      refSchema = refSchema[part];
    }
    return generateExampleFromSchema(refSchema);
  }

  if (schema.example) return schema.example;

  if (schema.type === 'object' && schema.properties) {
    const obj = {};
    for (const [key, value] of Object.entries(schema.properties)) {
      obj[key] = generateExampleFromSchema(value);
    }
    return obj;
  }

  if (schema.type === 'array' && schema.items) {
    return [generateExampleFromSchema(schema.items)];
  }

  // Generate default examples based on type
  const typeExamples = {
    string: 'example-string',
    number: 123,
    integer: 42,
    boolean: true
  };

  return typeExamples[schema.type] || null;
}

console.log(`✅ Bruno collection generated successfully in ${collectionDir}/`);
console.log('\nTo use this collection:');
console.log('1. Open Bruno app');
console.log('2. Click "Open Collection"');
console.log(`3. Navigate to ${path.resolve(collectionDir)}`);

if (envVars.WORKER_API_KEY || envVars.GOOGLE_AI_API_KEY) {
  console.log('\n📝 Local environment configured with values from .env file:');
  if (envVars.WORKER_API_KEY) console.log('  - WORKER_API_KEY loaded');
  if (envVars.GOOGLE_AI_API_KEY) console.log('  - GOOGLE_AI_API_KEY loaded');
} else {
  console.log('\n⚠️  No .env file found - using default test values for local environment');
}

console.log('\nEndpoints organized by tags:');
for (const tag of Object.keys(endpointsByTag)) {
  console.log(`  - ${tag}: ${endpointsByTag[tag].length} endpoints`);
}