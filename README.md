This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### 1. Download repo and install dependencies

Download repo with below command,

```bash
git clone https://github.com/codegenerator0131/LLM_Demo.git
```

then install dependencies via:

```bash
npm install
```

### 2. Build env file

build a **.env.local** file and set below values:

```bash
LIVEKIT_API_KEY=devkey(if you run livekit Locally) otherwise YOUR_LIVEKIT_API_KEY
LIVEKIT_API_SECRET=secret(if you run livekit Locally) otherwise YOUR_LIVEKIT_API_SECRET
NEXT_PUBLIC_LIVEKIT_URL=ws://127.0.0.1:7880(if you run livekit Locally) otherwise wss://your-project.livekit.cloud
OPENAI_API_KEY= YOUR_OPENAI_API_KEY
DEEPGRAM_API_KEY= YOUR_DEEPGRAM_API_KEY
```

### 3. Runnig livekit locally (ignore if you are using livekit cloud)

for MacOs:

```bash
brew update && brew install livekit
```

Linux:

```bash
curl -sSL https://get.livekit.io | bash
```

Windows:
Download [exe server file](https://github.com/livekit/livekit/releases/latest) then run:

```bash
livekit-server.exe
```

also, if you are intrested, you can check [Self hosting](https://docs.livekit.io/transport/self-hosting/) page in livekit documentation or use [Livekit cloud service](https://cloud.livekit.io/login?r=%2F)

### 4. Run agent

reun below command in your terminal:

```bash
npx tsx agent.ts dev
```

### 5. Run frontend

reun below command in your terminal:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
