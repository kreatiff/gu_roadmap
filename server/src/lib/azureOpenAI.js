import { config } from '../config.js';

/**
 * Calls the Azure OpenAI Chat Completions endpoint and parses the JSON response.
 * Shared by the Jira generation routes and the internal notes AI summary route.
 */
export async function callAzureOpenAI(systemPrompt, userMessage, request) {
  const { endpoint, apiKey, deployment } = config.ai;
  let base = endpoint.replace(/\/$/, '');

  // If the endpoint is configured using the Responses API URL, strip the /responses suffix to route to chat completions
  if (base.endsWith('/responses')) {
    base = base.slice(0, -'/responses'.length);
  }

  // Construct standard v1 chat completions endpoint matching the curl format
  let url = '';
  if (base.includes('/openai/v1/chat/completions')) {
    url = base;
  } else if (base.includes('/openai/v1')) {
    url = `${base}/chat/completions`;
  } else {
    url = `${base}/openai/v1/chat/completions`;
  }

  const headers = {
    'Content-Type': 'application/json',
    'api-key': apiKey,
    'Authorization': `Bearer ${apiKey}`
  };

  const body = {
    model: deployment,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    response_format: { type: 'json_object' }
  };

  request.log.info({ url, model: deployment }, 'Calling Azure OpenAI Chat Completions');

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();
    request.log.error({ status: response.status, body: errText }, 'Azure OpenAI API error');
    throw new Error(`Azure OpenAI error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const outputText = data.choices?.[0]?.message?.content ?? '';

  let parsedOutput;
  try {
    const text = outputText.replace(/```json/gi, '').replace(/```/g, '').trim();
    parsedOutput = JSON.parse(text);
  } catch (e) {
    request.log.error({ outputText }, 'Azure OpenAI did not return valid JSON');
    throw new Error('Azure OpenAI did not return valid JSON');
  }
  return parsedOutput;
}
