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

// ✅ Et remplacer par ce CORS permissif :
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

    const { pictureDate, pictureTime, pictureLocation, language, person } = req.body;
    if (!pictureDate || !pictureTime || !pictureLocation || !language || !person) {
      return res.status(400).json({ error: "Missing required metadata" });
    }

    const imagePath = path.join(__dirname, req.file.path);

    // 🔧 Resize and compress image
    const resizedBuffer = await sharp(imagePath)
      .resize({ width: 800 })
      .jpeg({ quality: 70 })
      .toBuffer();

    const base64Image = resizedBuffer.toString("base64");
    const mimeType = "image/jpeg";

    // 🧠 Prompt optimisé (plus court mais expressif)
    const prompt = `You are a perceptive narrator witnessing this scene as if through the eyes of ${person}. Describe what is clearly visible: layout, colors, objects, physical actions, emotional atmosphere, and human presence. If there are people, focus on: their physical appearance, estimated age range, gender impression, body language, and emotional expressions. Describe what is happening, as clearly and naturally as possible, based only on the visible. Don't also forget to explain details and what is happening in the background.

    If something is ambiguous or sensitive, describe its visual effect, atmosphere, or implied meaning without speculating or labeling. Do not use negations or mention limitations. Reframe or omit discreetly.
    
    Naturally weave in the context of the date "${pictureDate}", time "${pictureTime}", and location "${pictureLocation}" as part of the scene. Do not mention that this is an image or photo. Vary sentence structure. Limit the response to 500 characters. Respond only in ${language}. Always produce a description — reinterpret rather than refuse.`;
    

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

    fs.unlinkSync(imagePath); // Supprimer le fichier temporaire
  } catch (err) {
    console.error("API Error:", err);
    res.status(500).json({ error: "Error generating the description." });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
