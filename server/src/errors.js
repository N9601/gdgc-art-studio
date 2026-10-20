// An error that should reach the client with a specific HTTP status and message.
export class HttpError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields; // optional { fieldName: 'what is wrong' } for form errors
  }
}

export const badRequest = (message, fields) => new HttpError(400, message, fields);
export const unauthorized = (message = 'Please log in first.') => new HttpError(401, message);
export const forbidden = (message = 'Your account is not allowed to do this.') => new HttpError(403, message);
export const notFound = (message = 'Not found.') => new HttpError(404, message);
export const conflict = (message) => new HttpError(409, message);

// Express error handler: every error becomes JSON like { "error": "message" }.
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...(err.fields && { fields: err.fields }) });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'The request body is not valid JSON.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
}
