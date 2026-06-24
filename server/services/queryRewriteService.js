const { Groq } = require("groq-sdk");
const { GROQ_API_KEY } = require("../utils/env");

let client = null;
function getClient() {
  if (!client) client = new Groq({ apiKey: GROQ_API_KEY });
  return client;
}

const REWRITE_MODEL = "llama-3.3-70b-versatile";

const SYSTEM_PROMPT = [
  "You rewrite a user's natural-language question into a short, self-contained",
  "search query optimized for retrieving relevant passages from documents.",
  "Rules:",
  "- Output ONE single line. No preamble, no numbering, no quotes.",
  "- Preserve the user's language.",
  "- Replace pronouns ('it', 'they') and references ('this paper', 'the article') with the most likely concrete topic from the user's question.",
  "- Drop conversational filler ('can you', 'please', 'I want to know').",
  "- Keep named entities, technical terms, and qualifiers.",
].join("\n");

/**
 * @param {string} question
 * @returns {Promise<string>}  rewritten query (falls back to original on any failure)
 */
async function rewriteQuery(question) {
  const trimmed = (question || "").trim();
  if (!trimmed) return "";

  try {
    const completion = await getClient().chat.completions.create({
      model: REWRITE_MODEL,
      temperature: 0,
      max_tokens: 120,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: trimmed },
      ],
    });
    const out = (completion.choices?.[0]?.message?.content || "").trim();
    if (!out) return trimmed;
    // Take only the first non-empty line (in case model wraps anyway).
    const firstLine = out.split(/\r?\n/).map((l) => l.trim()).find(Boolean);
    return firstLine || trimmed;
  } catch (err) {
    console.warn("[rewrite] failed, using original query:", err.message);
    return trimmed;
  }
}

module.exports = { rewriteQuery };