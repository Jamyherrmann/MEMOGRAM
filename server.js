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
    const prompt = `Describe visually this image as if it was taken by ${person}, incorporating sensory details and emotions based on the image, such as its layout, colors, shapes, actions, details, and ambiance. Avoid adding details not present in the image. Be precise while maintaining an organic and human feel. Someone who hasn't seen this image should be able to imagine it vividly. Naturally embed information such as the date "${pictureDate}", time "${pictureTime}", and location "${pictureLocation}" into your narrative in a fluid and organic way. Avoid using negations; If something can't be described, simply omit it or find an alternative way to convey the essence. If there are persons, don't hesitate to describe them physically and identify age/gender impression. Do not mention directly that it's a picture or photo. Vary sentence structures and phrasing. Limit your response to 500 characters. Respond in ${language}. If you really can't describe it in any other way just respond by explaining why you can't with this photo and nothing else.`;

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
