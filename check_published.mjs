import { CosmosClient } from '@azure/cosmos';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const client = new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT, key: process.env.COSMOS_KEY });
const { resources } = await client.database(process.env.COSMOS_DATABASE_ID).container('features')
  .items.query('SELECT c.title, c.is_published FROM c').fetchAll();
console.log('Total features:', resources.length);
const pub = resources.filter(f => f.is_published === true).length;
const unpub = resources.filter(f => f.is_published !== true).length;
console.log('Published (is_published=true):', pub);
console.log('Unpublished/missing flag:', unpub);
resources.slice(0,5).forEach(f => console.log(' -', f.title, '| is_published:', f.is_published));
