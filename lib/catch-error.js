// wrapper for async middleware. Eliminates need to catch errors.

/*
Takes a handler (async middleware) as an argument and returns a new middleware
The returned middleware wraps the original handler in a promise and returns the value of the fulfilled promise
Otherwise, if the promise is rejected, the except gets caught by `catch` which will invoke the next middleware function 
*/

const catchError = handler => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

module.exports = catchError;
