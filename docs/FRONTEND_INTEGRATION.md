# CoreFit - Frontend API Integration Guide

## Quick Reference

### Environment Configuration

**File: `.env.local` (create in project root)**
```
VITE_API_URL=http://localhost:3000/api
```

### API Base URL

Update all fetch calls to use the environment variable:

```typescript
const apiUrl = import.meta.env.VITE_API_URL || '/api';
```

## Frontend Integration Points

### 1. Update `useVideos` Hook

**File: `src/hooks/useVideos.ts`**

```typescript
export const useVideos = (options: UseVideosOptions) => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        setLoading(true);
        const apiUrl = import.meta.env.VITE_API_URL || '/api';
        const token = localStorage.getItem('token');

        // Build query string
        let url = `${apiUrl}/videos/search?limit=${options.limit || 10}`;
        if (options.goal) {
          const goalTags = GOAL_TAG_MAPPING[options.goal];
          url += `&tags=${goalTags.join(',')}`;
        } else if (options.tags) {
          url += `&tags=${options.tags.join(',')}`;
        }

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) throw new Error('Failed to fetch videos');

        const data = await response.json();
        setVideos(data.data || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching videos:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        // Fall back to mock data
        setVideos(getMockVideos(options.goal, options.tags, options.limit));
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, [options.goal, options.tags, options.limit]);

  return { videos, loading, error };
};
```

### 2. Update `VideoLibraryPage` Upload Handler

**File: `src/pages/personal/VideoLibraryPage.tsx`**

```typescript
const handleUpload = async (e: React.FormEvent) => {
  e.preventDefault();
  
  if (!title || !videoUrl || selectedTags.length === 0) {
    alert('Please fill all required fields');
    return;
  }

  setIsUploading(true);

  try {
    const apiUrl = import.meta.env.VITE_API_URL || '/api';
    const token = localStorage.getItem('token');

    const response = await fetch(`${apiUrl}/videos/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title,
        description,
        url: videoUrl,
        tags: selectedTags,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }

    const newVideo = await response.json();
    setVideos([newVideo.data, ...videos]);
    
    // Reset form
    setTitle('');
    setDescription('');
    setVideoUrl('');
    setSelectedTags([]);
    
    alert('Video uploaded successfully!');
  } catch (error) {
    console.error('Upload error:', error);
    alert(error instanceof Error ? error.message : 'Upload failed');
  } finally {
    setIsUploading(false);
  }
};
```

### 3. Update `AuthContext` for Token Management

**File: `src/auth/AuthContext.tsx`**

```typescript
// Update login to include JWT token
const login = async (email: string, password: string) => {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || '/api';
    
    const response = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    
    if (data.success) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Login error:', error);
    return false;
  }
};

// Update logout to clear token
const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  setUser(null);
};
```

## API Endpoints Summary

### Authentication
- `POST /auth/login` - Login with email/password
- `POST /auth/register` - Register new user
- `POST /auth/refresh` - Refresh JWT token
- `POST /auth/logout` - Logout

### Videos
- `GET /videos/search?tags=tag1,tag2&limit=10` - Search videos by tags
- `GET /videos/recommendations?goal=weight_loss` - Get recommended videos by goal
- `GET /videos/:id` - Get single video
- `POST /videos/upload` - Upload new video
- `PUT /videos/:id` - Update video metadata
- `DELETE /videos/:id` - Delete video
- `GET /videos/my-videos?page=1&limit=10` - Get current user's videos

### Tags
- `GET /tags` - Get all available tags
- `POST /tags` - Create new tag (admin only)
- `PUT /tags/:id` - Update tag (admin only)
- `DELETE /tags/:id` - Delete tag (admin only)

## JWT Token Flow

```
1. User logs in → Backend validates credentials → Returns JWT token
2. Frontend stores token in localStorage
3. All authenticated requests include: Authorization: Bearer <token>
4. Backend verifies token signature and expiration
5. Token expires in 24 hours (typically)
6. On 401 response, user must re-login
```

## Error Handling Pattern

```typescript
try {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (response.status === 401) {
    // Token expired, redirect to login
    window.location.href = '/login';
    return;
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API request failed');
  }

  const data = await response.json();
  return data;
} catch (error) {
  console.error('API error:', error);
  // Show user-friendly error message
}
```

## Testing with Postman

1. **Set up Postman Collection**
   - Import endpoints from docs/API_ENDPOINTS.md
   - Set `{{base_url}}` to `http://localhost:3000/api`
   - Store JWT token in Postman variable after login

2. **Test Workflow**
   ```
   1. POST /auth/login → Copy token
   2. Set Authorization header: Bearer <token>
   3. GET /tags → Verify available tags
   4. POST /videos/upload → Upload test video
   5. GET /videos/search?tags=aerobico → Verify video appears
   ```

## Development vs Production

### Development (localhost)
```
Frontend: http://localhost:5174/
Backend: http://localhost:3000/
```

### Production (example.com)
```
Frontend: https://app.example.com/
Backend: https://api.example.com/
```

Update VITE_API_URL in `.env.production`:
```
VITE_API_URL=https://api.example.com/api
```

## Common Issues & Solutions

### CORS Errors
**Problem**: "Access to XMLHttpRequest blocked by CORS policy"
**Solution**: Backend needs proper CORS headers:
```typescript
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));
```

### 401 Unauthorized
**Problem**: Token missing or expired
**Solution**: Check localStorage for token, re-login if needed

### Network Timeouts
**Problem**: Long video upload times
**Solution**: Implement chunked uploads or show progress bar

### Video Not Appearing
**Problem**: Upload succeeds but video not in search
**Solution**: Check that tags were properly saved in database

## Next Steps

1. ✅ Implement backend API server (use BACKEND_SETUP.md)
2. ✅ Set up PostgreSQL database with schema
3. ✅ Configure environment variables
4. ✅ Update frontend API URLs
5. ✅ Test with Postman
6. ✅ Deploy backend
7. ✅ Update production API URL
