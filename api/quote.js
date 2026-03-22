const YAHOO_MAP = {
  'DXY':     'DX-Y.NYB',
  'SOX':     '^SOX',
  'XAU/USD': 'GC=F',
  'XCU/USD': 'HG=F',
  'XBR/USD': 'BZ=F',
  'JP225':   '^N225',
  'TIP':     'TIP',   'GLD':  'GLD',   'HYG':  'HYG',
  'JNK':     'JNK',   'TLT':  'TLT',   'SHY':  'SHY',
  'LQD':     'LQD',   'XLK':  'XLK',   'XLF':  'XLF',
  'XLE':     'XLE',   'XLU':  'XLU',   'IWF':  'IWF',
  'MTUM':    'MTUM',  'EWJ':  'EWJ',   'DXJ':  'DXJ',
  'IWM':     'IWM',   'QUAL': 'QUAL',  'USMV': 'USMV',
  'USD/JPY': 'USDJPY=X', 'AUD/JPY': 'AUDJPY=X', 'CNH/JPY': 'CNHJPY=X',
};

async function fromYahoo(symbol) {
  const yahooSymbol = YAHOO_MAP[symbol] ?? symbol;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=5d`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
  });
  if (!r.ok) throw new Error(`Yahoo HTTP ${r.status}`);
  const json = await r.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`no result for ${yahooSymbol}`);
  const closes = result.indicators.quote[0].close.filter(v => v != null);
  if (closes.length < 2) throw new Error(`not enough closes for ${yahooSymbol}`);
  const last = closes[closes.length - 1];
  const prev = closes[closes.length - 2];
  return { last, prev, change: last - prev, changePct: ((last - prev) / prev) * 100 };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  // Twelve Dataを試みる
  try {
    const apiKey = process.env.TWELVE_DATA_KEY;
    if (!apiKey) throw new Error('no API key');
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`TD HTTP ${r.status}`);
    const d = await r.json();
    if (d.status === 'error' || !d.close) throw new Error(`TD: ${d.message || 'no close'}`);
    const last = parseFloat(d.close);
    const prev = parseFloat(d.previous_close);
    return res.status(200).json({ last, prev, change: last - prev, changePct: ((last - prev) / prev) * 100 });
  } catch (e) {
    console.log(`TD failed [${symbol}]: ${e.message}`);
  }

  // Yahoo Financeにフォールバック
  try {
    const data = await fromYahoo(symbol);
    return res.status(200).json(data);
  } catch (e) {
    console.error(`Yahoo failed [${symbol}]: ${e.message}`);
    return res.status(502).json({ error: `both failed: ${e.message}` });
  }
}
