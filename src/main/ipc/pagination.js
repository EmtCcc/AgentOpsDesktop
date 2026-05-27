'use strict';

/**
 * Offset-based pagination for in-memory collections.
 *
 * @param {Map|Array} collection - Data source
 * @param {Object} params
 * @param {number} [params.offset=0] - Number of items to skip
 * @param {number} [params.limit=20] - Max items to return (capped at 100)
 * @param {string} [params.sortBy] - Field to sort by (default: 'createdAt')
 * @param {'asc'|'desc'} [params.sortOrder='desc'] - Sort direction
 * @param {Function} [params.filter] - Optional predicate applied before pagination
 * @returns {{ items: Array, total: number, offset: number, limit: number, hasMore: boolean }}
 */
function paginate(collection, params = {}) {
  const offset = Math.max(0, Number(params.offset) || 0);
  const limit = Math.min(Math.max(1, Number(params.limit) || 20), 100);
  const sortBy = params.sortBy || 'createdAt';
  const sortOrder = params.sortOrder === 'asc' ? 1 : -1;

  let items = collection instanceof Map
    ? Array.from(collection.values())
    : Array.from(collection);

  // Apply optional filter
  if (params.filter) {
    items = items.filter(params.filter);
  }

  // Sort
  items.sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    if (aVal === bVal) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    return (aVal > bVal ? 1 : -1) * sortOrder;
  });

  const total = items.length;
  const paged = items.slice(offset, offset + limit);

  return {
    items: paged,
    total,
    offset,
    limit,
    hasMore: offset + limit < total,
  };
}

module.exports = { paginate };
