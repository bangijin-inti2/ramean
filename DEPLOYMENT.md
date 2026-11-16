# Publish Ramean ke Vercel

## Status audit 16 November 2026

- `npm run lint`, `npm run typecheck`, dan `npm run build` lulus setelah modul ruang bersama, setoran QR, dan arisan dilengkapi.
- Smoke test server produksi lokal: `/login` menghasilkan 200 dan `/dashboard` tanpa sesi menghasilkan 307 ke `/login`.
- Deployment terbaru READY: https://ramean-psi.vercel.app (deployment ID `dpl_9rbv6eceoo12sc3kETPHzJLg2nj3`).
- Smoke test publik: `/login` menghasilkan 200 dan `/dashboard` tanpa sesi menghasilkan 307 ke `/login`.
- Environment Production Vercel menampilkan `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; nilai tidak dibaca. Permintaan auth live mengarah ke project Supabase yang diharapkan.
- Google OAuth telah diaktifkan di Supabase. Site URL dan Redirect URLs menggunakan domain Vercel dan callback `/auth/callback`.
- Login production melalui email/password dan Google berhasil; alur Google kembali ke dashboard Vercel.
- Refresh sesi, logout, akses data setelah login, dan UAT finansial dua akun masih perlu diuji.
- Versi Next.js masih beta dan bukan pengganti setara aplikasi Streamlit utama.
- Deployment READY yang tercatat dibuat dari working tree lokal. Setelah commit/push perubahan ini, pastikan deployment baru terhubung ke commit GitHub yang sama.
- Pemeriksaan SQL live atas object utama migration 001–023 dan hak akses yang diuji lulus; database tidak memiliki migration ledger, sehingga urutan penerapan dan kesamaan semua definisi SQL tidak terbukti.
- Hasil SQL live mengonfirmasi kolom `relationship_label`, RPC `list_couple_labels`/`set_couple_label`, hak execute role `authenticated`, dan penolakan execute untuk `anon` pada migration 023. Error `column "relationship_label" already exists` terjadi saat migration dijalankan ulang; jangan rerun.
- Audit penuh seluruh policy RLS dan grant/revoke migration 001–023 masih perlu dilakukan sebelum memakai data finansial.

## Konfigurasi proyek

Import repository tersebut pada Vercel dan gunakan preset Next.js. Root Directory
adalah `.` karena root repository Git sudah merupakan folder aplikasi web,
bukan folder induk lokal `ramean`.

Gunakan build command `npm run build`, install command `npm ci`, dan output
directory default Next.js.

Tambahkan environment variables dari `.env.local` melalui pengaturan Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (atau `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  jika itu nama yang digunakan pada konfigurasi lokal)

Aktifkan untuk Production dan Preview sesuai proyek Supabase yang digunakan.
Jangan gunakan service-role key sebagai variabel publik. Jangan commit `.env.local`.

## Publish melalui CLI

1. `npx vercel login` jika belum login.
2. `npx vercel link` lalu pilih akun/team dan proyek Ramean yang benar.
3. Atur environment variables di atas pada proyek yang terhubung.
4. `npx vercel deploy --prod`.
5. Catat URL produksi yang dikembalikan setelah status deployment Ready.

## Supabase setelah mendapat URL produksi

Atur Authentication > URL Configuration:

- Site URL: origin produksi yang diberikan Vercel.
- Redirect URLs: `https://ramean-psi.vercel.app/auth/callback`.

Pada Authentication > Sign In / Providers > Google, masukkan Google OAuth Client ID dan Secret, lalu aktifkan provider. Callback Authorized redirect URI di Google Cloud harus URL callback Supabase yang ditampilkan dashboard, biasanya `https://<project-ref>.supabase.co/auth/v1/callback`. Secret hanya disimpan di Supabase, bukan Vercel atau repository.

Per 16 November 2026, provider Google production telah aktif dan login berhasil kembali ke dashboard melalui `/auth/callback`.
Pastikan migration database yang dibutuhkan sampai 023 sudah diterapkan;
keberadaan file SQL lokal bukan bukti migration sudah dijalankan. Jangan
menjalankan ulang migration pada database existing.

## Verifikasi hasil

- Buka `/login` pada domain produksi.
- Pastikan `/dashboard` tanpa sesi meminta login.
- Uji login email dan Google, refresh sesi, serta logout.
- Verifikasi dashboard, dompet, dan laporan memuat data ruang yang benar.
- Pengujian lint/build tidak membuktikan login atau izin database sudah benar.

Versi Next.js masih beta. Pengelolaan anggota, undangan, setoran QR, dan arisan
sudah memiliki implementasi awal, tetapi belum divalidasi setara dengan versi
Python lama melalui UAT dua akun.

Referensi: https://vercel.com/docs/projects/deploy-from-cli
