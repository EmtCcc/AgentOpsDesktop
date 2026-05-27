'use strict';

/**
 * Simple in-memory pagination for Map-based stores.
 *
 * @param {Map} store - The Map to paginate
 * @param {Object} params
 * @param {number} [params.offset=0] - Number of items to skip
 * @param {number} [params.limit=50] - Max items to return
 * @param {string} [params.sortBy] - Field to sort by (default: createdAt)
 * @param {string} [params.sortOrder='desc'] - 'asc' or 'desc'
 * @param {Function} [params.filter] - Optional filter function
 * @returns {{ items: Array, total: number, offset: number, limit: number }}
 */
function paginate(store, params = {}) {
  const { offset = 0, limit = 50, sortBy = 'createdAt', sortOrder = 'desc', filter } = params;

  let items = Array.from(store.values());

  if (filter) {
    items = items.filter(filter);
  }

  const total = items.length;

  // Sort
  items.sort((a, b) => {
    const aVal = a[sortBy] ?? 0;
    const bVal = b[sortBy] ?? 0;
    const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortOrder === 'desc' ? -cmp : cmp;
  });

  // Slice
  items = items.slice(offset, offset + limit);

  return { items, total, offset, limit };
}

module.exports = { paginate };
