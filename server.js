if (requestType === "IntentRequest") {
  let userInput = "";

  // 🔥 egal welcher Intent → wir holen einfach Text
  if (req.body.request.intent.slots) {
    const slots = req.body.request.intent.slots;
    for (let key in slots) {
      if (slots[key].value) {
        userInput = slots[key].value;
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
