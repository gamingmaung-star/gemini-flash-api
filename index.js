import express from "express";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Multer: simpan sementara ke folder uploads/
const upload = multer({ dest: "uploads/" });

// Helper: hapus file aman (tanpa meledak kalau gagal)
function safeUnlink(p) {
  if (!p) return;
  try { fs.unlinkSync(p); } catch (_) {}
}

// Fungsi pemanggil model
async function runModel(contents) {
  // contents boleh string (teks) atau array campuran prompt + inlineData
  const resp = await genAI.models.generateContent({
    model: GEMINI_MODEL,
    contents,
  });
  return resp.text; // SDK mengembalikan resp.text yang sudah digabung
}

/**
 * 1) TEKS → /generate-text
 * body: { "prompt": "tuliskan ringkasan ..." }
 */
app.post("/generate-text", async (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: "prompt diperlukan" });

  try {
    const output = await runModel(prompt);
    res.json({ output });
  } catch (err) {
    res.status(500).json({ error: err.message || "gagal memproses" });
  }
});

/**
 * 2) GAMBAR → /generate-from-image
 * form-data: image=<file>, prompt="Describe this image"
 */
app.post("/generate-from-image", upload.single("image"), async (req, res) => {
  const filePath = req.file?.path;
  const prompt = req.body?.prompt || "Describe this image";
  if (!filePath) return res.status(400).json({ error: "file image diperlukan" });

  try {
    const imagePart = {
      inlineData: {
        data: fs.readFileSync(filePath).toString("base64"),
        mimeType: req.file.mimetype || "image/png",
      },
    };
    const output = await runModel([prompt, imagePart]);
    res.json({ output });
  } catch (err) {
    res.status(500).json({ error: err.message || "gagal memproses" });
  } finally {
    safeUnlink(filePath);
  }
});

/**
 * 3) AUDIO → /generate-from-audio
 * form-data: audio=<file>, prompt opsional
 * (bisa untuk transkrip/analisis)
 */
app.post("/generate-from-audio", upload.single("audio"), async (req, res) => {
  const filePath = req.file?.path;
  const prompt = req.body?.prompt || "Transcribe or analyze the following audio:";
  if (!filePath) return res.status(400).json({ error: "file audio diperlukan" });

  try {
    const audioPart = {
      inlineData: {
        data: fs.readFileSync(filePath).toString("base64"),
        mimeType: req.file.mimetype || "audio/webm",
      },
    };
    const output = await runModel([prompt, audioPart]);
    res.json({ output });
  } catch (err) {
    res.status(500).json({ error: err.message || "gagal memproses" });
  } finally {
    safeUnlink(filePath);
  }
});

/**
 * 4) DOKUMEN (PDF/DOCX/TXT) → /generate-from-document
 * form-data: document=<file>, prompt opsional
 */
app.post("/generate-from-document", upload.single("document"), async (req, res) => {
  const filePath = req.file?.path;
  const prompt = req.body?.prompt || "Analyze this document:";
  if (!filePath) return res.status(400).json({ error: "file document diperlukan" });

  try {
    const documentPart = {
      inlineData: {
        data: fs.readFileSync(filePath).toString("base64"),
        mimeType: req.file.mimetype || "application/pdf",
      },
    };
    const output = await runModel([prompt, documentPart]);
    res.json({ output });
  } catch (err) {
    res.status(500).json({ error: err.message || "gagal memproses" });
  } finally {
    safeUnlink(filePath);
  }
});

app.listen(PORT, () => {
  console.log(`✅ Gemini app is running on port ${PORT}`);
});
