from fastapi import FastAPI, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import tempfile
from faster_whisper import WhisperModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

model = WhisperModel("base", device="cpu")

@app.post("/api/transcribe")
async def transcribe(audio: UploadFile, prompt: str = Form(None)):
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
            content = await audio.read()
            tmp.write(content)
            tmp_path = tmp.name

        segments, info = model.transcribe(tmp_path, initial_prompt=prompt)
        text = " ".join([s.text for s in segments])

        return {"text": text.strip()}
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8787)
