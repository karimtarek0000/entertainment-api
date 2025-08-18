const express = require('express')
const fs = require('fs')
const path = require('path')

const app = express()
const PORT = process.env.PORT || 8080

// Middleware
app.use(express.json())

// Read and write database functions
const dbPath = path.join(process.cwd(), 'db.json')

const readDB = () => {
  try {
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'))
  } catch (error) {
    return {}
  }
}

const writeDB = (data) => {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2))
}

// CORS middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }
  next()
})

// API routes with /api prefix
app.all('/api/:resource?/:id?/:subresource?', (req, res) => {
  const { url, method, body } = req
  // Remove /api from URL parts
  const urlParts = url.split('?')[0].split('/').filter(Boolean).slice(1) // slice(1) removes 'api'

  try {
    const db = readDB()

    if (method === 'GET') {
      if (urlParts.length === 0) {
        return res.json(db)
      }

      const [resource, id, subresource] = urlParts

      if (db[resource]) {
        if (id && subresource === 'bookmarks') {
          // Handle /api/users/:id/bookmarks
          const user = db[resource].find(
            item => item.id === id || item.id === parseInt(id),
          )
          
          if (!user) {
            return res.status(404).json({ error: 'User not found' })
          }

          let bookmarks = user.bookmarks || []
          
          // Apply filtering to bookmarks
          const queryParams = new URL(url, `http://${req.headers.host || 'localhost'}`).searchParams
          
          for (const [key, value] of queryParams.entries()) {
            if (key !== '_limit' && key !== '_page' && key !== '_sort' && key !== '_order') {
              bookmarks = bookmarks.filter(bookmark => {
                if (key === 'title') {
                  // If title is empty, don't filter
                  if (value.trim() === '') {
                    return true
                  }
                  return bookmark.title && bookmark.title.toLowerCase().startsWith(value.toLowerCase())
                }
                
                if (typeof bookmark[key] === 'string') {
                  if (value.trim() === '') {
                    return true
                  }
                  return bookmark[key].toLowerCase().includes(value.toLowerCase())
                }
                return bookmark[key] == value
              })
            }
          }

          // Apply sorting, pagination
          const sortBy = queryParams.get('_sort')
          const order = queryParams.get('_order') || 'asc'
          if (sortBy) {
            bookmarks.sort((a, b) => {
              if (order === 'desc') {
                return b[sortBy] > a[sortBy] ? 1 : -1
              }
              return a[sortBy] > b[sortBy] ? 1 : -1
            })
          }

          const limit = parseInt(queryParams.get('_limit')) || bookmarks.length
          const page = parseInt(queryParams.get('_page')) || 1
          const startIndex = (page - 1) * limit
          const endIndex = startIndex + limit

          bookmarks = bookmarks.slice(startIndex, endIndex)
          return res.json(bookmarks)
        }
        
        if (id) {
          const item = db[resource].find(
            item => item.id === id || item.id === parseInt(id),
          )
          if (item) {
            return res.json(item)
          } else {
            return res.status(404).json({ error: 'Item not found' })
          }
        } else {
          let data = [...db[resource]]

          // Basic filtering, sorting, pagination
          const queryParams = new URL(url, `http://${req.headers.host || 'localhost'}`).searchParams
          
          for (const [key, value] of queryParams.entries()) {
            if (key !== '_limit' && key !== '_page' && key !== '_sort' && key !== '_order') {
              data = data.filter(item => {
                // Special handling for searching bookmarks within users
                if (resource === 'users' && key === 'title') {
                  // If title is empty, don't filter
                  if (value.trim() === '') {
                    return true
                  }
                  
                  // Search in user's bookmarks
                  if (item.bookmarks && Array.isArray(item.bookmarks)) {
                    return item.bookmarks.some(bookmark => 
                      bookmark.title && 
                      bookmark.title.toLowerCase().startsWith(value.toLowerCase())
                    )
                  }
                  return false
                }
                
                // Regular filtering for other resources
                if (typeof item[key] === 'string') {
                  // Handle starts-with search for title, but skip if value is empty
                  if (key === 'title') {
                    // If title is empty, don't filter (return all)
                    if (value.trim() === '') {
                      return true
                    }
                    return item[key].toLowerCase().startsWith(value.toLowerCase())
                  }
                  // Skip filtering if value is empty for other string fields
                  if (value.trim() === '') {
                    return true
                  }
                  return item[key].toLowerCase().includes(value.toLowerCase())
                }
                return item[key] == value
              })
            }
          }

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

      if (!db[resource]) {
        db[resource] = []
      }

      const newItem = {
        id: `${resource}_${Date.now()}`,
        ...body,
      }
      
      db[resource].push(newItem)
      writeDB(db)
      return res.status(201).json(newItem)
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
          writeDB(db)
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
          writeDB(db)
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
})

// Start server on 0.0.0.0 for Railway
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`API available at: http://0.0.0.0:${PORT}/api`)
})
