import { CosmosClient } from '@azure/cosmos';
import { config } from './server/src/config.js';

async function test() {
  try {
    const client = new CosmosClient({ endpoint: config.cosmos.endpoint, key: config.cosmos.key, connectionPolicy: { enableEndpointDiscovery: false } });
    const container = client.database(config.cosmos.databaseId).container('dashboards');
    
    // Attempt to delete
    const id = 'fab48919-4a1e-4bf9-aac2-6ad01f24ace2';
    console.log('Deleting', id);
    await container.item(id, id).delete();
    console.log('Success!');
  } catch (err) {
    console.error('Error:', err.message, err.code);
  }
}
test();
