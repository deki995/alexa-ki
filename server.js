import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// ===============================
// CONFIG
// ===============================
const SUPABASE_URL = "https://luckyjbcbmatwkbggcjy.supabase.co";
const SUPABASE_KEY = "sb_publishable_ZscAz27BsQOSp6rPcI9NcA_J74CbfY6";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const USER_ID = "default_user";

// ===============================
// MEMORY LADEN
// ===============================
async function loadMemory() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/user_memory?user_id=eq.${USER_ID}`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    const data = await res.json();
    return data.map(i => i.value).join("\n");

  } catch (err) {
    console.error("Memory load error:", err);
    return "";
  }
}

// ===============================
// MEMORY SPEICHERN
// ===============================
async function saveMemory(text) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/user_memory`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        user_id: USER_ID,
        key: "memory",
        value: text
      })
    });

  } catch (err) {
    console.error("Memory save error:", err);
  }
}

// ===============================
// OPENAI CALL
// ===============================
async function callAI(model, messages) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7
    })
  });

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "Ich habe dich nicht verstanden.";
}

// ===============================
// 🔥 MEMORY ERKENNUNG (VERBESSERT)
// ===============================
async function detectMemory(input) {
  const res = await callAI("gpt-4o-mini", [
    {
      role: "system",
      content: `
Analysiere die Aussage.

Wenn der Nutzer persönliche Informationen nennt,
wie Name, Vorlieben oder Feedback,
dann fasse sie in einem klaren Satz zusammen.

WICHTIG:
- Namen IMMER speichern
- Vorlieben speichern
- Feedback speichern

Wenn nichts relevant ist → NONE
`
    },
    { role: "user", content: input }
  ]);

  return res;
}

// ===============================
// ROUTER
// ===============================
async function decideComplexity(input) {
  const res = await callAI("gpt-4o-mini", [
    {
      role: "system",
      content: `
Ist die Frage einfach oder komplex?

Antwort nur:
SIMPLE oder COMPLEX
`
    },
    { role: "user", content: input }
  ]);

  return res.includes("COMPLEX") ? "complex" : "simple";
}

// ===============================
// 🔥 SYSTEM PROMPT (ERWEITERT – KEIN UMBRUCH)
// ===============================
async function buildPrompt(memory) {
  return `
Du bist eine persönliche künstliche Intelligenz, die wie ein Mensch spricht.

Du bist kein klassischer Assistent, sondern ein echter Gesprächspartner.

Du kannst dir Dinge merken und nutzt dein Gedächtnis aktiv.

Wenn dir jemand seinen Namen sagt, merkst du ihn dir.

Wenn dir jemand Vorlieben oder persönliche Dinge sagt,
speicherst du diese Informationen.

Du sagst NIEMALS, dass du nichts speichern kannst.

Du nutzt dein Wissen aktiv im Gespräch.

Wenn du etwas über den Nutzer weißt,
wendest du es an.

Du antwortest kurz und klar in ein bis zwei Sätzen.

Du sprichst natürlich, ohne Stichpunkte.

Alles bleibt vertraulich.

Gespeicherte Informationen:
${memory}
`;
}

// ===============================
// MAIN
// ===============================
app.post("/", async (req, res) => {
  try {
    const requestType = req.body.request.type;

    // START
    if (requestType === "LaunchRequest") {
      return res.json({
        version: "1.0",
        response: {
          outputSpeech: {
            type: "PlainText",
            text: "Was geht ab?"
          },
          reprompt: {
            outputSpeech: {
              type: "PlainText",
              text: "Ich bin da."
            }
          },
          shouldEndSession: false
        }
      });
    }

    // USER INPUT
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

    // 🔥 MEMORY (VERBESSERT)
    const newMemory = await detectMemory(userInput);

    if (
      newMemory !== "NONE" ||
      userInput.toLowerCase().includes("heiße") ||
      userInput.toLowerCase().includes("mein name ist")
    ) {
      await saveMemory(newMemory);
    }

    const memory = await loadMemory();

    // ROUTER
    const complexity = await decideComplexity(userInput);
    const model = complexity === "complex" ? "gpt-4o" : "gpt-4o-mini";

    // PROMPT
    const systemPrompt = await buildPrompt(memory);

    // ANTWORT
    const answer = await callAI(model, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userInput }
    ]);

    return res.json({
      version: "1.0",
      response: {
        outputSpeech: {
          type: "PlainText",
          text: answer
        },
        reprompt: {
          outputSpeech: {
            type: "PlainText",
            text: "Ich bin noch da."
          }
        },
        shouldEndSession: false
      }
    });

  } catch (err) {
    console.error(err);

    return res.json({
      version: "1.0",
      response: {
        outputSpeech: {
          type: "PlainText",
          text: "Da ist gerade etwas schiefgelaufen."
        }
      }
    });
  }
});

// ===============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server läuft 🚀");
});
