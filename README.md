# LearnCoach 学习教练

A role-based school correction and essay evaluation platform for admins, teachers, and students.

## Requirements

- Node.js v20.12 or later (v22 recommended)

## Installation

```bash
npm install
```

## Configuration

Copy the example env file and add your API key:

```bash
cp .env.example .env
```

Open `.env` and set:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Without the key the system uses a mock evaluator automatically — all other features work without it.

## Running

Open two terminals:

**Terminal 1 — API server**
```bash
node api-server.mjs
```

**Terminal 2 — Dev server**
```bash
npm run dev
```

Then open the URL printed by Vite (default: http://127.0.0.1:5177).

## Demo accounts

| Role    | Username | Password   |
|---------|----------|------------|
| Admin   | admin    | admin123   |
| Teacher | mlin     | teacher123 |
| Student | g7-001   | student123 |

## Features

- **Admin** — teacher registration, class management, student import, learning analytics
- **Teacher** — scan task upload, answer bank review, test grading, 11-dimension essay evaluation, class analytics
- **Student** — composition submission, wrong-question review, practice queue, score history

## Essay Evaluation

The teacher can click **Evaluate** on any submitted composition to run 11-dimension LLM scoring (D1–D11 covering narrative logic, idea depth, paragraph shape, personal voice, and more). Results include per-dimension scores with progress bars, overall band, strengths, and improvement suggestions.

Set `ANTHROPIC_API_KEY` in `.env` to use `claude-haiku-4-5-20251001`. Without the key a sample score is generated for demonstration.
