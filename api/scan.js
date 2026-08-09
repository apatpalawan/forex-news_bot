// Endpoint หลักที่ cron-job.org เรียกทุก 1 นาที: GET /api/scan?secret=CRON_SECRET
const config = require("../config");
const { runScan } = require("../lib/scanRunner");

module.exports = async (req, res) => {
  try {
    const secret = req.query.secret || "";
    if (config.CRON_SECRET && secret !== config.CRON_SECRET) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const result = await runScan();
    res.status(200).json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
};
