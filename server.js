import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// Health Check (wichtig für Render)
app.get("/", (req, res) => {
  res.send("Server läuft 🚀");
});

app.post("/", async (req, res) => {
  try {
    const intent = req.body.request?.intent?.name;

    if (intent === "FragKI") {
      const userInput = req.body.request.intent.slots.frage.value;

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: userInput
            }
          ]
        })
      });

      const data = await response.json();

      const text =
        data.choices?.[0]?.message?.content ||
        "Ich konnte keine Antwort finden.";

      return res.json({
        version: "1.0",
        response: {
          outputSpeech: {
            type: "PlainText",
            text: text
          },
          shouldEndSession: false
        }
      });
    }

    // Falls kein Intent passt
    return res.json({
      version: "1.0",
      response: {
        outputSpeech: {
          type: "PlainText",
          text: "Ich habe dich nicht verstanden."
        },
        shouldEndSession: false
      }
    });

  } catch (error) {
    console.error("ERROR:", error);

    return res.json({
      version: "1.0",
      response: {
        outputSpeech: {
          type: "PlainText",
          text: "Es ist ein Fehler aufgetreten."
        },
        shouldEndSession: true
      }
    });
  }
});

// ⚠️ WICHTIG für Render
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server läuft auf Port " + PORT);
});
