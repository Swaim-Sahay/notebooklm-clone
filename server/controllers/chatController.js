const { chatWithDocuments } = require("../services/chatService");

async function handleChat(req, res) {
  try {
    const { message, selectedFileIds } = req.body || {};
    const result = await chatWithDocuments(message, selectedFileIds);
    return res.json(result);
  } catch (err) {
    console.error("Chat error:", err);
    const msg = err.message || "Chat failed.";
    return res.status(400).json({ error: msg });
  }
}

module.exports = {
  handleChat,
};
