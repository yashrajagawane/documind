# DocuMind — Complete Zero-Cost Deployment Guide (₹0 / $0 Forever)

> **Audience:** Developers, students, and engineers looking to host DocuMind completely free of charge without entering any credit card, without free-trial expiration worries, and without surprise billing.

---

## 1. Executive Summary & Architecture

Most conventional free tiers (such as Render Free, Koyeb, or Fly.io) provide only 256 MB to 512 MB of RAM. **IBM Docling layout models and PyTorch require 2–4 GB of memory** during document parsing, causing standard free containers to be terminated by the Out-Of-Memory (OOM) killer.

To achieve a 100% stable, zero-cost deployment, DocuMind partitions its workloads into specialized free tiers that each excel at their respective requirements:

```mermaid
graph TD
    User([User Browser]) -->|HTTPS Global CDN| Vercel[Vercel Edge\nFrontend: Next.js 16\nFree Forever]
    Vercel -->|REST API / SSE| HF[Hugging Face Space\nBackend + Worker: 16 GB RAM Docker\nFree Forever]
    HF -->|Async SQLAlchemy / asyncpg| Neon[Neon Serverless Postgres\n0.5 GB Free Database]
    HF -->|Dense Vector Search| Qdrant[Qdrant Cloud\n1 GB RAM Cluster Free Forever]
    HF -->|Grounded Synthesis| Gemini[Google AI Studio\nGemini 3.8 Flash Free Tier]
```

### Free Tier Summary (Zero Card Required)

