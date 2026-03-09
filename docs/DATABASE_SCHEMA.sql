-- =====================================================
-- MinutoFit - Database Schema
-- PostgreSQL Database Schema for Video Management
-- =====================================================

-- Create Users table (if not exists)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'personal', 'nutri', 'admin')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Videos table
CREATE TABLE IF NOT EXISTS videos (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  url VARCHAR(500) NOT NULL,
  thumbnail_url VARCHAR(500),
  duration_seconds INTEGER,
  personal_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Tags table
CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default tags
INSERT INTO tags (name, slug, description) VALUES
  ('Perda de Peso', 'perda-de-peso', 'Vídeos focados em queimar calorias e perder peso'),
  ('Ganho de Massa', 'ganho-de-massa', 'Vídeos para ganhar massa muscular'),
  ('Aeróbico', 'aerobico', 'Exercícios aeróbicos de alta intensidade'),
  ('Força', 'forca', 'Treinos de força e resistência'),
  ('Iniciante', 'iniciante', 'Vídeos para iniciantes'),
  ('Intermediário', 'intermediario', 'Treinos de nível intermediário'),
  ('Avançado', 'avancado', 'Treinos avançados'),
  ('Flexibilidade', 'flexibilidade', 'Alongamento e mobilidade'),
  ('Yoga', 'yoga', 'Aulas de yoga'),
  ('Pilates', 'pilates', 'Exercícios de pilates'),
  ('HIIT', 'hiit', 'Treinos de alta intensidade'),
  ('Cardio', 'cardio', 'Exercícios cardiovasculares'),
  ('Peito', 'peito', 'Treinos de peito'),
  ('Perna', 'perna', 'Treinos de perna'),
  ('Costas', 'costas', 'Treinos de costas'),
  ('Braços', 'bracos', 'Treinos de braços e bíceps'),
  ('Ombro', 'ombro', 'Treinos de ombro'),
  ('Glúteo', 'gluteo', 'Treinos de glúteos'),
  ('Recuperação', 'recuperacao', 'Vídeos de recuperação e descanso'),
  ('Aquecimento', 'aquecimento', 'Vídeos de aquecimento')
ON CONFLICT (slug) DO NOTHING;

-- Create Video-Tags junction table (many-to-many)
CREATE TABLE IF NOT EXISTS video_tags (
  video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (video_id, tag_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_videos_personal_id ON videos(personal_id);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at);
CREATE INDEX IF NOT EXISTS idx_video_tags_video_id ON video_tags(video_id);
CREATE INDEX IF NOT EXISTS idx_video_tags_tag_id ON video_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_tags_slug ON tags(slug);

-- =====================================================
-- Sample queries for common operations
-- =====================================================

-- Get all videos for a personal trainer
-- SELECT v.* FROM videos v WHERE v.personal_id = $1 ORDER BY v.created_at DESC;

-- Get videos by tag
-- SELECT DISTINCT v.* FROM videos v
-- JOIN video_tags vt ON v.id = vt.video_id
-- JOIN tags t ON vt.tag_id = t.id
-- WHERE t.slug = $1
-- ORDER BY v.created_at DESC;

-- Get videos by multiple tags
-- SELECT DISTINCT v.* FROM videos v
-- JOIN video_tags vt ON v.id = vt.video_id
-- JOIN tags t ON vt.tag_id = t.id
-- WHERE t.slug = ANY($1::text[])
-- GROUP BY v.id
-- HAVING COUNT(DISTINCT t.id) = array_length($1::text[], 1)
-- ORDER BY v.created_at DESC;

-- Get all tags
-- SELECT * FROM tags ORDER BY name ASC;

-- Get videos by goal type
-- SELECT DISTINCT v.* FROM videos v
-- JOIN video_tags vt ON v.id = vt.video_id
-- JOIN tags t ON vt.tag_id = t.id
-- WHERE (t.slug = 'perda-de-peso' OR t.slug = 'ganho-de-massa' OR t.slug = 'intermediario')
-- ORDER BY v.created_at DESC LIMIT 10;
