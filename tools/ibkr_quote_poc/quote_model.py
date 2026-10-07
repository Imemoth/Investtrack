"""Pure helpers for the IBKR delayed quote PoC.

This module deliberately has no ibapi dependency so it can be unit-tested in CI
without a running TWS/IB Gateway session.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Iterable


LIVE_PRICE_TICKS = {
    1: "bid",
    2: "ask",
    4: "last",
    9: "previous_close",
}

DELAYED_PRICE_TICKS = {
    66: "bid",
    67: "ask",
    68: "last",
    75: "previous_close",
}

MARKET_DATA_TYPES = {
    1: "LIVE",
    2: "FROZEN",
    3: "DELAYED",
    4: "DELAYED_FROZEN",
}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


@dataclass(frozen=True)
class InstrumentSpec:
    key: str
    label: str
    symbol: str
    currency: str
    sec_type: str = "STK"
    exchange: str = "SMART"
    primary_exchange: str | None = None

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "InstrumentSpec":
        required = ("key", "label", "symbol", "currency")
        missing = [name for name in required if not raw.get(name)]
        if missing:
            raise ValueError(f"Missing instrument fields: {', '.join(missing)}")
        return cls(
            key=str(raw["key"]),
            label=str(raw["label"]),
            symbol=str(raw["symbol"]).upper(),
            currency=str(raw["currency"]).upper(),
            sec_type=str(raw.get("sec_type", "STK")).upper(),
            exchange=str(raw.get("exchange", "SMART")).upper(),
            primary_exchange=(
                str(raw["primary_exchange"]).upper()
                if raw.get("primary_exchange")
                else None
            ),
        )


@dataclass(frozen=True)
class ContractCandidate:
    conid: int
    symbol: str
    sec_type: str
    currency: str
    exchange: str
    primary_exchange: str | None = None
    long_name: str | None = None


def choose_contract(
    spec: InstrumentSpec,
    candidates: Iterable[ContractCandidate],
) -> ContractCandidate:
    """Choose one exact contract or fail closed.

    Symbol, security type and currency must match. If primary_exchange is
    configured, it is mandatory as well. Ambiguous matches are rejected.
    """

    matches = [
        candidate
        for candidate in candidates
        if candidate.symbol.upper() == spec.symbol
        and candidate.sec_type.upper() == spec.sec_type
        and candidate.currency.upper() == spec.currency
        and (
            not spec.primary_exchange
            or (candidate.primary_exchange or "").upper() == spec.primary_exchange
        )
    ]

    if not matches:
        suffix = (
            f" / primary exchange {spec.primary_exchange}"
            if spec.primary_exchange
            else ""
        )
        raise LookupError(
            f"No exact IBKR contract for {spec.symbol} {spec.currency}{suffix}"
        )

    if len(matches) > 1:
        details = ", ".join(
            f"conId={item.conid}:{item.exchange}/{item.primary_exchange or '-'}"
            for item in matches
        )
        raise LookupError(
            f"Ambiguous IBKR contract for {spec.symbol}: {details}"
        )

    return matches[0]


@dataclass
class QuoteState:
    key: str
    label: str
    symbol: str
    conid: int
    currency: str
    exchange: str
    primary_exchange: str | None
    market_data_type_code: int | None = None
    quote_type: str = "UNKNOWN"
    bid: float | None = None
    ask: float | None = None
    last: float | None = None
    previous_close: float | None = None
    quote_time: str | None = None
    received_at: str | None = None
    errors: list[str] = field(default_factory=list)

    def set_market_data_type(self, market_data_type_code: int) -> None:
        self.market_data_type_code = market_data_type_code
        self.quote_type = MARKET_DATA_TYPES.get(
            market_data_type_code,
            f"UNKNOWN_{market_data_type_code}",
        )

    def apply_price_tick(
        self,
        tick_type: int,
        price: float,
        received_at: str | None = None,
    ) -> bool:
        if price is None or price < 0:
            return False

        field_name = DELAYED_PRICE_TICKS.get(tick_type)
        if field_name:
            if self.market_data_type_code is None:
                self.set_market_data_type(3)
        else:
            field_name = LIVE_PRICE_TICKS.get(tick_type)

        if not field_name:
            return False

        setattr(self, field_name, float(price))
        self.received_at = received_at or utc_now_iso()
        return True

    @property
    def display_price(self) -> float | None:
        if self.last is not None:
            return self.last
        if self.bid is not None and self.ask is not None:
            return (self.bid + self.ask) / 2
        return self.previous_close

    def to_payload(self) -> dict[str, Any]:
        delayed = self.quote_type in {"DELAYED", "DELAYED_FROZEN"}
        payload = asdict(self)
        payload.update(
            {
                "quote_source": "IBKR_TWS",
                "last_price": self.last,
                "display_price": self.display_price,
                "data_delay_minutes": "15-20" if delayed else 0,
                # Default TWS price ticks do not expose an exchange trade
                # timestamp. Do not fabricate one: received_at is tracked
                # separately and quote_time stays null unless a future source
                # provides an authoritative timestamp.
                "quote_time": self.quote_time,
            }
        )
        return payload
