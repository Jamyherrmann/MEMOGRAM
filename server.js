require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { OpenAI } = require("openai");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const app = express();
const port = process.env.PORT || 3000;

const allowedOrigins = [
  "https://memogram.ch",
  "http://localhost:3000",
  "https://memogram-tdas.onrender.com",
  "null",
];

// CORS permissif
app.use(cors());

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({ dest: "uploads/" });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/generate-description", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    const { prompt, language } = req.body;

    if (!prompt || !language) {
      return res.status(400).json({ error: "Missing prompt or language" });
    }

    const imagePath = path.join(__dirname, req.file.path);

    const resizedBuffer = await sharp(imagePath)
      .resize({ width: 800 })
      .jpeg({ quality: 70 })
      .toBuffer();

    const base64Image = resizedBuffer.toString("base64");
    const mimeType = "image/jpeg";

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 200,
    });

    const result = response.choices[0].message.content;
    res.json({ description: result });

    fs.unlinkSync(imagePath); // Clean up temp file
  } catch (err) {
    console.error("API Error:", err);
    res.status(500).json({ error: "Error generating the description." });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
