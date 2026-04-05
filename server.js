import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

app.post("/", async (req, res) => {
  try {
    const requestType = req.body.request.type;

    // 🔥 START
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

    // 🔥 INTENT
    if (requestType === "IntentRequest") {
      const intentName = req.body.request.intent.name;

      if (intentName === "FragKI") {
        const userInput =
          req.body.request.intent.slots?.frage?.value || "Sag etwas";

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
        const answer = data.choices[0].message.content;

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
    }

    // fallback
    return res.json({
      version: "1.0",
      response: {
        outputSpeech: {
          type: "PlainText",
          text: "Das habe ich nicht verstanden."
        }
      }
    });

  } catch (error) {
    console.error("FEHLER:", error);
    return res.json({
      version: "1.0",
      response: {
        outputSpeech: {
          type: "PlainText",
          text: "Fehler im Server."
        }
      }
    });
  }
});

app.get("/", (req, res) => {
  res.send("Server läuft 🚀");
});

app.listen(3000, () => {
  console.log("Server läuft");
});
