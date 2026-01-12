# Pinecone Index Limits & Namespace Strategy Guide

## Problem: Index Limit Reached

If you encounter this error:
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Request failed. You've reached the max serverless indexes allowed in project Ana (5). Use namespaces to partition your data into logical groups, or upgrade your plan to add more indexes."
  },
  "status": 403
}
```

This means you've hit the maximum number of serverless indexes allowed in your Pinecone project (typically 5 for free/tiered plans).

## Solution: Use Namespaces Instead

**Instead of creating multiple indexes, use ONE index with multiple namespaces.**

### Why Namespaces?

1. **Unlimited**: No limit on number of namespaces per index
2. **Free**: No additional cost
3. **Organized**: Better data partitioning and organization
4. **Flexible**: Query specific namespaces or all namespaces
5. **Efficient**: One index to manage instead of many

### Namespace Strategy

#### Recommended Approach

**Create ONE index per project/environment:**
- `production` - Production data
- `staging` - Staging/test data
- `development` - Development data

**Use namespaces to partition data within each index:**

```
Index: "production"
├── Namespace: "documents" (or "" for default)
├── Namespace: "reports"
├── Namespace: "knowledge-base"
├── Namespace: "user-data"
├── Namespace: "topics/vehicles"
├── Namespace: "topics/infrastructure"
└── Namespace: "sources/atri-reports"
```

### Implementation Examples

#### 1. Creating Data with Namespaces

```python
# Instead of creating multiple indexes:
# ❌ index-1, index-2, index-3, index-4, index-5 (hits limit!)

# Use one index with namespaces:
# ✅ index: "production"
#    - namespace: "documents"
#    - namespace: "reports"
#    - namespace: "knowledge-base"

# Ingest to specific namespace
pinecone_service.upsert_vectors(
    index_name="production",
    vectors=vectors,
    namespace="documents"  # Use namespace instead of separate index
)
```

#### 2. Querying with Namespaces

```python
# Query specific namespace
results = pinecone_service.query_index(
    index_name="production",
    vector=query_vector,
    top_k=10,
    namespace="documents"  # Only search in "documents" namespace
)

# Query default namespace (use None or "")
results = pinecone_service.query_index(
    index_name="production",
    vector=query_vector,
    top_k=10,
    namespace=None  # or namespace=""
)
```

#### 3. Listing Namespaces

```python
# Get all namespaces in an index
namespaces = pinecone_service.get_namespaces("production")
# Returns: ["", "documents", "reports", "knowledge-base"]
```

### Namespace Naming Conventions

**Option 1: By Data Type**
- `"documents"` - General documents
- `"reports"` - Reports and analytics
- `"knowledge-base"` - KB articles
- `"user-data"` - User-specific data

**Option 2: By Topic**
- `"topics/vehicles"`
- `"topics/infrastructure"`
- `"topics/safety"`

**Option 3: By Source**
- `"sources/atri-reports"`
- `"sources/company-docs"`
- `"sources/external-data"`

**Option 4: By Date/Version**
- `"2024-Q1"`
- `"v1.0"`
- `"2024-01"`

**Option 5: Combined**
- `"documents/vehicles"`
- `"reports/2024-Q1"`
- `"knowledge-base/safety"`

### Error Handling in API

When index creation fails with 403:

```python
try:
    result = pinecone_service.create_index(name, dimension, metric)
except Exception as e:
    if "403" in str(e) or "FORBIDDEN" in str(e) or "max serverless indexes" in str(e).lower():
        return {
            "error": "Maximum indexes reached",
            "code": "FORBIDDEN",
            "message": "You've reached the maximum number of serverless indexes allowed.",
            "suggestion": "Use namespaces to partition your data instead. Create one index and use different namespaces (e.g., 'documents', 'reports', 'knowledge-base') to organize your data.",
            "alternative": "Upgrade your Pinecone plan or delete unused indexes."
        }
    raise
```

### Migration Strategy

If you already have multiple indexes:

1. **Keep existing indexes** (don't delete yet)
2. **Create ONE new index** for future data
3. **Use namespaces** in the new index
4. **Gradually migrate** data from old indexes to namespaces in the new index
5. **Delete old indexes** once migration is complete

### Best Practices

1. ✅ **One index per environment** (production, staging, dev)
2. ✅ **Use namespaces for data partitioning**
3. ✅ **Use descriptive namespace names**
4. ✅ **Document your namespace strategy**
5. ✅ **Query specific namespaces when needed**
6. ❌ **Don't create multiple indexes for data partitioning**
7. ❌ **Don't ignore namespace parameter**

### API Usage Examples

#### FastAPI Endpoint

```python
@app.post("/api/ingest")
async def ingest_document(
    file: UploadFile,
    index_name: str,
    namespace: str = None,  # Make namespace prominent!
    topic: str,
    source: str
):
    # Process and upsert to namespace
    result = pinecone_service.upsert_vectors(
        index_name=index_name,
        vectors=vectors,
        namespace=namespace or None  # Use None for default
    )
    return result
```

#### Query with Namespace Filter

```python
@app.post("/api/query")
async def query_index(
    index_name: str,
    query: str,
    namespace: str = None,  # Query specific namespace
    top_k: int = 5
):
    # Query specific namespace
    results = pinecone_service.query_index(
        index_name=index_name,
        vector=query_vector,
        top_k=top_k,
        namespace=namespace or None
    )
    return results
```

### Summary

- **Problem**: Limited to ~5 serverless indexes per project
- **Solution**: Use ONE index + multiple namespaces
- **Benefit**: Unlimited namespaces, better organization, no extra cost
- **Action**: Update your code to use namespaces instead of creating multiple indexes

