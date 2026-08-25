# Local Persian TTS Helper

This helper lets the browser extension read only the text you selected, using a free local Piper voice instead of the robotic system TTS.

## Current Setup

Piper and these Persian models are already placed in this project:

- `fa_IR-gyro-medium`
- `fa_IR-amir-medium`
- `fa_IR-ganji-medium`
- `fa_IR-ganji_adabi-medium`
- `fa_IR-reza_ibrahim-medium`

## Start

From the project root:

```powershell
python .\local-helper\server.py
```

The extension sends only your selected text to `http://127.0.0.1:8765/speak`. If the helper is not running, the extension falls back to the browser/system TTS.

## Model Selection

The extension sends the selected model as `model`:

```text
http://127.0.0.1:8765/speak?model=amir
```

The server prints the model it used:

```text
Using model: fa_IR-amir-medium.onnx
```

## Optional paths

You can point to custom files:

```powershell
python .\local-helper\server.py --piper C:\tools\piper\piper.exe --model C:\voices\fa_IR-amir-medium.onnx
```
