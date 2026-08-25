# Local Persian TTS helper

This helper lets the browser extension read only the text you selected, using a free local Piper voice instead of the robotic system TTS.

## Setup

1. Download the Windows Piper release and put `piper.exe` in:

   `local-helper/piper/piper.exe`

2. Download a Persian Piper model and its matching `.json` config, for example:

   `fa_IR-gyro-medium.onnx`

   Put the model files in:

   `local-helper/models/`

3. Start the helper:

   ```powershell
   python .\local-helper\server.py
   ```

4. In the extension popup, keep `استفاده از موتور رایگان محلی` enabled.

The extension sends only your selected text to `http://127.0.0.1:8765/speak`. If the helper is not running, the extension falls back to the browser/system TTS.

## Optional paths

You can point to custom files:

```powershell
python .\local-helper\server.py --piper C:\tools\piper\piper.exe --model C:\voices\fa_IR-amir-medium.onnx
```
