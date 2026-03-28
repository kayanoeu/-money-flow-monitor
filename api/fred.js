export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { series_id } = req.query;
  if (!series_id) return res.status(400).json({ error: 'series_id required' });

  const key = process.env.FRED_API_KEY;
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${series_id}&api_key=${key}&file_type=json&sort_order=desc&limit=10`;

  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`FRED HTTP ${r.status}`);
    const data = await r.json();

    // 有効な値（"."でないもの）だけ抽出
    const obs = (data.observations ?? []).filter(o => o.value !== '.');

    if (obs.length < 2) {
      return res.status(200).json({ value: 0, prev: 0, date: null });
    }

    const latest = parseFloat(obs[0].value);
    const prev   = parseFloat(obs[1].value);

    // どちらかがNaNなら0扱い
    if (isNaN(latest) || isNaN(prev)) {
      return res.status(200).json({ value: 0, prev: 0, date: obs[0].date });
    }

    return res.status(200).json({
      value: latest,
      prev:  prev,
      date:  obs[0].date
    });

  } catch (e) {
    console.error(`FRED error [${series_id}]: ${e.message}`);
    return res.status(500).json({ error: e.message });
  }
}
