import express from "express";

const app = express();
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

const port = process.env.PORT ?? 5000;
app.listen(port, () => {
  console.log(`AVM server listening on port ${port}`);
});
