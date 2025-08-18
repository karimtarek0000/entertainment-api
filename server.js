// ...existing code...
// Read and write database functions
const dbPath = path.join(process.cwd(), 'db.json')

// Helper: determine if a value (string) starts with query (case-insensitive)
const startsWithCI = (field, value) =>
  typeof field === 'string' &&
  field.toLowerCase().startsWith(value.toLowerCase())

// Generic filter helper applied to any array of plain objects
function filterCollection(data, queryParams) {
  const special = new Set(['_limit','_page','_sort','_order'])
  for (const [key, rawValue] of queryParams.entries()) {
    if (special.has(key)) continue
    const value = rawValue.trim()
    if (value === '') continue
    data = data.filter(item => {
      if (!(key in item) || item[key] == null) return false
      const v = item[key]
      if (typeof v === 'string') {
        if (key === 'title') {
          return startsWithCI(v, value)
        }
        return v.toLowerCase().includes(value.toLowerCase())
      }
      return v == value
    })
  }
  return data
}
// ...existing code...
app.all('/:resource?/:id?/:subresource?', (req, res) => {
  const { url, method, body } = req
  const urlParts = url.split('?')[0].split('/').filter(Boolean)

  try {
    const db = readDB()

    if (method === 'GET') {
      if (urlParts.length === 0) {
        return res.json(db)
      }

      const [resource, id, subresource] = urlParts
      const queryParams = new URLSearchParams(url.split('?')[1] || '')

      if (db[resource]) {
        // Nested bookmarks: /users/:id/bookmarks?title=d
        if (id && subresource === 'bookmarks') {
          const user = db[resource].find(
            item => item.id === id || item.id === parseInt(id),
          )
          if (!user) {
            return res.status(404).json({ error: 'User not found' })
          }

            let bookmarks = Array.isArray(user.bookmarks) ? [...user.bookmarks] : []

            // Apply filters (prefix on title, includes on others)
            bookmarks = filterCollection(bookmarks, queryParams)

            // Sorting
            const sortBy = queryParams.get('_sort')
            const order = (queryParams.get('_order') || 'asc').toLowerCase()
            if (sortBy) {
              bookmarks.sort((a, b) => {
                if (a[sortBy] === b[sortBy]) return 0
                return order === 'desc'
                  ? (a[sortBy] > b[sortBy] ? -1 : 1)
                  : (a[sortBy] > b[sortBy] ? 1 : -1)
              })
            }

            // Pagination
            const limit = parseInt(queryParams.get('_limit')) || bookmarks.length
            const page = parseInt(queryParams.get('_page')) || 1
            const start = (page - 1) * limit
            const end = start + limit
            return res.json(bookmarks.slice(start, end))
        }

        if (id) {
          const item = db[resource].find(
            item => item.id === id || item.id === parseInt(id),
          )
          if (item) return res.json(item)
          return res.status(404).json({ error: 'Item not found' })
        }

        // Collection listing with global prefix title search
        let data = [...db[resource]]

        // Special case: searching users by bookmark titles (?title=d)
        const titleQuery = queryParams.get('title')
        if (resource === 'users' && titleQuery && titleQuery.trim() !== '') {
          const q = titleQuery.trim().toLowerCase()
          data = data.filter(u =>
            Array.isArray(u.bookmarks) &&
            u.bookmarks.some(b => b.title && b.title.toLowerCase().startsWith(q))
          )
          // Remove 'title' from further generic filtering (already applied)
          queryParams.delete('title')
        }

        // Generic filtering
        data = filterCollection(data, queryParams)

        // Sorting
        const sortBy = queryParams.get('_sort')
        const order = (queryParams.get('_order') || 'asc').toLowerCase()
        if (sortBy) {
          data.sort((a, b) =>
