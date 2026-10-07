"""Read-only IBKR TWS/IB Gateway delayed market-data proof of concept.

No order methods are called. The script resolves configured stock contracts,
requests market data type 3 (delayed), listens briefly for quotes, and emits JSON.

The official IBKR Python API must be installed from the TWS API bundle.
"""

from __future__ import annotations

import argparse
import json
import sys
import threading
import time
from pathlib import Path
from typing import Any

try:
    from ibapi.client import EClient
    from ibapi.contract import Contract
    from ibapi.wrapper import EWrapper
except ImportError as exc:  # pragma: no cover - requires local IBKR install
    raise SystemExit(
        "IBKR Python API (ibapi) is not installed. Install it from the official "
        "TWS API bundle; see tools/ibkr_quote_poc/README.md."
    ) from exc

from quote_model import (
    ContractCandidate,
    InstrumentSpec,
    QuoteState,
    choose_contract,
    utc_now_iso,
)


INFO_ERROR_CODES = {
    2104,  # Market data farm connection is OK
    2106,  # Historical data farm connection is OK
    2107,  # Historical data farm connection inactive
    2108,  # Market data farm connection inactive
    2158,  # Sec-def data farm connection is OK
}


class IbkrQuoteApp(EWrapper, EClient):
    def __init__(self) -> None:
        EClient.__init__(self, self)
        self.ready = threading.Event()
        self._lock = threading.Lock()
        self.contract_results: dict[int, list[ContractCandidate]] = {}
        self.contract_events: dict[int, threading.Event] = {}
        self.quote_states: dict[int, QuoteState] = {}
        self.errors_by_req: dict[int, list[str]] = {}

    def nextValidId(self, orderId: int) -> None:  # noqa: N802 - IBKR callback name
        # Connection readiness only. We never submit orders in this PoC.
        self.ready.set()

    def contractDetails(self, reqId: int, contractDetails: Any) -> None:  # noqa: N802
        contract = contractDetails.contract
        candidate = ContractCandidate(
            conid=int(contract.conId),
            symbol=str(contract.symbol or ""),
            sec_type=str(contract.secType or ""),
            currency=str(contract.currency or ""),
            exchange=str(contract.exchange or ""),
            primary_exchange=str(contract.primaryExchange or "") or None,
            long_name=str(getattr(contractDetails, "longName", "") or "") or None,
        )
        with self._lock:
            self.contract_results.setdefault(reqId, []).append(candidate)

    def contractDetailsEnd(self, reqId: int) -> None:  # noqa: N802
        event = self.contract_events.get(reqId)
        if event:
            event.set()

    def marketDataType(self, reqId: int, marketDataType: int) -> None:  # noqa: N802
        state = self.quote_states.get(reqId)
        if state:
            state.set_market_data_type(int(marketDataType))

    def tickPrice(self, reqId: int, tickType: int, price: float, attrib: Any) -> None:  # noqa: N802
        state = self.quote_states.get(reqId)
        if state:
            state.apply_price_tick(
                int(tickType),
                float(price),
                received_at=utc_now_iso(),
            )

    def error(
        self,
        reqId: int,
        errorTime: int,
        errorCode: int,
        errorString: str,
        advancedOrderRejectJson: str = "",
    ) -> None:
        # TWS API 10.33+ added errorTime as the second callback argument.
        # Keep it in the signature even though this PoC only needs code/message.
        if int(errorCode) in INFO_ERROR_CODES:
            return
        message = f"{errorCode}: {errorString}"
        with self._lock:
            self.errors_by_req.setdefault(int(reqId), []).append(message)
        state = self.quote_states.get(int(reqId))
        if state and message not in state.errors:
            state.errors.append(message)


def build_contract(spec: InstrumentSpec) -> Contract:
    contract = Contract()
    contract.symbol = spec.symbol
    contract.secType = spec.sec_type
    contract.exchange = spec.exchange
    contract.currency = spec.currency
    if spec.primary_exchange:
        contract.primaryExchange = spec.primary_exchange
    return contract


def resolved_contract(candidate: ContractCandidate) -> Contract:
    contract = Contract()
    contract.conId = candidate.conid
    contract.secType = candidate.sec_type
    contract.exchange = "SMART"
    contract.currency = candidate.currency
    return contract


def load_instruments(path: Path) -> list[InstrumentSpec]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, list) or not raw:
        raise ValueError("Instrument file must contain a non-empty JSON array")
    specs = [InstrumentSpec.from_dict(item) for item in raw]
    keys = [item.key for item in specs]
    if len(keys) != len(set(keys)):
        raise ValueError("Instrument keys must be unique")
    return specs


