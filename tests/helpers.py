import numpy as np

from app.schemas import KeystrokeFeatures

DWELL_MEANS = {"a": 90.0, "b": 110.0, "c": 100.0}
FLIGHT_MEANS = {"a-b": 150.0, "b-c": 180.0}


def make_samples(n: int, seed: int = 0, shift: float = 0.0) -> list[KeystrokeFeatures]:
    """Искусственные попытки ввода одной фразы: время в мс вокруг заданных средних.

    shift сдвигает все времена — так моделируется чужой почерк.
    """
    rng = np.random.default_rng(seed)
    return [
        KeystrokeFeatures(
            totalDuration=1500.0,
            dwellTimes={k: float(rng.normal(m + shift, 10.0)) for k, m in DWELL_MEANS.items()},
            flightTimes={k: float(rng.normal(m + shift, 20.0)) for k, m in FLIGHT_MEANS.items()},
            correctionRate=0.0,
        )
        for _ in range(n)
    ]


def typical_sample() -> KeystrokeFeatures:
    """Попытка ровно по средним владельца — заведомо «своя»."""
    return KeystrokeFeatures(
        totalDuration=1500.0,
        dwellTimes=dict(DWELL_MEANS),
        flightTimes=dict(FLIGHT_MEANS),
        correctionRate=0.0,
    )

