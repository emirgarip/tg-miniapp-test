module.exports = (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }
  res.status(200).json({ message: "Hello from backend API" });
};
