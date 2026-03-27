# 🍽️ TableSplit

Split expenses with your group in real-time. No signup needed.

## Features

- **Open a table** — Create a shared expense session with one click
- **Shareable URL** — Anyone with the link can add their expenses
- **Real-time sync** — All changes sync instantly across devices via Supabase
- **Smart settlement** — Calculates minimal transactions (who pays whom)
- **Copy results** — Copy the settlement summary to share via chat
- **Close table** — Delete all data when everyone's settled up

## Tech Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Realtime)
- **Routing:** React Router

## Setup

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com) and create a new project.

### 2. Run the database migration

Copy the contents of `supabase/migration.sql` into the Supabase SQL Editor and run it.

### 3. Configure environment

```bash
cp .env.example .env
```

Fill in your Supabase URL and anon key in `.env`.

### 4. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## How It Works

1. **Home** — Enter a table name and click "Open Table"
2. **Table** — Add people, enter what each person spent
3. **Split** — Hit "Split the bill" to see who owes whom
4. **Share** — Copy the settlement to send via WhatsApp/chat
5. **Close** — Delete the table when everyone's paid up
