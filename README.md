# Ramean Web (Next.js beta)

Folder ini berisi implementasi Next.js yang terpisah dari versi Streamlit awal di folder induk. Next.js adalah target web untuk publish ke Vercel. Implementasi ruang bersama, setoran QR, dan arisan sudah tersedia, tetapi versi Next.js masih beta dan belum setara seluruh cakupan Streamlit; UAT dua akun masih diperlukan.

## Menjalankan lokal

```powershell
npm ci
npm run dev
```

Isi environment lokal berdasarkan `.env.example`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (atau nama legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

Gunakan key publik Supabase; jangan pernah memasukkan service-role key ke variabel `NEXT_PUBLIC_*` atau ke repository.

## Pemeriksaan

```powershell
npm run lint
npm run typecheck
npm run build
```

Pada audit 16 November 2026, lint, typecheck, dan production build lulus setelah melengkapi modul ruang bersama, setoran QR, serta arisan. Build sudah di-deploy ke [Vercel Production](https://ramean-psi.vercel.app); smoke test publik menghasilkan `/login` 200 dan `/dashboard` tanpa sesi 307 ke `/login`. Login email/password dan Google OAuth production berhasil diuji hingga kembali ke dashboard. Pengujian refresh sesi, logout, dan alur data dua akun masih perlu dilakukan.

Konfigurasi dan daftar verifikasi deployment ada di [DEPLOYMENT.md](DEPLOYMENT.md). Setelah perubahan ini dipush, pastikan deployment Vercel terbaru berstatus Ready dan cocok dengan commit yang dipush.
