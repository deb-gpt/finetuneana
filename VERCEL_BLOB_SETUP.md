# Vercel Blob Storage Setup for Large File Uploads

## Problem
Vercel has a **4.5MB limit** on serverless function request body size. This prevents direct upload of large PDFs through the `/api/ingest` endpoint.

## Solution
We use **Vercel Blob Storage** to handle large files:
1. Files > 4MB are uploaded to Vercel Blob first
2. Then processed from the blob URL
3. Files < 4MB use direct upload (faster)

## Setup Instructions

### 1. Create Vercel Blob Store

1. Go to your Vercel project dashboard
2. Navigate to **Storage** tab
3. Click **Create Database** → Select **Blob**
4. Give it a name (e.g., "ana-file-storage")
5. Vercel will automatically add environment variables:
   - `BLOB_READ_WRITE_TOKEN` - Added automatically

### 2. Environment Variables

After creating the blob store, Vercel automatically adds:
```
BLOB_READ_WRITE_TOKEN=vercel_blob_xxxxx...
```

**No manual configuration needed!** Vercel handles this automatically.

### 3. How It Works

#### For Files < 4MB:
- Direct upload to `/api/ingest`
- Faster processing
- No blob storage needed

#### For Files > 4MB:
1. Client uploads to `/api/upload-blob` → Gets blob URL
2. Client calls `/api/ingest-from-blob` with blob URL
3. Server downloads from blob, processes, and ingests to Pinecone

### 4. Code Flow

```typescript
// In MultiFileIngestionControls.tsx
if (fileSizeMB > 4.0) {
  // Upload to blob
  const blobResponse = await fetch('/api/upload-blob', { ... });
  const { url } = await blobResponse.json();
  
  // Process from blob
  await fetch('/api/ingest-from-blob', {
    body: JSON.stringify({ blobUrl: url, ... })
  });
} else {
  // Direct upload
  await fetch('/api/ingest', { body: formData });
}
```

## Benefits

✅ **No 4.5MB limit** - Can upload files of any size  
✅ **Automatic handling** - Client automatically chooses the right method  
✅ **Seamless UX** - User doesn't need to know about the limit  
✅ **Cost-effective** - Only uses blob for large files  

## Testing

1. Try uploading a small file (< 4MB) - should use direct upload
2. Try uploading a large file (> 4MB) - should use blob storage
3. Check logs to see which method was used

## Troubleshooting

**Error: "BLOB_READ_WRITE_TOKEN is not set"**
- Make sure you've created a Blob store in Vercel dashboard
- Environment variable is added automatically

**Error: "Failed to upload to blob"**
- Check Vercel Blob store is active
- Verify `@vercel/blob` package is installed
- Check network connectivity

**Files still failing at 4.5MB**
- Make sure the client-side check uses 4.0MB threshold (safer than 4.5MB)
- Verify blob upload is working before processing

