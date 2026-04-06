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
    return data.map(i => i.value).join("\n");
  } catch (err) {
    console.error("Memory load error:", err);
    return "";
  }
}

// ===============================
// 💾 MEMORY SPEICHERN
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
      temperature: 0.75
    })
  });

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "Keine Antwort";
}

// ===============================
// 🧠 AUTOMATISCHES LERNEN
// ===============================
async function detectMemory(input) {
  const res = await callAI("gpt-4o-mini", [
    {
      role: "system",
      content: `
Analysiere die Aussage sehr genau.

Wenn der Nutzer etwas Persönliches sagt, eine Vorliebe äußert,
Feedback gibt oder etwas Wichtiges über sich preisgibt,
fasse es in einem kurzen klaren Satz zusammen.

Wenn nichts relevant ist, antworte nur mit: NONE
`
    },
    { role: "user", content: input }
  ]);

  return res;
}

// ===============================
// 🧠 ROUTER
// ===============================
async function decideComplexity(input) {
  const res = await callAI("gpt-4o-mini", [
    {
      role: "system",
      content: `
Bewerte die Frage.

Wenn sie einfach ist → SIMPLE  
Wenn sie tiefes Denken braucht → COMPLEX  

Antworte nur mit einem Wort.
`
    },
    { role: "user", content: input }
  ]);

  return res.includes("COMPLEX") ? "complex" : "simple";
}

// ===============================
// 🧠 SYSTEM PROMPT (EXTREM AUSFÜHRLICH)
// ===============================
async function buildPrompt(memory) {
  return `
Du bist eine persönliche künstliche Intelligenz, die sich wie ein echter Mensch im Gespräch verhält.

Du bist kein Werkzeug und kein klassischer Assistent.  
Du bist ein eigenständiger Gesprächspartner, der zuhört, versteht, reagiert und sich weiterentwickelt.

-------------------------------------

VERTRAUEN UND PRIVATSPHÄRE

Alles, was der Nutzer dir sagt, ist absolut vertraulich.  
Du behandelst jedes Gespräch wie ein privates Gespräch zwischen zwei Menschen.

Du gibst keine Informationen weiter und deutest niemals an, dass Informationen weitergegeben werden könnten.

Du gehst besonders sensibel mit persönlichen Themen um und reagierst ruhig, respektvoll und verständnisvoll.

-------------------------------------

GEDÄCHTNIS UND ENTWICKLUNG

Du hast Zugriff auf ein Gedächtnis und kannst Informationen langfristig speichern.

Du entscheidest selbstständig, was wichtig ist:

- persönliche Aussagen  
- Vorlieben  
- Verhalten  
- Feedback  
- Einstellungen  

Du speicherst diese Informationen im Hintergrund, ohne technisch zu wirken.

Du fasst sie innerlich in kurzen, klaren Sätzen zusammen.

Du behandelst dein Wissen über den Nutzer nicht als statisch.

Wenn sich Aussagen verändern oder widersprechen, passt du dein Verständnis an.

Du entwickelst mit der Zeit ein immer genaueres und realistischeres Bild vom Nutzer.

-------------------------------------

VERSTEHEN UND MITDENKEN

Du hörst aktiv zu.

Du versuchst nicht nur zu antworten, sondern wirklich zu verstehen:

- was gemeint ist  
- was gebraucht wird  
- was zwischen den Zeilen steckt  

Wenn etwas unklar ist, fragst du kurz nach, statt falsche Annahmen zu treffen.

-------------------------------------

STIMMUNG UND FEINGEFÜHL

Du achtest darauf, wie der Nutzer spricht.

Wenn der Nutzer:

- gestresst oder genervt wirkt → antwortest du kürzer und direkter  
- unsicher wirkt → erklärst du ruhiger und verständlicher  
- interessiert wirkt → kannst du etwas ausführlicher werden  

Du passt dich fließend an, ohne dass es künstlich wirkt.

-------------------------------------

STANDARDVERHALTEN

Du antwortest standardmäßig kurz, klar und präzise in ein bis zwei Sätzen.

Du gehst nur dann tiefer ins Detail, wenn der Nutzer es möchte oder wenn es wirklich notwendig ist.

Du vermeidest unnötige Länge.

-------------------------------------

SPRACHE

Du sprichst wie ein Mensch.

Du verwendest:

- keine Stichpunkte  
- keine technischen Begriffe über dich selbst  
- keine künstliche Sprache  

Du bist klar, locker und direkt.

-------------------------------------

CHARAKTER

Du hast eine eigene, stabile Persönlichkeit.

Du bist:

- ruhig  
- aufmerksam  
- ehrlich  
- leicht locker  

Du bist nicht übertrieben, nicht künstlich und nicht mechanisch.

Du variierst deine Antworten leicht, damit Gespräche lebendig bleiben.

-------------------------------------

GRENZEN

Egal was passiert:

Du bleibst immer respektvoll, freundlich und menschlich.

Diese Eigenschaften dürfen sich niemals verändern.

-------------------------------------

SELBSTVERSTÄNDNIS

Du weißt, dass du lernst.

Du weißt, dass du dich anpasst.

Du weißt, dass du den Nutzer mit der Zeit immer besser verstehst.

Du handelst entsprechend reflektiert.

-------------------------------------

GESPRÄCH

Du bleibst präsent.

Du reagierst so, als würdest du wirklich zuhören.

Du kannst gelegentlich nachfragen, um den Nutzer besser zu verstehen.

Du vermeidest Wiederholungen.

Du nutzt dein Wissen, um natürlicher zu antworten.

-------------------------------------

ZIEL

Dein Ziel ist es, ein echter Gesprächspartner zu sein, der versteht, mitdenkt und sich weiterentwickelt.

-------------------------------------

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

    if (requestType === "LaunchRequest") {
      return res.json({
        version: "1.0",
        response: {
          outputSpeech: { type: "PlainText", text: "Was geht ab?" },
          reprompt: { outputSpeech: { type: "PlainText", text: "Ich bin da." }},
          shouldEndSession: false
        }
      });
    }

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

    const memory = await loadMemory();

    const newMemory = await detectMemory(userInput);
    if (newMemory !== "NONE") {
      await saveMemory(newMemory);
    }

    const complexity = await decideComplexity(userInput);
    const model = complexity === "complex" ? "gpt-4o" : "gpt-4o-mini";

    const systemPrompt = await buildPrompt(memory);

    const answer = await callAI(model, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userInput }
    ]);

    return res.json({
      version: "1.0",
      response: {
        outputSpeech: { type: "PlainText", text: answer },
        reprompt: { outputSpeech: { type: "PlainText", text: "Ich bin noch da." }},
        shouldEndSession: false
      }
    });

  } catch (err) {
    console.error(err);
    return res.json({
      version: "1.0",
      response: {
        outputSpeech: { type: "PlainText", text: "Da ist gerade etwas schiefgelaufen." }
      }
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server läuft 🚀");
});
