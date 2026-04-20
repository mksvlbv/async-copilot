/**
 * Retry mechanism with exponential backoff
 * 
 * @param fn - The async function to retry
 * @param options - Configuration options
 * @param options.maxAttempts - Maximum number of attempts (default: 3)
 * @param options.baseDelay - Base delay in milliseconds (default: 1000)
 * @param options.maxDelay - Maximum delay in milliseconds (default: 10000)
 * @param options.retryOn - Optional function to determine if we should retry based on error
 * @returns The result of the function if successful
 * @throws The last error if all attempts fail
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelay?: number;
    maxDelay?: number;
    retryOn?: (error: unknown) => boolean;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    retryOn = () => true, // retry on any error by default
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // If this is the last attempt, don't retry
      if (attempt === maxAttempts - 1) {
        break;
      }

      // Check if we should retry based on the error
      if (!retryOn(error)) {
        break;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(
        baseDelay * 2 ** attempt + Math.random() * 100,
        maxDelay
      );

      // Wait for the delay before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}