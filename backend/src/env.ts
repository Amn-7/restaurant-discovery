import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');

const candidates = [
  path.join(backendRoot, '.env.local'),
  path.join(backendRoot, '.env'),
  path.join(backendRoot, '..', '.env.local'),
  path.join(backendRoot, '..', '.env')
];

for (const file of candidates) {
  if (fs.existsSync(file)) {
    loadEnv({ path: file });
    break;
  }
}

