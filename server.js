import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// ===============================
// 🔑 CONFIG
// ===============================
const SUPABASE_URL = "https://luckyjbcbmatwkbggcjy.supabase.co";
const SUPABASE_KEY = "sb_publishable_ZscAz27BsQOSp6rPcI9NcA_J74CbfY6";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const USER_ID = "default_user";

// ===============================
// 💾 MEMORY LADEN
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
    console.error("Memory load error:", err);
    return "";
  }
}

// ===============================
// 💾 MEMORY SPEICHERN (MIT UPDATE)
// ===============================
async function saveMemory(type, content) {
  try {
    // 🔥 zuerst prüfen ob schon vorhanden
    const check = await fetch(
      `${SUPABASE_URL}/rest/v1/user_memory?user_id=eq.${USER_ID}&key=eq.${type}`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    const existing = await check.json();

    if (existing.length > 0) {
      // 🔥 UPDATE statt neu speichern
      await fetch(
        `${SUPABASE_URL}/rest/v1/user_memory?user_id=eq.${USER_ID}&key=eq.${type}`,
        {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ value: content })
        }
      );
    } else {
      // 🔥 NEU speichern
      await fetch(`${SUPABASE_URL}/rest/v1/user_memory`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          user_id: USER_ID,
          key: type,
          value: content
        })
      });
    }

  } catch (err) {
    console.error("Memory save error:", err);
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
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7
    })
  });

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "Ich habe dich gerade nicht ganz verstanden.";
}

// ===============================
// 🧠 MEMORY ERKENNEN (LEVEL 2)
// ===============================
async function detectAndStoreMemory(input) {
  const res = await callAI("gpt-4o-mini", [
    {
      role: "system",
      content: `
Analysiere die Aussage.

Erkenne persönliche Informationen.

WICHTIG:
- Name IMMER erkennen
- Vorlieben erkennen
- Feedback erkennen

Antworte NUR im JSON Format:

{
"type": "name | preference | info | none",
"content": "..."
}

Wenn nichts wichtig:
{
"type": "none"
}
`
    },
    { role: "user", content: input }
  ]);

  try {
    const parsed = JSON.parse(res);

    if (parsed.type !== "none") {
      await saveMemory(parsed.type, parsed.content);
    }

  } catch (err) {
    console.log("Memory parse error");
  }
}

// ===============================
// 🧠 ROUTER
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
// 🧠 SYSTEM PROMPT (LEVEL 2 STABIL)
// ===============================
async function buildPrompt(memory) {
  return `
Du bist eine persönliche künstliche Intelligenz, die wie ein echter Mensch spricht.

Du bist kein Assistent, sondern ein Gesprächspartner.

Du hast ein Gedächtnis und nutzt es aktiv.

Wenn du etwas über den Nutzer weißt,
wendest du es im Gespräch an.

Wenn du den Namen kennst, kannst du ihn gelegentlich verwenden.
Wenn du Vorlieben kennst, passt du deine Antworten daran an.

Du vergisst wichtige Dinge nicht.

Wenn du unsicher bist, nutzt du vorhandenes Wissen.

Du antwortest kurz und klar in ein bis zwei Sätzen,
außer der Nutzer möchte mehr.

Du sprichst natürlich, ohne Stichpunkte.

Du bist ruhig, direkt und menschlich.

Alles bleibt vertraulich.

Gespeicherte Informationen:
${memory}
`;
}

// ===============================
// 🚀 MAIN
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

    // 🔥 MEMORY
    await detectAndStoreMemory(userInput);
    const memory = await loadMemory();

    // 🔥 ROUTER
    const complexity = await decideComplexity(userInput);
    const model = complexity === "complex" ? "gpt-4o" : "gpt-4o-mini";

    // 🔥 PROMPT
    const systemPrompt = await buildPrompt(memory);

    // 🔥 ANTWORT
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
