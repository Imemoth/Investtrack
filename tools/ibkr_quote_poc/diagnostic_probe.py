"""Raw IBKR market-data diagnostic probe.

Prints every market-data callback without Investtrack normalization so we can
separate IBKR/TWS entitlement or timing issues from PoC mapping issues.
Read-only: no order methods are called.
"""

from __future__ import annotations

import argparse
import threading
import time

from ibapi.client import EClient
from ibapi.contract import Contract
from ibapi.ticktype import TickTypeEnum
from ibapi.wrapper import EWrapper


class Probe(EWrapper, EClient):
    def __init__(self) -> None:
        EClient.__init__(self, self)
        self.ready = threading.Event()

    def nextValidId(self, orderId: int) -> None:  # noqa: N802
        print(f"API READY nextValidId={orderId}")
        self.ready.set()

    def error(  # noqa: N802
        self,
        reqId: int,
        errorTime: int,
        errorCode: int,
        errorString: str,
        advancedOrderRejectJson: str = "",
    ) -> None:
        print(
            f"ERROR reqId={reqId} time={errorTime} "
            f"code={errorCode} message={errorString}"
        )

    def marketDataType(self, reqId: int, marketDataType: int) -> None:  # noqa: N802
        print(f"MARKET_DATA_TYPE reqId={reqId} type={marketDataType}")

    def tickPrice(self, reqId: int, tickType: int, price: float, attrib) -> None:  # noqa: N802
        print(
            f"TICK_PRICE reqId={reqId} "
            f"type={tickType}:{TickTypeEnum.toStr(tickType)} price={price}"
        )

    def tickSize(self, reqId: int, tickType: int, size) -> None:  # noqa: N802
        print(
            f"TICK_SIZE reqId={reqId} "
            f"type={tickType}:{TickTypeEnum.toStr(tickType)} size={size}"
        )

    def tickString(self, reqId: int, tickType: int, value: str) -> None:  # noqa: N802
        print(
            f"TICK_STRING reqId={reqId} "
            f"type={tickType}:{TickTypeEnum.toStr(tickType)} value={value}"
        )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=7496)
    parser.add_argument("--client-id", type=int, default=92)
    parser.add_argument("--symbol", default="ASML")
    parser.add_argument("--currency", default="EUR")
    parser.add_argument("--exchange", default="SMART")
    parser.add_argument("--primary-exchange", default="AEB")
    parser.add_argument("--market-data-type", type=int, choices=(3, 4), default=3)
    parser.add_argument("--seconds", type=float, default=30.0)
    parser.add_argument("--startup-wait", type=float, default=2.0)
    args = parser.parse_args()

    app = Probe()
    app.connect(args.host, args.port, clientId=args.client_id)
    thread = threading.Thread(target=app.run, daemon=True)
    thread.start()

    if not app.ready.wait(10):
        print("API did not become ready within 10 seconds")
        app.disconnect()
        return 2

    time.sleep(args.startup_wait)

    contract = Contract()
    contract.symbol = args.symbol.upper()
    contract.secType = "STK"
    contract.exchange = args.exchange.upper()
    contract.currency = args.currency.upper()
    if args.primary_exchange:
        contract.primaryExchange = args.primary_exchange.upper()

    print(
        f"REQUEST symbol={contract.symbol} currency={contract.currency} "
        f"exchange={contract.exchange} primary={contract.primaryExchange} "
        f"marketDataType={args.market_data_type} seconds={args.seconds}"
    )

    app.reqMarketDataType(args.market_data_type)
    app.reqMktData(9001, contract, "", False, False, [])

    time.sleep(args.seconds)
    app.cancelMktData(9001)
    app.disconnect()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
