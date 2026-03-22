export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { series_id } = req.query;
  if (!series_id) return res.status(400).json({ error: 'series_id required' });

  const key = process.env.FRED_API_KEY;
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${series_id}&api_key=${key}&file_type=json&sort_order=desc&limit=5`;

  try {
    const r = await fetch(url);
    const data = await r.json();
    const obs = data.observations?.filter(o => o.value !== '.') ?? [];
    const latest = obs[0];
    const prev   = obs[1];
    res.status(200).json({
      value: parseFloat(latest?.value),
      prev:  parseFloat(prev?.value),
      date:  latest?.date
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
