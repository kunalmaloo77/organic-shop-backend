export function successResponse(message = null, data = null, meta = null) {
  return {
    success: true,
    message: message || null,
    data: data === undefined ? null : data,
    meta: meta === undefined ? null : meta,
    errors: null,
  };
}

export function errorResponse(
  message = null,
  errors = null,
  data = null,
  meta = null
) {
  return {
    success: false,
    message: message || null,
    data: data === undefined ? null : data,
    meta: meta === undefined ? null : meta,
    errors: errors || null,
  };
}
