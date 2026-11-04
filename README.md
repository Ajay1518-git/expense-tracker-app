# Expense

Black & white boxy expense tracker. React + Vite + Capacitor (Android).

- Data is stored on-device (localStorage). Corrupt data is never wiped; it is copied to `*.corrupt`.
- `legacy` Python CLI files (`main.py`, json) are kept at repo root for reference.

## APK

Every push to `main` builds a debug APK via GitHub Actions. Download it from the **Releases** page (or the run's Artifacts), then install on your phone.

## Dev

```
npm install
npm run dev
```
