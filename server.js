require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { OpenAI } = require("openai");
const fs = require("fs");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

// Liste blanche des domaines autorisés
const allowedOrigins = ["https://memogram.ch", "http://localhost:3000", "https://memogram-tdas.onrender.com", "null"];

// Middleware CORS strict
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  }
}));

// Middleware de sécurité supplémentaire
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || allowedOrigins.includes(origin)) {
    next();
  } else {
    res.status(403).json({ error: "Access denied from this origin" });
  }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({ dest: "uploads/" });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Nouvelle route dynamique
app.post("/generate-description", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    // Récupération des champs envoyés
    const { pictureDate, pictureTime, pictureLocation, language, person } = req.body;

    if (!pictureDate || !pictureTime || !pictureLocation || !language || !person) {
      return res.status(400).json({ error: "Missing required metadata" });
    }

    const imagePath = path.join(__dirname, req.file.path);
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString("base64");
    const mimeType = req.file.mimetype;

    const prompt = `Describe visually this image as if it was taken by ${person}, incorporating sensory details and emotions based on the image, such as its layout, colors, shapes, actions, details, and ambiance. Avoid adding details not present in the image. Be precise while maintaining an organic and human feel. Someone who hasn't seen this image should be able to imagine it vividly. Naturally embed information such as the date "${pictureDate}", time "${pictureTime}", and location "${pictureLocation}" into your narrative in a fluid and organic way. Avoid using negations; If something can't be described, simply omit it or find an alternative way to convey the essence. If there are persons, don't hesitate to describe them physically and identify age/gender impression. Do not mention directly that it's a picture or photo. Vary sentence structures and phrasing. Limit your response to 500 characters. Respond in ${language}. If you really can't describe it in any other way just respond with the code: "404" and nothing else.`;

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
      max_tokens: 300,
    });

    const result = response.choices[0].message.content;
    res.json({ description: result });

    fs.unlinkSync(imagePath); // Supprimer l'image après traitement
  } catch (err) {
    console.error("API Error:", err);
    res.status(500).json({ error: "Error generating the description." });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
