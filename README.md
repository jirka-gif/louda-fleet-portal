# Louda Auto Fleet Portal

Co-brandovaný portál pro správu vozového parku a flotilového pojištění — *powered by STAR Broker Hub*. Plně interaktivní prototyp v češtině s realistickými českými daty.

Postaveno v **React + Vite**.

## Lokální vývoj

```bash
npm install
npm run dev
```

## Build

```bash
npm run build      # výstup do dist/
npm run preview
```

## Nasazení na Vercel

Framework je auto-detekován jako **Vite**:

- Build Command: `npm run build`
- Output Directory: `dist`

Aplikace je single-page (navigace řešená vnitřním stavem Reactu), takže není potřeba žádná SPA rewrite konfigurace.
