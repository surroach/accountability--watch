/**
 * Standardized API response format for reports endpoints
 */

/**
 * Successful response
 */
export function successResponse(data, statusCode = 200) {
  return {
    success: true,
    statusCode,
    data,
    error: null,
  };
}

/**
 * Error response
 */
export function errorResponse(message, statusCode = 400, details = null) {
  return {
    success: false,
    statusCode,
    data: null,
    error: {
      message,
      details,
    },
  };
}

/**
 * Response with file errors (report succeeded but some files failed)
 */
export function partialSuccessResponse(data, fileErrors = [], statusCode = 200) {
  return {
    success: true,
    statusCode,
    data,
    error: null,
    fileErrors: fileErrors.length > 0 ? fileErrors : undefined,
  };
}
