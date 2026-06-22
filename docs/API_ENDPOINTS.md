# CoreFit API Endpoints Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication
All endpoints (except login) require a Bearer token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

---

## Video Management Endpoints

### 1. Get All Videos for Personal Trainer
**GET** `/videos/my-videos`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (optional): Number of videos per page (default: 20)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Peito Iniciante",
      "description": "Treino de peito para iniciantes",
      "url": "https://example.com/video.mp4",
      "thumbnail_url": "https://example.com/thumb.jpg",
      "duration_seconds": 1200,
      "personal_id": 5,
      "tags": ["peito", "iniciante", "forca"],
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 45,
    "limit": 20,
    "offset": 0
  }
}
```

---

### 2. Upload Video
**POST** `/videos/upload`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data:**
```
- file: <video file> (required)
- title: "Treino de Peito" (required)
- description: "Descrição do treino" (optional)
- tags: ["peito", "iniciante", "forca"] (required, array of tag slugs)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 42,
    "title": "Treino de Peito",
    "description": "Descrição do treino",
    "url": "https://storage.example.com/videos/video-42.mp4",
    "thumbnail_url": "https://storage.example.com/thumbs/video-42.jpg",
    "duration_seconds": 900,
    "personal_id": 5,
    "tags": ["peito", "iniciante", "forca"],
    "created_at": "2024-03-07T14:20:00Z"
  }
}
```

---

### 3. Get Video by ID
**GET** `/videos/:id`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Peito Iniciante",
    "description": "Treino de peito para iniciantes",
    "url": "https://example.com/video.mp4",
    "thumbnail_url": "https://example.com/thumb.jpg",
    "duration_seconds": 1200,
    "personal_id": 5,
    "tags": ["peito", "iniciante", "forca"],
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

---

### 4. Update Video
**PUT** `/videos/:id`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "title": "Novo Título",
  "description": "Nova descrição",
  "tags": ["peito", "intermediario"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Novo Título",
    "description": "Nova descrição",
    "url": "https://example.com/video.mp4",
    "tags": ["peito", "intermediario"],
    "updated_at": "2024-03-07T14:20:00Z"
  }
}
```

---

### 5. Delete Video
**DELETE** `/videos/:id`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Vídeo deletado com sucesso"
}
```

---

## Tag Management Endpoints

### 6. Get All Tags
**GET** `/tags`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Perda de Peso",
      "slug": "perda-de-peso",
      "description": "Vídeos focados em queimar calorias"
    },
    {
      "id": 2,
      "name": "Ganho de Massa",
      "slug": "ganho-de-massa",
      "description": "Vídeos para ganhar massa muscular"
    }
  ]
}
```

---

## Video Search & Filter Endpoints

### 7. Search Videos by Tags
**GET** `/videos/search`

**Query Parameters:**
- `tags` (required): Comma-separated tag slugs (e.g., `perda-de-peso,aerobico,iniciante`)
- `limit` (optional): Number of results (default: 10)
- `personal_id` (optional): Filter by specific personal trainer

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Treino HIIT para Perda de Peso",
      "tags": ["perda-de-peso", "aerobico", "iniciante"],
      "url": "https://example.com/video.mp4",
      "thumbnail_url": "https://example.com/thumb.jpg",
      "duration_seconds": 1200
    }
  ],
  "total": 12
}
```

---

### 8. Get Recommended Videos (for Suggested Training)
**POST** `/videos/recommendations`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "goal": "weight_loss",
  "level": "iniciante",
  "limit": 5
}
```

**Tag mapping based on suggestions:**
- `weight_loss` → searches for `perda-de-peso`, `aerobico`, `hiit`
- `muscle_gain` → searches for `ganho-de-massa`, `forca`
- `maintenance` → searches for `flexibilidade`, `cardio`, `yoga`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "HIIT para Iniciantes",
      "description": "Treino de alta intensidade",
      "url": "https://example.com/video.mp4",
      "thumbnail_url": "https://example.com/thumb.jpg",
      "duration_seconds": 900,
      "tags": ["perda-de-peso", "aerobico", "iniciante"]
    }
  ]
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "Descrição do erro"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Token inválido ou expirado"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": "Você não tem permissão para acessar este recurso"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Vídeo não encontrado"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Erro interno do servidor"
}
```

---

## Implementation Notes

1. **Video Upload Storage**: Use cloud storage (AWS S3, Google Cloud Storage, or similar) for large video files
2. **Thumbnail Generation**: Automatically generate video thumbnails on upload
3. **Video Duration**: Extract duration from uploaded video metadata
4. **Authentication**: Implement JWT token validation on the backend
5. **Rate Limiting**: Consider rate limiting for uploads to prevent abuse
6. **File Size Limits**: Set max upload size (e.g., 500MB per video)
7. **Supported Formats**: MP4, WebM, MOV, AVI
