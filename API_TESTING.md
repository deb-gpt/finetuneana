# API Testing Commands

## Localhost Testing

### 1. List All Indexes
```bash
curl -X GET "http://localhost:3000/api/indexes?t=$(date +%s)" \
  -H "Cache-Control: no-cache"
```

### 2. Debug Environment (Check API Keys & Indexes)
```bash
curl -X GET "http://localhost:3000/api/debug-env"
```

### 3. Get Namespaces for an Index
```bash
curl -X GET "http://localhost:3000/api/index-namespaces?indexName=domain-knowledge"
```

### 4. Query an Index
```bash
curl -X POST "http://localhost:3000/api/query" \
  -H "Content-Type: application/json" \
  -d '{
    "indexName": "domain-knowledge",
    "query": "What is freight logistics?",
    "topK": 5,
    "namespace": "atri_reports"
  }'
```

### 5. Chat with RAG
```bash
curl -X POST "http://localhost:3000/api/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "indexName": "domain-knowledge",
    "query": "Tell me about vehicles",
    "namespace": "atri_reports",
    "topK": 5,
    "systemPrompt": "You are Ana, a helpful assistant."
  }'
```

### 6. Create an Index
```bash
curl -X POST "http://localhost:3000/api/create-index" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-index-2",
    "dimension": 1536,
    "metric": "cosine"
  }'
```

### 7. Delete an Index
```bash
curl -X DELETE "http://localhost:3000/api/index?name=test-index-2"
```

---

## Vercel Production Testing

Replace `https://finetuneana-mgrp.vercel.app` with your actual Vercel URL.

### 1. List All Indexes
```bash
curl -X GET "https://finetuneana-mgrp.vercel.app/api/indexes?t=$(date +%s)" \
  -H "Cache-Control: no-cache"
```

### 2. Debug Environment
```bash
curl -X GET "https://finetuneana-mgrp.vercel.app/api/debug-env"
```

### 3. Get Namespaces
```bash
curl -X GET "https://finetuneana-mgrp.vercel.app/api/index-namespaces?indexName=domain-knowledge"
```

### 4. Query an Index
```bash
curl -X POST "https://finetuneana-mgrp.vercel.app/api/query" \
  -H "Content-Type: application/json" \
  -d '{
    "indexName": "domain-knowledge",
    "query": "What is freight logistics?",
    "topK": 5,
    "namespace": "atri_reports"
  }'
```

### 5. Chat with RAG
```bash
curl -X POST "https://finetuneana-mgrp.vercel.app/api/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "indexName": "domain-knowledge",
    "query": "Tell me about vehicles",
    "namespace": "atri_reports",
    "topK": 5
  }'
```

---

## Postman Collection Format

### For Postman Import:

1. **List Indexes (GET)**
   - Method: GET
   - URL: `{{baseUrl}}/api/indexes?t={{timestamp}}`
   - Headers: `Cache-Control: no-cache`

2. **Debug Environment (GET)**
   - Method: GET
   - URL: `{{baseUrl}}/api/debug-env`

3. **Query Index (POST)**
   - Method: POST
   - URL: `{{baseUrl}}/api/query`
   - Headers: `Content-Type: application/json`
   - Body (raw JSON):
   ```json
   {
     "indexName": "domain-knowledge",
     "query": "What is freight logistics?",
     "topK": 5,
     "namespace": "atri_reports"
   }
   ```

4. **Chat (POST)**
   - Method: POST
   - URL: `{{baseUrl}}/api/chat`
   - Headers: `Content-Type: application/json`
   - Body (raw JSON):
   ```json
   {
     "indexName": "domain-knowledge",
     "query": "Tell me about vehicles",
     "namespace": "atri_reports",
     "topK": 5,
     "systemPrompt": "You are Ana, a helpful assistant."
   }
   ```

---

## Environment Variables for Postman

Create a Postman environment with:
- `baseUrl`: `http://localhost:3000` (for local) or `https://finetuneana-mgrp.vercel.app` (for Vercel)
- `timestamp`: `{{$timestamp}}` (Postman will auto-generate)

---

## Quick Test Commands

### Test if indexes endpoint works:
```bash
# Localhost
curl http://localhost:3000/api/indexes

# Vercel
curl https://finetuneana-mgrp.vercel.app/api/indexes
```

### Test debug endpoint:
```bash
# Localhost
curl http://localhost:3000/api/debug-env

# Vercel
curl https://finetuneana-mgrp.vercel.app/api/debug-env
```

