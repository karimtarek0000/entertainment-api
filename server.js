const express = require('express')
const fs = require('fs')
const path = require('path')

const app = express()
const PORT = process.env.PORT || 8080

// Middleware
app.use(express.json())

// DB helpers
const dbPath = path.join(process.cwd(), 'db.json')

const readDB = () => {
  try {
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'))
  } catch {
    return {}
  }
}

const writeDB = (data) => {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2))
}

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }
  next()
})

// Helpers
const SPECIAL = new Set(['_limit','_page','_sort','_order'])

function filterCollection(data, queryParams) {
  for (const [key, raw] of queryParams.entries()) {
    if (SPECIAL.has(key)) continue;

    const value = raw.trim(); // Trim the query parameter value
    if (value === '') continue;

    data = data.filter(item => {
      if (!(key in item) || item[key] == null) return false;

      const v = item[key]; // Current field value
      if (typeof v === 'string') {
        // Normalize both strings and check if the value starts with the query
        return v.trim().toLowerCase().startsWith(value.toLowerCase());
      }
      return v == value; // Compare directly for non-string values
    });
  }
  return data;
}

function applySortPaginate(data, queryParams) {
  const sortBy = queryParams.get('_sort')
  const order = (queryParams.get('_order') || 'asc').toLowerCase()
  if (sortBy) {
    data.sort((a, b) => {
      if (a[sortBy] === b[sortBy]) return 0
      return order === 'desc'
        ? (a[sortBy] > b[sortBy] ? -1 : 1)
        : (a[sortBy] > b[sortBy] ? 1 : -1)
    })
  }
  const limit = parseInt(queryParams.get('_limit')) || data.length
  const page = parseInt(queryParams.get('_page')) || 1
  const start = (page - 1) * limit
  return data.slice(start, start + limit)
}

// Unified route
app.all('/:resource?/:id?/:subresource?', (req, res) => {
  const { url, method, body } = req
  const urlParts = url.split('?')[0].split('/').filter(Boolean)
  try {
    const db = readDB()

    if (method === 'GET') {
      if (urlParts.length === 0) return res.json(db)

      const [resource, id, subresource] = urlParts
      const queryParams = new URLSearchParams(url.split('?')[1] || '')

      if (!db[resource]) return res.status(404).json({ error: 'Resource not found' })

      // /users/:id/bookmarks
      if (id && subresource === 'bookmarks') {
        const user = db[resource].find(it => it.id === id || it.id === parseInt(id))
        if (!user) return res.status(404).json({ error: 'User not found' })
        let bookmarks = Array.isArray(user.bookmarks) ? [...user.bookmarks] : []
        bookmarks = filterCollection(bookmarks, queryParams)
        bookmarks = applySortPaginate(bookmarks, queryParams)
        return res.json(bookmarks)
      }

      // /resource/:id
      if (id) {
        const item = db[resource].find(it => it.id === id || it.id === parseInt(id))
        if (!item) return res.status(404).json({ error: 'Item not found' })
        return res.json(item)
      }

      // /resource
      let data = [...db[resource]]
      data = filterCollection(data, queryParams)
      data = applySortPaginate(data, queryParams)
      return res.json(data)
    }

    if (method === 'POST') {
      const [resource] = urlParts
      if (!resource) return res.status(400).json({ error: 'Resource required' })
      if (!db[resource]) db[resource] = []
      const newItem = { id: `${resource}_${Date.now()}`, ...body }
      db[resource].push(newItem)
      writeDB(db)
      return res.status(201).json(newItem)
    }

    if (method === 'PUT' || method === 'PATCH') {
      const [resource, id] = urlParts
      if (!db[resource]) return res.status(404).json({ error: 'Resource not found' })
      const idx = db[resource].findIndex(it => it.id === id || it.id === parseInt(id))
      if (idx === -1) return res.status(404).json({ error: 'Item not found' })
      if (method === 'PUT') {
        db[resource][idx] = { id: db[resource][idx].id, ...body }
      } else {
        db[resource][idx] = { ...db[resource][idx], ...body }
      }
      writeDB(db)
      return res.json(db[resource][idx])
    }

    if (method === 'DELETE') {
      const [resource, id] = urlParts
      if (!db[resource]) return res.status(404).json({ error: 'Resource not found' })
      const idx = db[resource].findIndex(it => it.id === id || it.id === parseInt(id))
      if (idx === -1) return res.status(404).json({ error: 'Item not found' })
      const deleted = db[resource].splice(idx, 1)[0]
      writeDB(db)
      return res.json(deleted)
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    console.error('API Error:', e)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Start
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
})
