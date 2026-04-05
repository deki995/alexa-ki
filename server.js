import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

app.post("/", async (req, res) => {
    try {
        const intent = req.body.request.intent.name;

        if (intent === "FragKI") {
            const userInput = req.body.request.intent.slots.frage.value;

            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: [
                        { role: "user", content: userInput }
                    ]
                })
            });

            const data = await response.json();
            const answer = data.choices[0].message.content;

            res.json({
                version: "1.0",
                response: {
                    outputSpeech: {
                        type: "PlainText",
                        text: answer
                    },
                    shouldEndSession: false
                }
            });

        } else {
            res.json({
                version: "1.0",
                response: {
                    outputSpeech: {
                        type: "PlainText",
                        text: "Ich habe das nicht verstanden."
                    },
                    shouldEndSession: true
                }
            });
        }

    } catch (err) {
        console.error(err);
        res.json({
            version: "1.0",
            response: {
                outputSpeech: {
                    type: "PlainText",
                    text: "Fehler bei der KI."
                },
                shouldEndSession: true
            }
        });
    }
});

app.listen(3000, () => console.log("Server läuft"));
