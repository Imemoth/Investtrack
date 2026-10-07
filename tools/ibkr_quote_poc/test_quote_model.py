import unittest

from quote_model import (
    ContractCandidate,
    InstrumentSpec,
    QuoteState,
    choose_contract,
)


class ContractResolutionTests(unittest.TestCase):
    def test_selects_exact_primary_exchange(self):
        spec = InstrumentSpec(
            key="asml",
            label="ASML",
            symbol="ASML",
            currency="EUR",
            primary_exchange="AEB",
        )
        candidates = [
            ContractCandidate(
                conid=1,
                symbol="ASML",
                sec_type="STK",
                currency="EUR",
                exchange="SMART",
                primary_exchange="AEB",
            ),
            ContractCandidate(
                conid=2,
                symbol="ASML",
                sec_type="STK",
                currency="USD",
                exchange="SMART",
                primary_exchange="NASDAQ",
            ),
        ]

        selected = choose_contract(spec, candidates)

        self.assertEqual(selected.conid, 1)

    def test_fails_closed_when_ambiguous(self):
        spec = InstrumentSpec(
            key="test",
            label="Test",
            symbol="ABC",
            currency="USD",
        )
        candidates = [
            ContractCandidate(1, "ABC", "STK", "USD", "SMART", "NYSE"),
            ContractCandidate(2, "ABC", "STK", "USD", "SMART", "NASDAQ"),
        ]

        with self.assertRaisesRegex(LookupError, "Ambiguous"):
            choose_contract(spec, candidates)


class QuoteStateTests(unittest.TestCase):
    def test_delayed_ticks_are_normalized(self):
        quote = QuoteState(
            key="amd",
            label="AMD",
            symbol="AMD",
            conid=123,
            currency="USD",
            exchange="SMART",
            primary_exchange="NASDAQ",
        )

        quote.apply_price_tick(66, 201.10, "2026-10-07T08:00:00Z")
        quote.apply_price_tick(67, 201.20, "2026-10-07T08:00:01Z")
        quote.apply_price_tick(68, 201.15, "2026-10-07T08:00:02Z")

        payload = quote.to_payload()
        self.assertEqual(payload["quote_source"], "IBKR_TWS")
        self.assertEqual(payload["quote_type"], "DELAYED")
        self.assertEqual(payload["data_delay_minutes"], "15-20")
        self.assertEqual(payload["last_price"], 201.15)
        self.assertEqual(payload["quote_time"], None)
        self.assertEqual(payload["received_at"], "2026-10-07T08:00:02Z")

    def test_live_data_wins_when_ibkr_returns_live_ticks(self):
        quote = QuoteState(
            key="spgi",
            label="S&P Global",
            symbol="SPGI",
            conid=456,
            currency="USD",
            exchange="SMART",
            primary_exchange="NYSE",
        )
        quote.set_market_data_type(1)
        quote.apply_price_tick(4, 610.5, "2026-10-07T08:01:00Z")

        payload = quote.to_payload()
        self.assertEqual(payload["quote_type"], "LIVE")
        self.assertEqual(payload["data_delay_minutes"], 0)
        self.assertEqual(payload["display_price"], 610.5)

    def test_midpoint_is_only_a_display_fallback(self):
        quote = QuoteState(
            key="vie",
            label="Veolia",
            symbol="VIE",
            conid=789,
            currency="EUR",
            exchange="SMART",
            primary_exchange="SBF",
        )
        quote.apply_price_tick(66, 32.00)
        quote.apply_price_tick(67, 32.10)

        payload = quote.to_payload()
        self.assertIsNone(payload["last_price"])
        self.assertAlmostEqual(payload["display_price"], 32.05)


if __name__ == "__main__":
    unittest.main()
