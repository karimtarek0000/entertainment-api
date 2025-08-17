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

// API routes
app.all('/:resource?/:id?', (req, res) => {
  const { url, method, body } = req
  const urlParts = url.split('?')[0].split('/').filter(Boolean)

  try {
    const db = readDB()

    if (method === 'GET') {
      if (urlParts.length === 0) {
        return res.json(db)
      }

      const [resource, id] = urlParts

      if (db[resource]) {
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

          // Basic filtering, sorting, pagination (your existing logic)
          const queryParams = new URL(url, `http://${req.headers.host}`).searchParams
          
          for (const [key, value] of queryParams.entries()) {
            if (key !== '_limit' && key !== '_page' && key !== '_sort' && key !== '_order') {
              data = data.filter(item => {
                if (typeof item[key] === 'string') {
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
        const
