// Twelve Data で取得を試み、失敗したら Yahoo Finance にフォールバック

const YAHOO_MAP = {
  'DXY':     'DX-Y.NYB',
  'SOX':     '^SOX',
  'XAU/USD': 'GC=F',
  'XCU/USD': 'HG=F',
  'XBR/USD': 'BZ=F',
  'JP225':   '^N225',
  'TIP':     'TIP',
  'GLD':     'GLD',
  'HYG':     'HYG',
  'JNK':     'JNK',
  'TLT':     'TLT',
  'SHY':     'SHY',
  'LQD':     'LQD',
  'XLK':     'XLK',
  'XLF':     'XLF',
  'XLE':     'XLE',
  'XLU':     'XLU',
  'IWF':     'IWF',
  'MTUM':    'MTUM',
  'EWJ':     'EWJ',
  'DXJ':     'DXJ',
  'IWM':     'IWM',
  'QUAL':    'QUAL',
  'USMV':    'USMV',
};

async function fromTwelveData(symbol, apiKey) {
  const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`TD HTTP ${r.status}`);
  const d = await r.json();
  if (d.status === 'error' || !d.close) throw new Error(d.message || 'no data');
  const last = parseFloat(d.close);
  const prev = parseFloat(d.previous_close);
  return { last, prev, change: last - prev, changePct: ((last - prev) / prev) * 100, source: 'twelvedata' };
}

async function fromYahoo(yahooSymbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=5d`;
  const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
  const r = await fetch(proxy);
  if (!r.ok) throw new Error(`Yahoo HTTP ${r.status}`);
  const json = await r.json();
  const parsed = JSON.parse(json.contents);
  const result = parsed?.chart?.result?.[0];
  if (!result) throw new Error('no yahoo result');
  const closes = result.indicators.quote[0].close.filter(v => v != null);
  const last = closes[closes.length - 1];
  const prev = closes[closes.length - 2];
  return { last, prev, change: last - prev, changePct: ((last - prev) / prev) * 100, source: 'yahoo' };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  const apiKey = process.env.TWELVE_DATA_KEY;

  // まずTwelve Dataを試みる
  try {
    const data = await fromTwelveData(symbol, apiKey);
    return res.status(200).json(data);
  } catch (e) {
    console.log(`TD failed for ${symbol}: ${e.message} → trying Yahoo`);
  }

  // 失敗したらYahoo Financeにフォールバック
  const yahooSymbol = YAHOO_MAP[symbol] ?? symbol;
  try {
    const data = await fromYahoo(yahooSymbol);
    return res.status(200).json(data);
  } catch (e) {
    console.error(`Yahoo also failed for ${symbol}: ${e.message}`);
    return res.status(502).json({ error: `both sources failed: ${e.message}` });
  }
}
