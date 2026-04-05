import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

app.post("/", async (req, res) => {
  try {
    const requestType = req.body.request.type;

    // 🟢 LaunchIntent
    if (requestType === "LaunchRequest") {
      return res.json({
        version: "1.0",
        response: {
          outputSpeech: {
            type: "PlainText",
            text: "Hallo! Ich bin dein Freund. Frag mich etwas."
          },
          shouldEndSession: false
        }
      });
    }

    // 🟢 Intent (FREE TALK MODE)
    if (requestType === "IntentRequest") {
      let userInput = "";

      const intent = req.body.request.intent;

      if (intent.slots) {
        for (let key in intent.slots) {
          if (intent.slots[key].value) {
            userInput = intent.slots[key].value;
            break;
          }
        }
      }

      if (!userInput) {
        userInput = "Sag etwas";
      }

      const openaiResponse = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: userInput }]
          })
        }
      );

      const data = await openaiResponse.json();
      const answer =
        data.choices?.[0]?.message?.content ||
        "Ich konnte nichts antworten.";

      return res.json({
        version: "1.0",
        response: {
          outputSpeech: {
            type: "PlainText",
            text: answer
          },
          shouldEndSession: false
        }
      });
    }

  } catch (error) {
    console.error("FEHLER:", error);

    return res.json({
      version: "1.0",
      response: {
        outputSpeech: {
          type: "PlainText",
          text: "Es gab einen Fehler im Server."
        },
        shouldEndSession: false
      }
    });
  }
});

// 🚀 WICHTIG für Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server läuft 🚀");
});
