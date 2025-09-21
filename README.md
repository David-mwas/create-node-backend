# Create Node Backend CLI(nodejs-api-init) 🛠

Scaffold a Node.js backend project in seconds. Supports **Express**, **Fastify**, or **Hono**, with optional databases (**MongoDB, PostgreSQL, MySQL**). TypeScript-first with JS fallback.

---

```bash
npm install -g nodejs-api-init 
```

## ✨ Features

- Choose framework: Express / Fastify / Hono
- Choose DB: MongoDB / PostgreSQL / MySQL / None
- TypeScript-first, but toggle to JS easily
- Pre-configured folder structure (`src/config`, `src/models`, `src/controllers`, `src/routes`)
- Auto `.env` and `package.json`
- Offline-safe installer (retries until internet returns)
- Interactive (quit with `q`)

---

## 📦 Installation

```bash
npm install -g nodejs-api-init
```

## 🚀 Usage

### Create a new backend:

```bash
npx nodejs-api-init
```

### You’ll be prompted for:

- Project name

- Framework (Express / Fastify / Hono)

- Database (MongoDB / PostgreSQL / MySQL / None)

- TypeScript or JavaScript

### Then:

```bash
cd my-backend-app
npm run dev
```

## 📂 Example Generated Project Structure

```
my-backend-app/
├── src/
│ ├── config/
│ │ └── db.ts
│ ├── controllers/
│ │ └── user.controller.ts
│ ├── models/
│ │ └── user.model.ts
│ ├── routes/
│ │ └── user.route.ts
│ └── index.ts
├── .env
├── package.json
├── tsconfig.json
└── README.md
```

## ⚡ Development

### Clone and link locally:

```bash
git clone https://github.com/david-mwas/nodejs-api-init.git
cd nodejs-api-init
npm install
npm link
```

### Run:

```bash
npx nodejs-api-init
```

## ⚡ Compatibility

⚠️ Works on **Linux**, **macOS**, and **Windows**.  
You only need **Node.js ≥16** installed.

> 🗄️ Databases (**MongoDB**, **PostgreSQL**, **MySQL**) must be installed separately if you choose them during setup.

📜 License

MIT © David-mwas

---
