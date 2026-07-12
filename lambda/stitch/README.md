# Stitch Lambda — offload ffmpeg concat off Vercel

Stitches the app's per-clip videos into one MP4 on AWS Lambda instead of a Vercel
serverless function, so long multi-clip ads don't hit Vercel's execution-time /
memory / payload limits. Same "render in Lambda" pattern as MyMotionIQ.

The app keeps working **without** this — it falls back to `/api/stitch` on Vercel
whenever `VITE_STITCH_LAMBDA_URL` is unset. Deploy this when your ads get long
enough that Vercel stitching starts timing out (roughly 5+ clips).

## What it does

1. Receives `{ videoUrls: [https…] }` (the client uploads clips to Supabase first, so these are already hosted).
2. Downloads them to `/tmp`, runs ffmpeg concat (stream-copy, re-encode fallback).
3. Uploads the result to Supabase Storage and returns `{ videoUrl, bytes, clips }`.

## 1. Add an ffmpeg layer

Lambda has no ffmpeg. Attach a layer that provides `/opt/bin/ffmpeg`:

- Easiest: add a maintained public ffmpeg layer for your region (search "ffmpeg lambda layer <region>"), **or**
- Build your own: download a static ffmpeg build, zip it as `bin/ffmpeg`, publish as a layer:
  ```bash
  mkdir -p ffmpeg-layer/bin
  curl -L https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz | tar xJ --strip-components=1 -C ffmpeg-layer/bin --wildcards '*/ffmpeg'
  (cd ffmpeg-layer && zip -r ../ffmpeg-layer.zip bin)
  aws lambda publish-layer-version --layer-name ffmpeg \
    --zip-file fileb://ffmpeg-layer.zip --compatible-runtimes nodejs20.x
  ```
  (If you put ffmpeg somewhere else, set `FFMPEG_PATH` env var accordingly.)

## 2. Package and create the function

```bash
cd lambda/stitch
npm install --omit=dev
zip -r ../stitch.zip index.mjs package.json node_modules

aws lambda create-function \
  --function-name mymypromoiq-stitch \
  --runtime nodejs20.x --handler index.handler \
  --architectures x86_64 \
  --timeout 300 --memory-size 2048 \
  --ephemeral-storage '{"Size": 4096}' \
  --layers <your-ffmpeg-layer-arn> \
  --role <lambda-exec-role-arn> \
  --zip-file fileb://../stitch.zip
```

## 3. Environment variables

```bash
aws lambda update-function-configuration --function-name mymypromoiq-stitch \
  --environment 'Variables={
    SUPABASE_URL=https://xxxx.supabase.co,
    SUPABASE_SERVICE_KEY=<service-role-key>,
    SUPABASE_BUCKET=product-images,
    ALLOWED_URL_PREFIX=https://xxxx.supabase.co/storage/v1/object/public/,
    STITCH_SHARED_SECRET=<a-long-random-string>
  }'
```

- `ALLOWED_URL_PREFIX` restricts what the Lambda will fetch to **your** Supabase bucket — this is what stops a public Function URL from being abused as an open fetch proxy (SSRF). Keep it set.
- `STITCH_SHARED_SECRET` is optional. Because the app is a browser SPA, any secret shipped to it (`VITE_…`) is technically visible in the bundle, so treat this as light abuse-deterrence, not real auth — `ALLOWED_URL_PREFIX` is the real protection.

## 4. Enable a Function URL with CORS

```bash
aws lambda create-function-url-config --function-name mymypromoiq-stitch \
  --auth-type NONE \
  --cors '{"AllowOrigins":["https://your-app-domain"],"AllowMethods":["POST"],"AllowHeaders":["content-type","x-stitch-secret"]}'
```

Copy the returned `FunctionUrl`.

## 5. Point the app at it

Set these in Vercel → Settings → Environment Variables (Production), then redeploy:

```
VITE_STITCH_LAMBDA_URL   = <the Function URL from step 4>
VITE_STITCH_SHARED_SECRET = <same value as STITCH_SHARED_SECRET, if you set one>
```

That's it. `stitchVideos` will now POST hosted clip URLs straight to Lambda and
use the returned `videoUrl`; if the Lambda call fails it automatically falls
back to the Vercel `/api/stitch` path, so a Lambda outage never blocks a render.

## IAM role (minimum)

The Lambda execution role needs `AWSLambdaBasicExecutionRole` (CloudWatch logs).
Supabase writes use the service key over HTTPS, so no S3/AWS storage permissions
are required.
