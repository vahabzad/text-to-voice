# Selected Text Reader

افزونه مرورگر برای خواندن فقط متن انتخاب شده در سایت ها. این پروژه برای متن فارسی طراحی شده و از یک موتور رایگان و محلی Piper استفاده می کند تا کیفیت صدا از TTS پیش فرض ویندوز بهتر باشد.

## قابلیت ها

- خواندن فقط متنی که با موس انتخاب کرده اید
- پشتیبانی از متن فارسی همراه با اصطلاحات انگلیسی
- اجرای رایگان و محلی روی کامپیوتر شما
- بدون ارسال متن به سرویس آنلاین
- انتخاب چند مدل فارسی Piper
- fallback اختیاری به TTS مرورگر/سیستم

## ساختار پروژه

```text
chrome/          افزونه Chrome
fox/             افزونه Firefox
local-helper/    سرور محلی Piper و مدل های فارسی
```

## راه اندازی سریع

### 1. اجرای موتور صوت محلی

یک PowerShell باز کنید:

```powershell
cd D:\extentions\text-to-voice
python .\local-helper\server.py
```

اگر درست اجرا شود، باید این را ببینید:

```text
Local TTS helper listening on http://127.0.0.1:8765
```

این پنجره را باز نگه دارید. تا وقتی این برنامه در حال اجراست، افزونه می تواند از صدای محلی استفاده کند.

### 2. نصب افزونه در Chrome

1. Chrome را باز کنید.
2. بروید به:

   ```text
   chrome://extensions
   ```

3. گزینه `Developer mode` را روشن کنید.
4. روی `Load unpacked` بزنید.
5. این پوشه را انتخاب کنید:

   ```text
   D:\extentions\text-to-voice\chrome
   ```

اگر افزونه قبلا نصب شده، بعد از تغییرات فقط روی `Reload` بزنید.

### 3. نصب افزونه در Firefox

1. Firefox را باز کنید.
2. بروید به:

   ```text
   about:debugging#/runtime/this-firefox
   ```

3. روی `Load Temporary Add-on` بزنید.
4. فایل زیر را انتخاب کنید:

   ```text
   D:\extentions\text-to-voice\fox\manifest.json
   ```

## استفاده

1. یک سایت را باز کنید.
2. فقط همان متنی که می خواهید گوش بدهید را انتخاب کنید.
3. یکی از این کارها را انجام دهید:
   - روی آیکن افزونه بزنید و `خواندن انتخاب` را انتخاب کنید.
   - روی متن انتخاب شده راست کلیک کنید و `Read selected text` را بزنید.
   - میانبر `Alt + Shift + S` را بزنید.

برای توقف:

```text
Alt + Shift + X
```

یا از دکمه `توقف` داخل popup افزونه استفاده کنید.

## تنظیمات افزونه

### استفاده از موتور رایگان محلی

این گزینه باید روشن باشد تا افزونه از Piper استفاده کند.

آدرس پیش فرض:

```text
http://127.0.0.1:8765
```

### مدل فارسی محلی

مدل های نصب شده:

- `Gyro`
- `Amir`
- `Ganji`
- `Ganji Adabi`
- `Reza Ibrahim`

بعد از تغییر مدل، دوباره `خواندن انتخاب` را بزنید. در PowerShell باید ببینید که helper از همان مدل استفاده کرده است:

```text
Using model: fa_IR-amir-medium.onnx
```

### سرعت

اگر صدا کامپیوتری یا تند حس می شود، سرعت را روی `0.8x` یا `0.9x` بگذارید.

### صدای فارسی / English voice

این دو گزینه مربوط به صدای مرورگر/سیستم هستند، نه Piper محلی. وقتی `استفاده از موتور رایگان محلی` روشن است، گزینه مهم برای فارسی همان `مدل فارسی محلی` است.

## عیب یابی

### مدل را عوض می کنم ولی صدا تغییر نمی کند

معمولا یعنی یک نسخه قدیمی از helper هنوز روی پورت `8765` باز است.

راه حل:

1. همه پنجره های PowerShell یا Terminal که `server.py` را اجرا کرده اند ببندید.
2. helper را دوباره اجرا کنید:

   ```powershell
   cd D:\extentions\text-to-voice
   python .\local-helper\server.py
   ```

3. در `chrome://extensions` روی `Reload` افزونه بزنید.
4. صفحه سایت را refresh کنید.
5. دوباره مدل را عوض کنید و متن را بخوانید.

در PowerShell باید نام مدل تغییر کند، مثلا:

```text
Using model: fa_IR-reza_ibrahim-medium.onnx
```

### popup می گوید موتور محلی روشن نیست

این موارد را چک کنید:

- PowerShell که `server.py` داخلش اجرا شده هنوز باز باشد.
- آدرس داخل popup این باشد:

  ```text
  http://127.0.0.1:8765
  ```

- صفحه سایت را refresh کرده باشید.

### صدا هنوز خیلی طبیعی نیست

مدل های Piper فارسی رایگان و محلی هستند، اما کیفیتشان در حد سرویس های آنلاین پولی نیست. برای بهتر شدن:

- مدل های مختلف را تست کنید.
- سرعت را کمی پایین بیاورید.
- متن های خیلی طولانی را در چند بخش انتخاب و پخش کنید.

## فایل های مهم

- `local-helper/server.py`: سرور محلی TTS
- `local-helper/piper/piper.exe`: موتور Piper برای Windows
- `local-helper/models/`: مدل های فارسی Piper
- `chrome/content.js`: خواندن متن انتخاب شده در Chrome
- `chrome/popup.js`: تنظیمات popup در Chrome
- `fox/content.js`: خواندن متن انتخاب شده در Firefox
- `fox/popup.js`: تنظیمات popup در Firefox

## تست دستی helper

برای تست مستقیم helper:

```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:8765/health"
```

برای تست تولید صدا با یک مدل مشخص:

```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:8765/speak?model=amir" -Method POST -ContentType "application/json" -Body '{"text":"سلام، این تست مدل امیر است."}' -OutFile "test-amir.wav"
```

## منابع

- Piper releases: https://github.com/rhasspy/piper/releases
- Persian Piper voices: https://huggingface.co/rhasspy/piper-voices/tree/main/fa/fa_IR
