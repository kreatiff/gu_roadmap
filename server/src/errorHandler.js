/**
 * Centralized error handler for Fastify.
 * Maps technical backend errors (e.g., SQLite constraints) into
 * human-friendly JSON responses for the frontend.
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

  // 1. Handle SQLite specific database errors
  if (error.message?.includes('UNIQUE constraint failed')) {
    statusCode = 400;
    response.code = 'DUPLICATE_ENTRY';
    response.message = 'This record already exists.';
    
    if (error.message.includes('features.slug')) {
      response.message = 'A roadmap feature with a similar title already exists. Please choose a different title.';
    } else if (error.message.includes('votes.user_id, votes.feature_id')) {
      response.message = 'You have already voted for this feature.';
    }
  } else if (error.message?.includes('FOREIGN KEY constraint failed')) {
    statusCode = 404;
    response.code = 'DEPENDENCY_NOT_FOUND';
    response.message = 'A related record could not be found. It may have been recently deleted.';
  } 
  
  // 2. Handle Fastify Validation Errors
  else if (error.validation) {
    statusCode = 400;
    response.code = 'VALIDATION_ERROR';
    response.message = 'The information provided was incomplete or invalid. Please check your inputs.';
  } 
  
  // 3. Handle Standard HTTP Errors
  else if (error.statusCode) {
    statusCode = error.statusCode;
    response.code = error.code || 'HTTP_ERROR';
    response.message = error.message;
  }

  // Send the clean, human-readable response
  reply.code(statusCode).send(response);
};
