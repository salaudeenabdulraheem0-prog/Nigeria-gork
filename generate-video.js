exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Use POST." }) };
  }

  const apiKey = process.env.MAGIC_HOUR_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Server setup is incomplete: MAGIC_HOUR_API_KEY is not set in Netlify." }) };
  }

  let input;
  try { input = JSON.parse(event.body || "{}"); }
  catch (_) { return { statusCode: 400, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Invalid JSON." }) }; }

  const prompt = typeof input.prompt === "string" ? input.prompt.trim().slice(0, 1500) : "";
  if (!prompt) {
    return { statusCode: 400, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Enter a prompt first." }) };
  }

  try {
    const response = await fetch("https://api.magichour.ai/v1/text-to-video", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        end_seconds: 3.0,
        aspect_ratio: ["9:16", "16:9", "1:1"].includes(input.aspect_ratio) ? input.aspect_ratio : "9:16",
        style: { prompt: prompt },
        name: "Nigeria gork video",
        model: "ltx-2.5",
        resolution: "480p",
        audio: false
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        statusCode: response.status === 429 ? 429 : 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: data.message || data.error || "Magic Hour could not start the video job. Check API access and available credits." })
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Video request submitted. Check Magic Hour project history for progress.",
        project_id: data.id || data.project_id || null,
        credits_charged: data.credits_charged ?? null,
        response: data
      })
    };
  } catch (_) {
    return { statusCode: 502, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Could not reach Magic Hour. Please try again later." }) };
  }
};
