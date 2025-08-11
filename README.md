# Entertainment API

A JSON Server API for entertainment data that works both locally and on Vercel.

## Local Development

### Using JSON Server (Recommended for development)

```bash
# Install dependencies
npm install

# Start the JSON server with auto-reload
npm run dev

# Or start without auto-reload
npm start
```

The API will be available at `http://localhost:3000`

### Using Vercel Dev (Test Vercel environment locally)

```bash
# Start Vercel development environment
npm run vercel-dev
```

## Deployment to Vercel

1. Install Vercel CLI globally:

```bash
npm install -g vercel
```

2. Deploy to Vercel:

```bash
vercel
```

3. Follow the prompts to deploy your API.

## API Endpoints

### Base URLs

- **Local**: `http://localhost:3000`
- **Vercel**: `https://your-project.vercel.app/api`

### Available Resources

#### Users

- `GET /users` - Get all users
- `GET /users/:id` - Get user by ID
- `POST /users` - Create new user
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Delete user

#### Movies

- `GET /movies` - Get all movies
- `GET /movies/:id` - Get movie by ID
- `POST /movies` - Create new movie
- `PUT /movies/:id` - Update movie
- `DELETE /movies/:id` - Delete movie

#### TV Series

- `GET /tvSeries` - Get all TV series
- `GET /tvSeries/:id` - Get TV series by ID
- `POST /tvSeries` - Create new TV series
- `PUT /tvSeries/:id` - Update TV series
- `DELETE /tvSeries/:id` - Delete TV series

### Query Parameters

#### Filtering

```
GET /movies?category=trending
GET /movies?year=2024
GET /tvSeries?genre=Drama
```

#### Sorting

```
GET /movies?_sort=year&_order=desc
GET /tvSeries?_sort=title&_order=asc
```

#### Pagination

```
GET /movies?_page=1&_limit=10
```

## Examples

### Get all trending movies

```bash
curl "http://localhost:3000/movies?category=trending"
```

### Get a specific movie

```bash
curl "http://localhost:3000/movies/movie_1"
```

### Create a new movie

```bash
curl -X POST "http://localhost:3000/movies" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "New Movie",
    "year": 2024,
    "type": "Movie",
    "category": "trending"
  }'
```

## Data Structure

The API serves data from `db.json` which contains:

- `users` - User accounts with bookmarks
- `movies` - Movie data with metadata
- `tvSeries` - TV series data
- `homepage` - Homepage content data
