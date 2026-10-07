# IBKR delayed quote PoC

This is an **isolated, read-only proof of concept** for replacing Yahoo-style
unofficial quote fetching with Interactive Brokers' official TWS API market data.

It does **not** change Investtrack's production quote flow and contains no order
submission code.

## What it proves

- Connect to Trader Workstation (TWS) or IB Gateway over the official TWS API.
- Resolve configured stock symbols to a unique IBKR `conId`.
- Call `reqMarketDataType(3)`, which asks IBKR for delayed data when the account
  does not have the relevant live market-data subscription.
- Collect bid / ask / last / previous-close ticks.
- Emit Investtrack-friendly JSON with:
  - `quote_source`
  - `quote_type`
  - `quote_time`
  - `received_at`
  - `last_price`
  - `display_price`
  - `currency`
  - `conid`

IBKR documents delayed TWS API data as roughly **15-20 minutes delayed**. If the
logged-in account already has live permission for an instrument, TWS can return
live data even after market data type 3 is requested.

## Important timestamp semantics

The default TWS price-tick callbacks used here do not provide an authoritative
exchange trade timestamp. The PoC therefore **does not invent one**:

- `quote_time` = `null` for now.
- `received_at` = the UTC time when the bridge received the tick.
- `data_delay_minutes` = `"15-20"` when IBKR reports delayed data.

If we later use an IBKR endpoint/feed that supplies an authoritative quote
timestamp, it can populate `quote_time` separately.

## IBKR prerequisites on Windows

1. Install and log in to **TWS** or **IB Gateway**.
2. Install the **official TWS API bundle** from Interactive Brokers. IBKR states
   that third-party `pip`/NuGet copies are not the supported distribution.
3. Install the Python client from the official bundle, for example from:
   `C:\TWS API\source\pythonclient`

   Example using the local official source:

   ```powershell
   cd "C:\TWS API\source\pythonclient"
   python -m pip install .
   ```

4. In TWS / IB Gateway API settings:
   - enable socket API clients;
   - keep **Read-Only API** enabled;
   - for this local PoC, keep connections restricted to localhost;
   - confirm the socket port.

Common default ports:

| Session | Port |
| --- | ---: |
| TWS live | 7496 |
| TWS paper | 7497 |
| IB Gateway live | 4001 |
| IB Gateway paper | 4002 |

The script defaults to **4002** so the first test naturally targets a paper
IB Gateway session. Change the port explicitly if you use TWS or a live Gateway.

## Run

From the repository root:

```powershell
python tools/ibkr_quote_poc/bridge.py --port 4002 --output ibkr-quotes.json
```

TWS paper example:

```powershell
python tools/ibkr_quote_poc/bridge.py --port 7497 --output ibkr-quotes.json
```

The default `client-id` is 91 and can be changed:

```powershell
python tools/ibkr_quote_poc/bridge.py --port 4002 --client-id 92
```

## Test instruments

`instruments.json` currently contains ten liquid holdings/candidates spanning
US and European listings:

- ASML (AEB, EUR)
- LVMH / MC (SBF, EUR)
- Veolia / VIE (SBF, EUR)
- AMD, NVIDIA, CME Group, S&P Global, Chubb, Constellation Energy, Vistra

Contract resolution is intentionally fail-closed. If the configured symbol,
currency and primary exchange do not identify exactly one IBKR contract, the
quote is marked unavailable instead of silently taking the wrong listing.

## Output example

```json
{
  "generated_at": "2026-10-07T09:30:00Z",
  "quote_source": "IBKR_TWS",
  "requested_market_data_type": "DELAYED",
  "requested_market_data_type_code": 3,
  "quotes": [
    {
      "key": "ASML",
      "conid": 123456,
      "currency": "EUR",
      "quote_type": "DELAYED",
      "quote_source": "IBKR_TWS",
      "last_price": 1187.4,
      "display_price": 1187.4,
      "quote_time": null,
      "received_at": "2026-10-07T09:30:04Z",
      "data_delay_minutes": "15-20",
      "errors": []
    }
  ]
}
```

## Diagnostics

Useful outcomes:

- `quote_type: DELAYED`: the target path works as intended.
- `quote_type: LIVE`: your account has live permission and IBKR returned live
  data instead; this is valid.
- error **10186**: requested market data is not subscribed and delayed market
  data is not enabled/available for that request.
- no price inside the quote window: retry while the relevant market is open, or
  try delayed-frozen (type 4) as a separate follow-up experiment.

## Scope boundary

This PoC deliberately stops at JSON output. It does **not** yet:

- write quotes to Supabase;
- replace `priceService.js`;
- schedule a background bridge;
- submit, modify or cancel orders;
- request account positions.

Once the live test proves that IBKR returns usable delayed quotes for the actual
portfolio exchanges, the next step is a tiny local quote bridge that writes the
normalized payload to Supabase, with Investtrack consuming that cache.
