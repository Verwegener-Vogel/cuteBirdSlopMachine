/**
 * Error Handler Middleware
 * Centralizes error handling and response formatting
 */

export function handleError(error: unknown): Response {
  console.error('Error:', error);

  return new Response(
    JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }),
    {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
