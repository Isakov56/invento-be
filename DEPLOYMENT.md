# 🚀 Vercel Deployment Guide

## Prerequisites
- ✅ Neon database connected and working
- ✅ Backend code pushed to GitHub
- ✅ Vercel account created

---

## Step 1: Push Latest Changes to GitHub

```bash
git add .
git commit -m "Prepare backend for Vercel deployment"
git push origin main
```

---

## Step 2: Deploy to Vercel

### Option A: Using Vercel Dashboard (Recommended for First Deploy)

1. **Go to Vercel:** https://vercel.com/dashboard
2. **Click "Add New Project"**
3. **Import your GitHub repository:**
   - Select your `retail-pos-system` repository
   - **Root Directory:** Click "Edit" and set to `backend`
4. **Configure Project:**
   - **Framework Preset:** Other
   - **Build Command:** Leave empty (vercel.json handles this)
   - **Output Directory:** Leave empty
5. **Add Environment Variables** (Click "Environment Variables"):

```env
DATABASE_URL=postgresql://neondb_owner:npg_S5Enqrw4HbCl@ep-crimson-meadow-a17r3kyx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

JWT_SECRET=retail-pos-jwt-secret-key-change-in-production-2024

JWT_EXPIRES_IN=7d

NODE_ENV=production

CORS_ORIGIN=https://your-frontend-url.vercel.app

MAX_FILE_SIZE=5242880

UPLOAD_PATH=./uploads
```

6. **Click "Deploy"**

---

### Option B: Using Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

When prompted:
- **Set up and deploy?** Yes
- **Which scope?** Your account
- **Link to existing project?** No
- **Project name?** retail-pos-backend
- **Directory?** ./
- **Override settings?** No

Then add environment variables:
```bash
vercel env add DATABASE_URL
# Paste your Neon connection string

vercel env add JWT_SECRET
# Enter your JWT secret

# ... add other variables
```

---

## Step 3: Verify Deployment

After deployment completes, you'll get a URL like:
```
https://retail-pos-backend.vercel.app
```

**Test your API:**
```bash
# Check health
curl https://your-backend-url.vercel.app/api/health

# Or visit in browser:
https://your-backend-url.vercel.app
```

---

## Step 4: Update Frontend CORS

Once deployed, update your backend's CORS settings:

1. In Vercel dashboard → Your Project → Settings → Environment Variables
2. Update `CORS_ORIGIN` to your frontend URL:
   ```
   CORS_ORIGIN=https://your-frontend.vercel.app
   ```
3. Redeploy (Vercel will auto-redeploy on environment variable changes)

---

## Important Notes

### File Uploads
⚠️ **Vercel has a read-only filesystem!** Uploaded files won't persist.

**Solutions:**
1. **Use Vercel Blob Storage** (Recommended):
   ```bash
   vercel blob create
   ```
   Then update your upload controller to use Vercel Blob

2. **Use AWS S3 / Cloudinary** for file storage

3. **For now:** File uploads will work during request but won't persist between deployments

### Database Connection
✅ Already configured with Neon (connection pooling enabled)

### Serverless Functions
- Each API endpoint runs as a serverless function
- Cold starts may occur (~1-2 seconds for first request)
- Neon's pooler helps with connection management

---

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| DATABASE_URL | Neon PostgreSQL connection string | postgresql://... |
| JWT_SECRET | Secret key for JWT tokens | Strong random string |
| JWT_EXPIRES_IN | Token expiration time | 7d |
| NODE_ENV | Environment mode | production |
| CORS_ORIGIN | Frontend URL for CORS | https://yourapp.vercel.app |
| MAX_FILE_SIZE | Max upload size in bytes | 5242880 (5MB) |
| UPLOAD_PATH | Upload directory | ./uploads |

---

## Troubleshooting

### Build Fails
- Check Vercel logs in dashboard
- Ensure all dependencies are in `dependencies` (not `devDependencies`)
- Verify `vercel.json` syntax

### Database Connection Issues
- Verify DATABASE_URL in environment variables
- Check Neon database is active
- Ensure connection string includes `?sslmode=require`

### CORS Errors
- Update CORS_ORIGIN environment variable
- Redeploy after changing environment variables

### API Endpoints Not Working
- Verify vercel.json routes configuration
- Check that src/server.ts exports the Express app

---

## Production Checklist

Before going live:

- [ ] Change JWT_SECRET to a strong random value
- [ ] Update CORS_ORIGIN to your actual frontend URL
- [ ] Set up file storage (Vercel Blob/S3/Cloudinary)
- [ ] Enable Vercel Analytics
- [ ] Set up monitoring/logging
- [ ] Configure custom domain (optional)
- [ ] Test all API endpoints
- [ ] Set up database backups in Neon

---

## Post-Deployment

### Monitor Your App
- **Vercel Dashboard:** Real-time logs and analytics
- **Neon Dashboard:** Database usage and performance

### Custom Domain (Optional)
1. Go to Vercel Dashboard → Your Project → Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed

### Continuous Deployment
- Every push to `main` branch will auto-deploy
- Create a `dev` branch for testing before production

---

## Cost Estimates

**Vercel Free Tier:**
- 100 GB bandwidth/month
- Unlimited serverless function executions
- 6000 build minutes/month

**Neon Free Tier:**
- 512 MB storage
- 3 GB data transfer/month

**Total:** $0/month for small to medium usage! 🎉

---

## Need Help?

- Vercel Docs: https://vercel.com/docs
- Neon Docs: https://neon.tech/docs
- Prisma Docs: https://www.prisma.io/docs

---

**Your backend is ready to deploy! 🚀**
