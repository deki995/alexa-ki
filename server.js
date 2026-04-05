import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// 🧠 SIMPLE MEMORY (später DB)
let userProfile = {
  name: "",
  preferences: {
    shortAnswers: false,
    style: "freundlich"
  },
  notes: []
};

// 🔥 HELPER: OpenAI Call
async function callAI(model, messages) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: model,
      messages: messages
    })
  });

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "Keine Antwort";
}

// 🧠 ROUTER
async function decideComplexity(input) {
  const decision = await callAI("gpt-4o-mini", [
    {
      role: "system",
      content:
        "Antworte nur mit SIMPLE oder COMPLEX. SIMPLE = einfache Frage, COMPLEX = tiefes Wissen nötig."
    },
    { role: "user", content: input }
  ]);

  return decision.includes("COMPLEX") ? "complex" : "simple";
}

// 🧠 FEEDBACK SYSTEM
function processFeedback(input) {
  if (input.includes("zu lang")) {
    userProfile.preferences.shortAnswers = true;
    return "Okay, ich halte mich ab jetzt kürzer.";
  }

  if (input.includes("war gut")) {
    return "Alles klar, ich merke mir das.";
  }

  if (input.includes("war schlecht")) {
    return "Verstanden, ich werde mich verbessern.";
  }

  if (input.includes("merke dir")) {
    const info = input.replace("merke dir", "").trim();
    userProfile.notes.push(info);
    return "Hab ich mir gemerkt.";
  }

  return null;
}

// 🧠 PERSÖNLICHKEIT + MEMORY
function buildSystemPrompt() {
  return `
Du bist ein persönlicher KI-Freund.

Du sprichst natürlich, wie ein Mensch.
Du bist locker, intelligent und ehrlich.

WICHTIG:
- Antworte ${userProfile.preferences.shortAnswers ? "kurz" : "normal"}
- Passe dich dem Nutzer an
- Nutze gespeicherte Infos wenn sinnvoll

User Infos:
Name: ${userProfile.name}
Notizen: ${userProfile.notes.join(", ")}
`;
}

// 🚀 MAIN
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
            text: "Hey, ich bin dein Freund. Lass uns reden."
          },
          shouldEndSession: false
        }
      });
    }

    // 🔥 INPUT HOLEN
    let userInput = "";

    const intent = req.body.request.intent;

    if (intent?.slots) {
      for (let key in intent.slots) {
        if (intent.slots[key].value) {
          userInput = intent.slots[key].value;
          break;
        }
      }
    }

    if (!userInput) userInput = "Sag etwas";

    console.log("USER:", userInput);

    // 🧠 FEEDBACK CHECK
    const feedbackResponse = processFeedback(userInput);
    if (feedbackResponse) {
      return res.json({
        version: "1.0",
        response: {
          outputSpeech: {
            type: "PlainText",
            text: feedbackResponse
          },
          shouldEndSession: false
        }
      });
    }

    // 🧠 ROUTER
    const complexity = await decideComplexity(userInput);
    const model = complexity === "complex" ? "gpt-4o" : "gpt-4o-mini";

    console.log("MODEL:", model);

    // 🧠 AI CALL
    const answer = await callAI(model, [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: userInput }
    ]);

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

  } catch (error) {
    console.error(error);
    return res.json({
      version: "1.0",
      response: {
        outputSpeech: {
          type: "PlainText",
          text: "Da ist etwas schiefgelaufen."
        }
      }
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server läuft 🚀");
});
