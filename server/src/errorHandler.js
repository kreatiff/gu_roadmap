/**
 * Centralized error handler for Fastify.
 * Maps technical backend errors into human-friendly JSON responses for the frontend.
 */
export const errorHandler = (error, request, reply) => {
  // Log the raw error for backend debugging
  request.log.error(error);

  const response = {
    error: true,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected problem occurred while processing your request. Please try again later.'
  };

  let statusCode = 500;

  // 1. Handle Fastify Validation Errors
  if (error.validation) {
    statusCode = 400;
    response.code = 'VALIDATION_ERROR';
    response.message = 'The information provided was incomplete or invalid. Please check your inputs.';
  } 
  
  // 2. Handle Standard HTTP Errors
  else if (error.statusCode) {
    statusCode = error.statusCode;
    response.code = error.code || 'HTTP_ERROR';
    response.message = error.message;
  }

  // Send the clean, human-readable response
  reply.code(statusCode).send(response);
};
