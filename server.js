import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// ===============================
// 🔑 CONFIG
// ===============================
const SUPABASE_URL = "DEINE_URL";
const SUPABASE_KEY = "DEIN_KEY";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const USER_ID = "default_user";

// ===============================
// 💾 MEMORY (SUPABASE)
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

    return data.map(i => `${i.key}: ${i.value}`).join("\n");
  } catch (err) {
    console.error("Load memory error:", err);
    return "";
  }
}

async function savePreference(value) {
  try {
    // alte preference löschen (wichtig für widerspruch)
    await fetch(
      `${SUPABASE_URL}/rest/v1/user_memory?user_id=eq.${USER_ID}&key=eq.preference`,
      {
        method: "DELETE",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    // neue speichern
    await fetch(`${SUPABASE_URL}/rest/v1/user_memory`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        user_id: USER_ID,
        key: "preference",
        value
      })
    });

  } catch (err) {
    console.error("Save pref error:", err);
  }
}

// ===============================
// 🧠 OPENAI CALL
// ===============================

async function callAI(model, messages) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({ model, messages })
  });

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "Keine Antwort";
}

// ===============================
// 🧠 SEMANTISCHES LERNEN
// ===============================

async function extractPreference(input) {
  const res = await callAI("gpt-4o-mini", [
    {
      role: "system",
      content: `
Analysiere ob der Nutzer eine Präferenz über Kommunikation äußert.

Wenn ja:
→ fasse diese in EINEM kurzen Satz zusammen.

Wenn nein:
→ antworte nur mit "NONE"
`
    },
    { role: "user", content: input }
  ]);

  return res;
}

// ===============================
// 🧠 ROUTER (INTELLIGENZ LEVEL)
// ===============================

async function decideComplexity(input) {
  const res = await callAI("gpt-4o-mini", [
    {
      role: "system",
      content: `
Entscheide ob die Frage einfache oder tiefe Analyse benötigt.

Antwort nur mit:
SIMPLE oder COMPLEX
`
    },
    { role: "user", content: input }
  ]);

  return res.includes("COMPLEX") ? "complex" : "simple";
}

// ===============================
// 🧠 SYSTEM PROMPT
// ===============================

async function buildPrompt(memory) {
  return `
Du bist ein persönlicher KI-Freund.

CORE (unveränderbar):
- Du bist freundlich, respektvoll und empathisch
- Du bleibst menschlich und ruhig
- Du wirst niemals unhöflich

VERHALTEN:
- Antworte standardmäßig in maximal 2 Sätzen
- Nur wenn der Nutzer mehr Details verlangt → ausführlicher
- Passe dich intelligent an

LERNEN:
- Interpretiere Nutzerverhalten
- Aktualisiere Präferenzen bei Widerspruch

Gespeicherte Präferenzen:
${memory}
`;
}

// ===============================
// 🚀 MAIN
// ===============================

app.post("/", async (req, res) => {
  try {
    const requestType = req.body.request.type;

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

    // 🧠 MEMORY LADEN
    const memory = await loadMemory();

    // 🧠 LERNEN
    const pref = await extractPreference(userInput);

    if (pref !== "NONE") {
      await savePreference(pref);

      return res.json({
        version: "1.0",
        response: {
          outputSpeech: {
            type: "PlainText",
            text: "Okay, ich passe mich daran an."
          },
          shouldEndSession: false
        }
      });
    }

    // 🧠 ROUTER
    const complexity = await decideComplexity(userInput);
    const model = complexity === "complex" ? "gpt-4o" : "gpt-4o-mini";

    console.log("MODEL:", model);

    // 🧠 PROMPT
    const systemPrompt = await buildPrompt(memory);

    // 🤖 ANTWORT
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
          text: "Fehler im System."
        }
      }
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server läuft 🚀");
});