def resolve_contracts(
    app: IbkrQuoteApp,
    specs: list[InstrumentSpec],
    timeout_seconds: float,
) -> tuple[dict[str, ContractCandidate], dict[str, list[str]]]:
    request_map: dict[int, InstrumentSpec] = {}

    for index, spec in enumerate(specs):
        req_id = 1000 + index
        request_map[req_id] = spec
        app.contract_events[req_id] = threading.Event()
        app.contract_results[req_id] = []
        app.reqContractDetails(req_id, build_contract(spec))

    resolved: dict[str, ContractCandidate] = {}
    failures: dict[str, list[str]] = {}

    for req_id, spec in request_map.items():
        if not app.contract_events[req_id].wait(timeout_seconds):
            failures[spec.key] = [
                f"Contract lookup timed out after {timeout_seconds:.1f}s"
            ]
            continue

        candidates = app.contract_results.get(req_id, [])
        try:
            resolved[spec.key] = choose_contract(spec, candidates)
        except LookupError as exc:
            messages = [str(exc)]
            messages.extend(app.errors_by_req.get(req_id, []))
            failures[spec.key] = messages

    return resolved, failures


def collect_quotes(
    app: IbkrQuoteApp,
    specs: list[InstrumentSpec],
    resolved: dict[str, ContractCandidate],
    failures: dict[str, list[str]],
    wait_seconds: float,
) -> list[dict[str, Any]]:
    request_ids: list[int] = []

    # Type 3 tells TWS/IB Gateway to use free delayed quotes when live
    # permissions are not available. If live permissions exist, IBKR may return
    # market data type 1 instead.
    app.reqMarketDataType(3)

    for index, spec in enumerate(specs):
        candidate = resolved.get(spec.key)
        if not candidate:
            continue

        req_id = 2000 + index
        state = QuoteState(
            key=spec.key,
            label=spec.label,
            symbol=spec.symbol,
            conid=candidate.conid,
            currency=candidate.currency,
            exchange=candidate.exchange,
            primary_exchange=candidate.primary_exchange,
        )
        app.quote_states[req_id] = state
        request_ids.append(req_id)
        app.reqMktData(
            req_id,
            resolved_contract(candidate),
            "",
            False,
            False,
            [],
        )

    deadline = time.monotonic() + wait_seconds
    while time.monotonic() < deadline:
        # Stop early once every resolved instrument has at least a usable price.
        if request_ids and all(
            app.quote_states[req_id].display_price is not None
            for req_id in request_ids
        ):
            break
        time.sleep(0.10)

    for req_id in request_ids:
        app.cancelMktData(req_id)

    output: list[dict[str, Any]] = []
    for spec in specs:
        candidate = resolved.get(spec.key)
        if not candidate:
            output.append(
                {
                    "key": spec.key,
                    "label": spec.label,
                    "symbol": spec.symbol,
                    "currency": spec.currency,
                    "quote_source": "IBKR_TWS",
                    "quote_type": "UNAVAILABLE",
                    "quote_time": None,
                    "received_at": None,
                    "last_price": None,
                    "display_price": None,
                    "errors": failures.get(spec.key, ["Contract resolution failed"]),
                }
            )
            continue

        req_id = 2000 + specs.index(spec)
        state = app.quote_states[req_id]
        for message in app.errors_by_req.get(req_id, []):
            if message not in state.errors:
                state.errors.append(message)
        if state.display_price is None and not state.errors:
            state.errors.append(
                "No usable bid/ask/last price arrived inside the quote window"
            )
        output.append(state.to_payload())

    return output


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Read-only IBKR delayed quote PoC for Investtrack"
    )
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument(
        "--port",
        type=int,
        default=4002,
        help="IB Gateway paper default: 4002; live Gateway: 4001; TWS paper: 7497; TWS live: 7496",
    )
    parser.add_argument("--client-id", type=int, default=91)
    parser.add_argument(
        "--instruments",
        type=Path,
        default=Path(__file__).with_name("instruments.json"),
    )
    parser.add_argument("--contract-timeout", type=float, default=6.0)
    parser.add_argument("--wait-seconds", type=float, default=8.0)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    specs = load_instruments(args.instruments)
    app = IbkrQuoteApp()

    try:
        app.connect(args.host, args.port, clientId=args.client_id)
    except Exception as exc:
        print(f"IBKR connection failed: {exc}", file=sys.stderr)
        return 2

    api_thread = threading.Thread(target=app.run, name="ibkr-api", daemon=True)
    api_thread.start()

    if not app.ready.wait(10):
        app.disconnect()
        print(
            "Connected socket did not become API-ready within 10 seconds. "
            "Check API settings, port and login.",
            file=sys.stderr,
        )
        return 3

    try:
        resolved, failures = resolve_contracts(
            app,
            specs,
            timeout_seconds=args.contract_timeout,
        )
        quotes = collect_quotes(
            app,
            specs,
            resolved,
            failures,
            wait_seconds=args.wait_seconds,
        )
        document = {
            "generated_at": utc_now_iso(),
            "quote_source": "IBKR_TWS",
            "requested_market_data_type": "DELAYED",
            "requested_market_data_type_code": 3,
            "host": args.host,
            "port": args.port,
            "quotes": quotes,
        }
        rendered = json.dumps(document, indent=2, ensure_ascii=False)
        if args.output:
            args.output.write_text(rendered + "\n", encoding="utf-8")
            print(f"Wrote {args.output}")
        else:
            print(rendered)
    finally:
        app.disconnect()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
