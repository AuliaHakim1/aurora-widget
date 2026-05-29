# AuraWidgets

AuraWidgets adalah aplikasi desktop companion berbasis **Electron** yang dirancang untuk mempercantik layar desktop Windows Anda menjadi lebih bersih, produktif, dan futuristik. Widget ini terjangkar langsung pada layer wallpaper desktop sehingga tidak akan mengganggu atau menutupi jendela aplikasi kerja Anda yang lain.

---

## ✨ Fitur Utama

- 🌌 **Desktop Background Anchoring (`type: 'desktop'`)**: Widget menempel permanen pada layer dasar desktop (wallpaper). Otomatis berada di belakang browser atau aplikasi aktif lainnya saat Anda bekerja.
- 🎨 **Dynamic Theme Switcher**: Dilengkapi dengan 4 preset tema premium yang dapat diganti secara instan dengan mengklik dot ungu di header:
  - **Nordic Slate** (Bawaan - Abu-abu biru gelap yang teduh)
  - **Cyberpunk Glow** (Ungu neon dan biru cyan kontras)
  - **Forest Moss** (Hijau sage yang alami dan menenangkan)
  - **Sakura Minimalist** (Merah muda pastel lembut)
- 🌀 **Circular SVG Progress Gauges**: Monitor performa sistem (CPU, RAM, dan Disk C:) berbentuk lingkaran neon yang bersih dan diletakkan berdampingan untuk menghemat ruang layar.
- 🌤️ **Live Auto-Location Weather**: Mendeteksi lokasi kota Anda secara otomatis melalui IP geolocation (`ip-api.com`) dan memperbarui informasi cuaca serta temperatur secara berkala menggunakan API dari Open-Meteo.
- 📝 **Interactive Todo List**: Kelola tugas harian langsung dari desktop dengan fitur klik untuk mencoret (selesai), tombol hapus cepat, dan autosave otomatis ke penyimpanan lokal (`localStorage`).
- ⚡ **Ultra-Lightweight & Hemat Daya**: Pembacaan metrik sistem dan cuaca diatur secara terjeda (throttled) agar tidak membebani CPU, GPU, dan RAM laptop Anda.

---

## 🚀 Panduan Instalasi & Penggunaan

### Prasyarat
Sebelum menginstal, pastikan laptop Anda sudah terpasang:
- [Node.js](https://nodejs.org/) (Rekomendasi versi LTS terbaru)

### Langkah Instalasi

1. **Clone repositori ini:**
   ```bash
   git clone https://github.com/AuliaHakim1/aurora-widget.git
   cd aurora-widget
   ```

2. **Instal dependensi Electron:**
   ```bash
   npm install
   ```

3. **Jalankan aplikasi:**
   ```bash
   npm start
   ```

---

## 🖥️ Menjalankan Secara Senyap di Windows (Silent Launch)

Untuk mencegah munculnya jendela hitam Command Prompt (`cmd.exe`) saat widget dijalankan, Anda dapat menggunakan peluncur VBScript bawaan:

1. Buat file pintasan di Desktop Anda bernama `AuraWidgets.vbs`.
2. Isi file tersebut dengan script berikut (sesuaikan path foldernya jika Anda menaruhnya di direktori lain):
   ```vbs
   Set WshShell = CreateObject("WScript.Shell")
   WshShell.Run "cmd.exe /c cd /d C:\path\to\your\aurora-widget && npm start", 0, false
   ```
3. Cukup **double-click** file `AuraWidgets.vbs` tersebut untuk meluncurkan widget secara senyap di background.

---

## ⚙️ Konfigurasi Auto-Start (Startup Windows)

Aplikasi ini sudah dikonfigurasi secara bawaan menggunakan API `app.setLoginItemSettings` milik Electron. Widget akan otomatis terbuka saat Anda menyalakan laptop dan masuk ke akun Windows Anda. Anda bisa memantau pengaturannya melalui **Task Manager** pada tab **Startup Apps**.
