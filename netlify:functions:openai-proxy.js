// netlify/functions/openai-proxy.js

// This function acts as a secure proxy to the OpenAI API.
// It retrieves the API key from Netlify environment variables,
// preventing it from being exposed in client-side code.

const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  // Ensure the request is a POST request, as OpenAI API calls are typically POST.
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed', message: 'Only POST requests are supported.' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  // Retrieve the OpenAI API key from Netlify's environment variables.
  // This variable MUST be set in your Netlify project settings.
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY environment variable is not set in Netlify.');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server Configuration Error', message: 'OpenAI API Key is not configured on the server.' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  // Extract the specific OpenAI API path from the query string.
  const openaiPath = event.queryStringParameters.path;

  if (!openaiPath) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Bad Request', message: 'Missing "path" query parameter for OpenAI API endpoint (e.g., chat/completions).' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  let requestBody;
  try {
    // Parse the request body coming from your frontend.
    requestBody = JSON.parse(event.body);
  } catch (parseError) {
    console.error('Netlify Function: Failed to parse incoming request body:', parseError);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Bad Request', message: 'Invalid JSON in request body from client.' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  try {
    // Construct the full OpenAI API URL.
    const openaiApiUrl = `https://api.openai.com/v1/${openaiPath}`;
    console.log(`Netlify Function: Proxying request to: ${openaiApiUrl}`);

    // Make the request to the OpenAI API.
    const openaiResponse = await fetch(openaiApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(requestBody), // Forward the client's payload
    });

    // Attempt to parse the response from OpenAI.
    // Use .text() first, then try to parse as JSON.
    const responseText = await openaiResponse.text();
    let responseData;

    try {
      responseData = JSON.parse(responseText);
    } catch (jsonParseError) {
      // If OpenAI's response is not JSON (e.g., an HTML error page or plain text error)
      console.error(`Netlify Function: OpenAI responded with non-JSON text (status ${openaiResponse.status}):`, responseText);
      return {
        statusCode: openaiResponse.status, // Use OpenAI's status code
        body: JSON.stringify({
          error: 'OpenAI API Error',
          message: `OpenAI returned a non-JSON response or an unexpected error format. Status: ${openaiResponse.status}. Raw response: ${responseText.substring(0, 200)}...`,
          openai_raw_response: responseText // Include raw text for debugging
        }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    // If OpenAI's response was successfully parsed as JSON
    return {
      statusCode: openaiResponse.status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(responseData),
    };

  } catch (error) {
    // Catch any network errors or other unexpected issues during the fetch to OpenAI.
    console.error('Netlify Function: Error during fetch to OpenAI API:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: `Failed to communicate with OpenAI API. Details: ${error.message}`,
      }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
};
