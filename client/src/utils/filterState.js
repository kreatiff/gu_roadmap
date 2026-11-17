// Initial value for a multi-select filter on the admin dashboard.
// The URL wins when it carries the param (shared or bookmarked links), otherwise fall
// back to the saved preference from the last visit, otherwise start empty.
//
// This replaces `parseArrayParam(params.get(key)) || saved || []`, which never reached
// the saved preference: parseArrayParam returns [] for a missing param, and [] is truthy.
export const parseArrayParam = (param) => (param ? param.split(',').filter(Boolean) : []);

export const initialArrayFilter = (searchParams, key, saved, parse = parseArrayParam) => {
  if (searchParams.has(key)) return parse(searchParams.get(key));
  return Array.isArray(saved) ? saved : [];
};
