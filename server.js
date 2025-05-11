require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { OpenAI } = require("openai");
const fs = require("fs");
const path = require("path");

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, "public"))); // Serve static files from 'public' directory

// Multer setup for handling file uploads
const upload = multer({ dest: "uploads/" });

// OpenAI configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Route to serve the HTML file
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Endpoint to handle image upload and generate description
app.post("/generate-description", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image uploaded" });
  }

  const imagePath = path.join(__dirname, req.file.path);
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");
  const mimeType = req.file.mimetype;

  // Example metadata; in a real application, these would be dynamic
  const pictureDate = "13.7.2022";
  const pictureTime = "15:34";
  const pictureLocation = "Rue de Bernex 350, 1233 Bernex, Suisse";
  const language = "french";
  const person = "someone";

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Describe visually this image as if it was taken by ${person}, incorporating sensory details and emotions based on the image, such as its layout, colors, shapes, actions, details, and ambiance. Avoid adding details not present in the image. Be precise while maintaining an organic and human feel. Someone who hasn't seen this image should be able to imagine it vividly. Naturally embed information such as the date "${pictureDate}", time "${pictureTime}", and location "${pictureLocation}" into your narrative in a fluid and organic way, it doesn't have to be the exact day and time, you can also mention these infos in more subtile ways, without listing them upfront. Avoid using negations; If something can't be described, simply omit it or find an alternative way to convey the essence. If there are persons, don't hesitate to describe physicaly the characters and if there are more feminin or masculin, old or young. Do not mention directly that it's a picture or photo. Vary sentence structures and phrasing to ensure each description feels unique. Limit your response to 500 characters. Respond in ${language}. If you really can't describe it in any other way just respond with the code: "404" and nothing else`,
            },
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
  } catch (err) {
    console.error("API Error:", err);
    res.status(500).json({ error: "Error generating the description." });
  } finally {
    fs.unlinkSync(imagePath); // Delete the uploaded image after processing
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
