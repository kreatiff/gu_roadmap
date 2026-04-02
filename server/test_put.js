import fetch from 'node-fetch';

async function test() {
  const res = await fetch('http://localhost:3001/api/features/feat_1', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      // Admin cookie/token might be needed if requireAdmin is on.
      // In this dev env, maybe it's bypassed or there's a default?
      // Check auth.js
    },
    body: JSON.stringify({
      impact: 4,
      effort: 2,
      priority: 'High'
    })
  });
  
  const data = await res.json();
  console.log('Status:', res.status);
  console.log('Data:', data);
}

test();