| Service | Responsibility | Free Allocation | Credit Card Required? |
|---|---|---|:---:|
| **[Vercel](https://vercel.com)** | Frontend Web UI (Next.js 16) | Unlimited traffic / Fast Edge CDN | **No** (Sign in with GitHub) |
| **[Hugging Face Spaces](https://huggingface.co/spaces)** | FastAPI Gateway + Celery AI Worker | **2 vCPUs + 16 GB RAM** (Docker) | **No** (Sign in with Email) |
| **[Neon.tech](https://neon.tech)** | Relational DB (PostgreSQL 16) | 0.5 GB Storage (Serverless) | **No** (Sign in with GitHub) |
| **[Qdrant Cloud](https://cloud.qdrant.io)** | Dense Vector DB (`all-MiniLM-L6-v2`) | 1 GB RAM / 4 GB Disk Cluster | **No** (Sign in with GitHub) |
| **[Google AI Studio](https://aistudio.google.com)** | LLM Inference (Gemini 3.8 Flash) | 15 RPM / 1M TPM free | **No** (Sign in with Google) |

---

## 2. Step-by-Step Deployment Instructions

### Step 1: Provision Free PostgreSQL on Neon.tech

1. Visit **[neon.tech](https://neon.tech)** and click **Sign Up** using your GitHub account.
2. In the dashboard, click **Create Project**:
   - **Project Name:** `documind-prod`
   - **Postgres Version:** `16`
   - **Region:** Pick the location nearest to you (e.g. `ap-southeast-1` Singapore or `eu-central-1` Frankfurt).
3. On the project dashboard, locate the **Connection Details** box.
4. Copy the connection string. It will look like:
   ```text
   postgresql://documind_owner:npg_AbCdEf1234@ep-cool-snowflake-123456.ap-southeast-1.aws.neon.tech/documind-prod?sslmode=require
   ```
5. **Important:** Because DocuMind uses SQLAlchemy with `asyncpg`, modify the URL prefix from `postgresql://` to `postgresql+asyncpg://`:
   ```text
   postgresql+asyncpg://documind_owner:npg_AbCdEf1234@ep-cool-snowflake-123456.ap-southeast-1.aws.neon.tech/documind-prod?sslmode=require
   ```
   *(Save this as your `DATABASE_URL`).*

---

### Step 2: Provision Free Vector Store on Qdrant Cloud

1. Visit **[cloud.qdrant.io](https://cloud.qdrant.io)** and log in with GitHub.
2. Click **Create Cluster**:
   - Select the **Free Tier Cluster** option (1 GB RAM, 4 GB Disk — **Free Forever**).
   - Give it a name (e.g., `documind-vectors`).
   - Click **Create**.
3. Once the cluster status shows **Healthy**:
   - Copy the **Cluster URL** (e.g., `https://xyz-123.eu-central.aws.cloud.qdrant.io:6333`).
   - In the left sidebar, navigate to **Data Access Control** → **API Keys**.
   - Click **Generate Key**, copy the key token, and save it.
   *(Save these as `QDRANT_URL` and `QDRANT_API_KEY`).*

---

### Step 3: Get Google Gemini API Key

1. Go to **[Google AI Studio](https://aistudio.google.com/)** and log in with your Google account.
2. Click **Get API key** in the top left.
3. Click **Create API key in new project**.
4. Copy the resulting key string.
   *(Save this as `GEMINI_API_KEY`).*

---

### Step 4: Deploy Backend & Worker on Hugging Face Spaces

Hugging Face Spaces provides a free **16 GB RAM** container environment, giving IBM Docling all the memory it needs for OCR and layout parsing without crashing.

#### 4.1 Create Space
1. Go to **[huggingface.co](https://huggingface.co)** and register/sign in.
2. Click your avatar icon in the top right → **New Space**.
3. Fill out the creation form:
   - **Space Name:** `documind-api`
   - **License:** `MIT`
   - **Space SDK:** Choose **Docker** → **Blank**.
   - **Space Hardware:** Leave on **CPU Basic · 2 vCPU · 16 GB RAM · Free**.
   - **Visibility:** Public.
4. Click **Create Space**.

#### 4.2 Configure Secrets & Environment Variables
In your newly created space, navigate to **Settings** → scroll to **Variables and secrets** → click **New Secret** for each entry:

| Secret Name | Value Example | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://...@ep-...neon.tech/documind?sslmode=require` | From Neon (Step 1) |
| `QDRANT_URL` | `https://xyz.aws.cloud.qdrant.io:6333` | From Qdrant (Step 2) |
| `QDRANT_API_KEY` | `th1sIsMyQdrantK3y...` | From Qdrant (Step 2) |
| `GEMINI_API_KEY` | `AIzaSy...` | From AI Studio (Step 3) |
| `JWT_SECRET_KEY` | `d0cum1nd_s3cur1ty_k3y_pr0duct10n_32chr` | Any random 32+ character string |
| `CORS_ORIGINS` | `["*"]` | Allows frontend requests |
| `STORAGE_BACKEND` | `local` | Uses container disk storage |
| `DOCUMENT_PROCESSING_PIPELINE` | `auto` | Auto-detects IBM Docling / Fallback |

#### 4.3 Push Code to Hugging Face
On your local machine, open your terminal in the `documind` repository and push to your Hugging Face Space:

```bash
# 1. Add your Hugging Face Space as a git remote
git remote add space https://huggingface.co/spaces/YOUR_HF_USERNAME/documind-api

# 2. Push the repository to Hugging Face
git push space main
```

#### 4.4 Verify Backend Health
Once the container finishes building and reaches **Running** status:
- Open `https://YOUR_HF_USERNAME-documind-api.hf.space/docs` in your browser.
- You will see the interactive FastAPI Swagger UI documentation!
- Your base API URL is:
  ```text
  https://YOUR_HF_USERNAME-documind-api.hf.space/api/v1
  ```

---

### Step 5: Deploy Frontend on Vercel

1. Go to **[vercel.com](https://vercel.com)** and sign in with your GitHub account.
2. Click **Add New…** → **Project**.
3. Under "Import Git Repository", find your **`yashrajagawane/documind`** repo and click **Import**.
4. Configure Project Settings:
   - **Framework Preset:** `Next.js`
   - **Root Directory:** Click **Edit** and choose `frontend`.
5. Under **Environment Variables**, add:
   - **Name:** `NEXT_PUBLIC_API_BASE_URL`
   - **Value:** `https://YOUR_HF_USERNAME-documind-api.hf.space/api/v1`
6. Click **Deploy**.
7. In approximately 60 seconds, Vercel will complete the build and assign you a global, secure URL (e.g. `https://documind.vercel.app`).

---

## 3. Alternative: Zero-Cloud 5-Minute Demo (Cloudflare Tunnel)

If you only need a public link to demonstrate DocuMind for job interviews, portfolio presentations, or client demos, you can run all 7 services locally on your machine and expose them securely via Cloudflare's free tunnel.

### Step-by-Step:

1. **Launch DocuMind locally:**
   ```bash
   cd documind
   docker compose up -d
   ```
2. **Install Cloudflare `cloudflared`:**
   - **Windows:**
     ```powershell
     winget install Cloudflare.cloudflared
     ```
   - **macOS:**
     ```bash
     brew install cloudflared
     ```
   - **Linux:**
     ```bash
     curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
     sudo dpkg -i cloudflared.deb
     ```
3. **Start Tunnel:**
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```
4. **Result:** Cloudflare prints a secure public HTTPS link in your terminal:
   ```text
   https://free-demo-subdomain.trycloudflare.com
   ```
   Anyone in the world can open that URL to access your live DocuMind workspace with complete AI functionality.

---

## 4. Verification & Testing Checklist

After completing deployment, verify the entire pipeline end-to-end:

- [ ] **Authentication:** Open your Vercel URL and register a new user account (password must be at least 12 characters).
- [ ] **Document Upload:** Upload a PDF or DOCX file (up to 25 MB). Observe real-time progress indicators.
- [ ] **Document Preview:** Click **Preview** on a ready document. Verify layout formatting, table rendering, and code syntax highlighting.
- [ ] **Workspace Splitter:** Drag the panel divider between Document Preview and Chat to verify resizable pane behavior.
- [ ] **Grounded Chat:** Ask a question specific to your document. Confirm the generated answer includes interactive citation badges with verification scores (`>= 0.35`).
- [ ] **Citation Navigation:** Click a citation tag to jump directly to the cited section in the document reader.

---

## 5. Troubleshooting & FAQ

#### Q: Hugging Face Space shows "Building" for a long time.
**A:** The first build installs PyTorch and IBM Docling wheel dependencies, which can take 4–6 minutes. Subsequent builds use Docker layer caching and complete in under 60 seconds.

#### Q: Requests fail with CORS error in the browser console.
**A:** In Hugging Face Space Settings → Variables and secrets, ensure `CORS_ORIGINS` includes your Vercel production domain (e.g. `["https://documind.vercel.app"]` or `["*"]`).

#### Q: Neon database connection times out after periods of inactivity.
**A:** Neon is a serverless database that suspends compute when idle to remain free. The first request after a long pause may take 2–3 seconds to wake the database. Subsequent queries execute in single-digit milliseconds.

---

*Authored for the DocuMind Open Source Project. Licensed under MIT.*
