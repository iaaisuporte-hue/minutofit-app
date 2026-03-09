# MinutoFit - Backend Setup Guide

## Overview

This guide explains how to set up the backend infrastructure for MinutoFit's video management system using Node.js/Express and PostgreSQL.

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 12+
- Git
- Postman (optional, for API testing)

## Database Setup

### 1. Create PostgreSQL Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE minutofitdb;
CREATE USER minutofit WITH PASSWORD 'your_secure_password';
ALTER ROLE minutofit SET client_encoding TO 'utf8';
ALTER ROLE minutofit SET default_transaction_isolation TO 'read committed';
ALTER ROLE minutofit SET default_transaction_deferrable TO on;
ALTER ROLE minutofit SET default_transaction_deferrable TO on;
GRANT ALL PRIVILEGES ON DATABASE minutofitdb TO minutofit;
\q
```

### 2. Run Database Schema

```bash
# Connect to the database
psql -U minutofit -d minutofitdb -f docs/DATABASE_SCHEMA.sql
```

## Backend Setup (Express + TypeScript)

### 1. Create Backend Project

```bash
mkdir minutofit-backend
cd minutofit-backend
npm init -y
```

### 2. Install Dependencies

```bash
npm install express cors dotenv pg typescript ts-node @types/express @types/node
npm install --save-dev tsc-watch
```

### 3. Create Environment File

Create `.env`:
```
PORT=3000
DATABASE_URL=postgresql://minutofit:your_secure_password@localhost:5432/minutofitdb
JWT_SECRET=your_jwt_secret_key_here
STORAGE_BUCKET=your-aws-bucket-name
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
NODE_ENV=development
```

### 4. Example Backend Structure

#### `src/app.ts`
```typescript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import videoRoutes from './routes/videos';
import tagRoutes from './routes/tags';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ limit: '500mb' }));

// Routes
app.use('/api/videos', videoRoutes);
app.use('/api/tags', tagRoutes);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
```

#### `src/routes/videos.ts` (Example)
```typescript
import express, { Router } from 'express';
import { Pool } from 'pg';

const router = Router();

// Initialize database pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// GET /api/videos/search
router.get('/search', async (req, res) => {
  try {
    const { tags, limit = 10 } = req.query;
    
    if (!tags) {
      return res.status(400).json({ success: false, error: 'Tags required' });
    }

    const tagArray = (tags as string).split(',');
    
    const query = `
      SELECT DISTINCT v.*, array_agg(t.slug) as tags
      FROM videos v
      JOIN video_tags vt ON v.id = vt.video_id
      JOIN tags t ON vt.tag_id = t.id
      WHERE t.slug = ANY($1)
      GROUP BY v.id
      ORDER BY v.created_at DESC
      LIMIT $2
    `;

    const result = await pool.query(query, [tagArray, limit]);
    
    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// POST /api/videos/upload
router.post('/upload', async (req, res) => {
  try {
    const { title, description, url, tags } = req.body;
    const personal_id = req.user?.id; // From JWT middleware

    if (!title || !url || !tags || tags.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    // Insert video
    const videoResult = await pool.query(
      'INSERT INTO videos (title, description, url, personal_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, description || null, url, personal_id]
    );

    const videoId = videoResult.rows[0].id;

    // Get tag IDs and insert video_tags
    for (const tagSlug of tags) {
      const tagResult = await pool.query(
        'SELECT id FROM tags WHERE slug = $1',
        [tagSlug]
      );

      if (tagResult.rows.length > 0) {
        const tagId = tagResult.rows[0].id;
        await pool.query(
          'INSERT INTO video_tags (video_id, tag_id) VALUES ($1, $2)',
          [videoId, tagId]
        );
      }
    }

    res.json({
      success: true,
      data: {
        ...videoResult.rows[0],
        tags,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

export default router;
```

### 5. Update `package.json` Scripts

```json
{
  "scripts": {
    "dev": "tsc-watch --onSuccess \"node dist/app.js\"",
    "build": "tsc",
    "start": "node dist/app.js"
  }
}
```

### 6. Create TypeScript Config

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

## Frontend Configuration

Update your `.env` or create `.env.local` in the frontend project:

```
VITE_API_URL=http://localhost:3000/api
```

Then update your API calls:

```typescript
// In useVideos hook
const apiUrl = import.meta.env.VITE_API_URL || '/api';

const response = await fetch(`${apiUrl}/videos/search?${url}`, {
  headers: {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  },
});
```

## Running the Application

### Terminal 1: Backend
```bash
cd minutofit-backend
npm run dev
```

### Terminal 2: Frontend
```bash
cd minutofit-app
npm run dev
```

## Testing the API

### Get Videos by Tags
```bash
curl -X GET "http://localhost:3000/api/videos/search?tags=perda-de-peso,aerobico&limit=5" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Upload Video
```bash
curl -X POST "http://localhost:3000/api/videos/upload" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Treino HIIT",
    "description": "Treino de alta intensidade",
    "url": "https://example.com/video.mp4",
    "tags": ["perda-de-peso", "aerobico", "hiit"]
  }'
```

## Production Deployment

### Using AWS/Heroku

1. **Create database on AWS RDS or Heroku Postgres**
2. **Deploy backend to Heroku/AWS Lambda**
3. **Update frontend API URL to production backend**
4. **Set up SSL certificates**
5. **Configure CORS for production domain**

Example Heroku deployment:
```bash
heroku create minutofit-backend
heroku addons:create heroku-postgresql:standard-0
heroku config:set JWT_SECRET=your_production_secret
git push heroku main
```

## Migration & Maintenance

Run migrations after schema changes:

```sql
-- Example migration
ALTER TABLE videos ADD COLUMN views_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN last_login TIMESTAMP;
```

## Security Considerations

1. ✅ Validate all input on backend
2. ✅ Implement JWT authentication
3. ✅ Use HTTPS in production
4. ✅ Add rate limiting  
5. ✅ Validate file types and sizes
6. ✅ Use environment variables for secrets
7. ✅ Implement CORS properly
8. ✅ Add SQL injection prevention (use parameterized queries)

## Next Steps

1. Implement JWT authentication middleware
2. Add file upload handling (AWS S3)
3. Implement video transcoding
4. Add email notifications
5. Set up CI/CD pipeline
6. Add logging and monitoring
7. Implement caching (Redis)
