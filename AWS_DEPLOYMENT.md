# AWS Deployment Guide

This Next.js application can be deployed to AWS using several methods. Here are the recommended options:

## Option 1: AWS Amplify (Recommended - Easiest)

AWS Amplify is the easiest option, similar to Vercel but with AWS infrastructure.

### Advantages:
- ✅ Easy setup (similar to Vercel)
- ✅ Automatic CI/CD from Git
- ✅ Built-in environment variable management
- ✅ Better file size limits (up to 10MB)
- ✅ Longer function timeouts (up to 30 seconds, can be extended)
- ✅ Free tier available

### Steps:

1. **Install AWS CLI** (if not already installed):
   ```bash
   # Windows
   winget install Amazon.AWSCLI
   
   # Or download from: https://aws.amazon.com/cli/
   ```

2. **Create AWS Account** and configure AWS CLI:
   ```bash
   aws configure
   # Enter your AWS Access Key ID
   # Enter your AWS Secret Access Key
   # Enter default region (e.g., us-east-1)
   # Enter default output format (json)
   ```

3. **Install Amplify CLI**:
   ```bash
   npm install -g @aws-amplify/cli
   ```

4. **Initialize Amplify in your project**:
   ```bash
   cd finetuneana
   amplify init
   ```
   - Choose your editor
   - Choose app type: JavaScript
   - Framework: Next.js
   - Source directory: `.`
   - Build directory: `.next`
   - Distribution directory: `out` (for static export) or `.next` (for SSR)

5. **Add hosting**:
   ```bash
   amplify add hosting
   ```
   - Choose: Hosting with Amplify Console
   - Choose: Manual deployment

6. **Configure environment variables** in AWS Amplify Console:
   - Go to AWS Amplify Console → Your App → Environment variables
   - Add:
     - `PINECONE_API_KEY`: Your Pinecone API key
     - `OPENAI_API_KEY`: Your OpenAI API key
     - `NODE_ENV`: `production`

7. **Deploy**:
   ```bash
   amplify publish
   ```

### Configuration File (amplify.yml):

Create `amplify.yml` in the root directory:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

### Update next.config.js for Amplify:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // Amplify allows up to 10MB
    },
  },
  // For Amplify, you might want to output standalone
  output: 'standalone', // Optional, for better serverless performance
}

module.exports = nextConfig
```

---

## Option 2: AWS Lambda + API Gateway (Serverless)

For more control and better scalability.

### Advantages:
- ✅ True serverless (pay per request)
- ✅ Better file size limits (up to 6MB for API Gateway, 10MB for Lambda)
- ✅ Longer timeouts (up to 15 minutes for Lambda)
- ✅ More cost-effective for low traffic

### Steps:

1. **Install Serverless Framework**:
   ```bash
   npm install -g serverless
   ```

2. **Create serverless.yml**:
   ```yaml
   service: ana-memory-creation

   provider:
     name: aws
     runtime: nodejs18.x
     region: us-east-1
     timeout: 300 # 5 minutes
     memorySize: 1024
     environment:
       PINECONE_API_KEY: ${env:PINECONE_API_KEY}
       OPENAI_API_KEY: ${env:OPENAI_API_KEY}
       NODE_ENV: production

   functions:
     api:
       handler: serverless-handler.handler
       events:
         - http:
             path: /{proxy+}
             method: ANY
             cors: true

   plugins:
     - serverless-nextjs-plugin
   ```

3. **Install Next.js serverless plugin**:
   ```bash
   npm install --save-dev serverless-nextjs-plugin
   ```

4. **Deploy**:
   ```bash
   serverless deploy
   ```

---

## Option 3: AWS ECS/Fargate (Containerized)

For maximum control and no serverless limitations.

### Advantages:
- ✅ No file size limits (only your container memory)
- ✅ No timeout limits
- ✅ Full control over environment
- ✅ Can handle very large files

### Steps:

1. **Create Dockerfile**:
   ```dockerfile
   FROM node:18-alpine AS base

   # Install dependencies only when needed
   FROM base AS deps
   RUN apk add --no-cache libc6-compat
   WORKDIR /app
   COPY package.json package-lock.json* ./
   RUN npm ci

   # Rebuild the source code only when needed
   FROM base AS builder
   WORKDIR /app
   COPY --from=deps /app/node_modules ./node_modules
   COPY . .
   RUN npm run build

   # Production image, copy all the files and run next
   FROM base AS runner
   WORKDIR /app
   ENV NODE_ENV production
   RUN addgroup --system --gid 1001 nodejs
   RUN adduser --system --uid 1001 nextjs

   COPY --from=builder /app/public ./public
   COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
   COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

   USER nextjs
   EXPOSE 3000
   ENV PORT 3000
   CMD ["node", "server.js"]
   ```

2. **Update next.config.js**:
   ```javascript
   const nextConfig = {
     output: 'standalone', // Required for Docker
     experimental: {
       serverActions: {
         bodySizeLimit: '50mb', // Can be larger in containers
       },
     },
   }
   ```

3. **Build and push to ECR**:
   ```bash
   # Build Docker image
   docker build -t ana-memory-creation .
   
   # Tag for ECR
   aws ecr create-repository --repository-name ana-memory-creation
   docker tag ana-memory-creation:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/ana-memory-creation:latest
   
   # Push to ECR
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
   docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/ana-memory-creation:latest
   ```

4. **Deploy to ECS/Fargate** using AWS Console or CLI

---

## Option 4: AWS App Runner (Simplest Container Option)

Easiest way to run containers on AWS.

### Advantages:
- ✅ Very easy setup
- ✅ Automatic scaling
- ✅ No infrastructure management
- ✅ Good file size limits

### Steps:

1. **Create Dockerfile** (same as ECS option above)

2. **Push to ECR** (same as ECS option)

3. **Create App Runner service** via AWS Console:
   - Go to AWS App Runner
   - Create service
   - Choose container from ECR
   - Configure environment variables
   - Deploy

---

## Recommended: AWS Amplify

For your use case, **AWS Amplify** is the best choice because:
- ✅ Easiest migration from Vercel
- ✅ Better file size limits (10MB vs 4.5MB)
- ✅ Similar developer experience
- ✅ Built-in CI/CD
- ✅ Free tier available

## Environment Variables Needed

Regardless of deployment method, you need these environment variables:

```env
PINECONE_API_KEY=your_pinecone_api_key
OPENAI_API_KEY=your_openai_api_key
NODE_ENV=production
```

## File Size Considerations

- **Vercel**: 4.5MB limit (current)
- **AWS Amplify**: 10MB limit
- **AWS Lambda**: 6MB (API Gateway) / 10MB (Lambda)
- **AWS ECS/App Runner**: No hard limit (only memory)

## Cost Comparison

- **AWS Amplify**: Free tier (1000 build minutes/month), then ~$0.01 per build
- **AWS Lambda**: Pay per request (~$0.20 per 1M requests)
- **AWS ECS/Fargate**: ~$0.04 per vCPU-hour + memory
- **AWS App Runner**: ~$0.007 per vCPU-hour + memory

## Migration Checklist

1. ✅ Update `next.config.js` for AWS
2. ✅ Set environment variables in AWS Console
3. ✅ Update file size limits in code (if needed)
4. ✅ Test deployment
5. ✅ Update CORS settings (if needed)
6. ✅ Test all API endpoints
7. ✅ Verify Pinecone/OpenAI connections

## Need Help?

If you want help setting up any of these options, let me know which one you prefer!


