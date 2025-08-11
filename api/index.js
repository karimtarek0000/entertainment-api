const fs = require('fs')
const path = require('path')

// Read the db.json file
const dbPath = path.join(process.cwd(), 'db.json')
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'))

module.exports = (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  )
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  const { url, method, body } = req
  const urlParts = url.split('?')[0].split('/').filter(Boolean)

  // Remove 'api' from the path if present
  if (urlParts[0] === 'api') {
    urlParts.shift()
  }

  try {
    if (method === 'GET') {
      if (urlParts.length === 0) {
        // Return entire database
        return res.json(db)
      }

      const [resource, id] = urlParts

      if (db[resource]) {
        if (id) {
          // Return specific item
          const item = db[resource].find(
            item => item.id === id || item.id === parseInt(id),
          )
          if (item) {
            return res.json(item)
          } else {
            return res.status(404).json({ error: 'Item not found' })
          }
        } else {
          // Handle query parameters for filtering, sorting, pagination
          const queryParams = new URL(url, `http://${req.headers.host}`)
            .searchParams
          let data = [...db[resource]]

          // Basic filtering
          for (const [key, value] of queryParams.entries()) {
            if (
              key !== '_limit' &&
              key !== '_page' &&
              key !== '_sort' &&
              key !== '_order'
            ) {
              data = data.filter(item => {
                if (typeof item[key] === 'string') {
                  return item[key].toLowerCase().includes(value.toLowerCase())
                }
                return item[key] == value
              })
            }
          }

          // Sorting
          const sortBy = queryParams.get('_sort')
          const order = queryParams.get('_order') || 'asc'
          if (sortBy) {
            data.sort((a, b) => {
              if (order === 'desc') {
                return b[sortBy] > a[sortBy] ? 1 : -1
              }
              return a[sortBy] > b[sortBy] ? 1 : -1
            })
          }

          // Pagination
          const limit = parseInt(queryParams.get('_limit')) || data.length
          const page = parseInt(queryParams.get('_page')) || 1
          const startIndex = (page - 1) * limit
          const endIndex = startIndex + limit

          data = data.slice(startIndex, endIndex)

          return res.json(data)
        }
      } else {
        return res.status(404).json({ error: 'Resource not found' })
      }
    }

    if (method === 'POST') {
      const [resource] = urlParts

      if (db[resource]) {
        const newItem = {
          id: `${resource}_${Date.now()}`,
          ...body,
        }
        db[resource].push(newItem)
        return res.status(201).json(newItem)
      } else {
        return res.status(404).json({ error: 'Resource not found' })
      }
    }

    if (method === 'PUT' || method === 'PATCH') {
      const [resource, id] = urlParts

      if (db[resource]) {
        const itemIndex = db[resource].findIndex(
          item => item.id === id || item.id === parseInt(id),
        )
        if (itemIndex !== -1) {
          if (method === 'PUT') {
            db[resource][itemIndex] = { id, ...body }
          } else {
            db[resource][itemIndex] = { ...db[resource][itemIndex], ...body }
          }
          return res.json(db[resource][itemIndex])
        } else {
          return res.status(404).json({ error: 'Item not found' })
        }
      } else {
        return res.status(404).json({ error: 'Resource not found' })
      }
    }

    if (method === 'DELETE') {
      const [resource, id] = urlParts

      if (db[resource]) {
        const itemIndex = db[resource].findIndex(
          item => item.id === id || item.id === parseInt(id),
        )
        if (itemIndex !== -1) {
          const deletedItem = db[resource].splice(itemIndex, 1)[0]
          return res.json(deletedItem)
        } else {
          return res.status(404).json({ error: 'Item not found' })
        }
      } else {
        return res.status(404).json({ error: 'Resource not found' })
      }
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('API Error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
