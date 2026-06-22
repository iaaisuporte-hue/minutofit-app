# Como usar Google Drive para armazenar vídeos de treino

## Problem: URL do Google Drive não funciona

**Erro comum:** `Erro ao fazer upload do vídeo. Tente novamente.`

**Causa:** URLs do Google Drive no formato `/view` não permitem acesso direto ao vídeo. É necessário converter para `/preview`.

---

## Solução: Converter URL para formato preview

### ❌ URL que NÃO funciona
```
https://drive.google.com/file/d/1abc123def456ghi789/view
```

### ✅ URL que FUNCIONA
```
https://drive.google.com/file/d/1abc123def456ghi789/preview
```

### Passos para obter URL correta

1. **Abra seu vídeo no Google Drive**
2. **Clique em "Compartilhar"** (canto superior direito)
3. **Permissão:** Marque "Qualquer pessoa com o link" ou "Público"
4. **Copie o link** que aparece:
   ```
   https://drive.google.com/file/d/1abc123def456ghi789/view
   ```
5. **Substitua `/view` por `/preview`**:
   ```
   https://drive.google.com/file/d/1abc123def456ghi789/preview
   ```
6. **Cole no campo "URL do Vídeo"** da aplicação

---

## Teste com Modo Mock

Enquanto o backend não está configurado, a aplicação usa **modo de teste** que:
- ✅ Simula upload bem-sucedido
- ✅ Adiciona vídeo à lista local
- ✅ Permite testar a interface completa
- ⚠️ Dados não persistem (recarregar página limpa a lista)

**Para usar modo mock:**
1. Insira dados no formulário de upload
2. Clique "Enviar"
3. Vídeo será adicionado localmente com mensagem: `✓ Vídeo adicionado em modo de teste!`

---

## Quando o Backend está pronto

Para **persistir dados no banco de dados**:

1. **Inicie o servidor backend:**
   ```bash
   cd corefit-backend
   npm run dev
   ```

2. **Certifique-se que PostgreSQL está rodando:**
   ```bash
   # No Linux/Mac
   brew services start postgresql
   
   # No Windows (WSL)
   sudo /etc/init.d/postgresql start
   ```

3. **Crie o arquivo `.env` com:**
   ```
   DATABASE_URL=postgresql://corefit:password@localhost:5432/corefitdb
   JWT_SECRET=seu_secret_aqui
   PORT=3000
   ```

4. **Inicialize o banco:**
   ```bash
   psql -U corefit -d corefitdb -f docs/DATABASE_SCHEMA.sql
   ```

5. **Recarregue a aplicação frontend**
   - Videos agora serão salvos permanentemente no banco de dados
   - Backend retornará confirmação em vez de modo mock

---

## Alternativas a Google Drive

Se o Google Drive continuar com problemas, considere:

### 📌 Azure Blob Storage
```
https://account.blob.core.windows.net/container/video.mp4
```

### 📌 AWS S3
```
https://bucket-name.s3.amazonaws.com/video.mp4
```

### 📌 Vimeo / YouTube
- Mais confiáveis para streaming
- Recomendado para produção
- Permite embed direto

### 📌 Seu próprio servidor
```
https://seu-servidor.com/videos/treino-peito.mp4
```

---

## Checklist de Troubleshooting

- ✓ URL começa com `https://`?
- ✓ URL termina com `/preview` (não `/view`)?
- ✓ Arquivo está compartilhado publicamente?
- ✓ Arquivo é realmente um vídeo (MP4, WebM, MOV)?
- ✓ Arquivo não está muito grande (>500MB)?
- ✓ Backend está rodando (npm run dev)?
- ✓ Token JWT está válido (checkando localStorage)?

---

## Logs de Debug

Para ver erros detalhados:

1. **Abra DevTools** (F12)
2. **Vá para aba "Console"**
3. **Tente upload novamente**
4. **Procure por "Upload error"** nas mensagens
5. **Copie o erro completo e compartilhe**

Exemplo de erro útil:
```
Upload error: Error: Failed fetch - 404 Not Found
```

---

## Teste Rápido (Sem Backend)

Use este URL de vídeo de teste:
```
https://www.w3schools.com/html/mov_bbb.mp4
```

1. Título: "Vídeo de Teste"
2. Descrição: "Video para teste"
3. URL: `https://www.w3schools.com/html/mov_bbb.mp4`
4. Tags: Selecione "Aeróbico" e "HIIT"
5. Clique "Enviar"

Resultado esperado: ✓ Vídeo adicionado em modo de teste!
