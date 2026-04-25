from typing import List

import numpy as np
from sklearn.mixture import GaussianMixture

from app.schemas import KeystrokeFeatures


def extract_feature_vector(
    sample: KeystrokeFeatures,
    dwell_keys: List[str],
    flight_keys: List[str],
) -> np.ndarray:
    vec = []
    for key in dwell_keys:
        vec.append(sample.dwellTimes.get(key, 0.0))
    for key in flight_keys:
        vec.append(sample.flightTimes.get(key, 0.0))
    vec.append(sample.correctionRate or 0.0)
    return np.array(vec)


def create_template(samples: List[KeystrokeFeatures]) -> dict:
    dwells_map = {}
    flights_map = {}

    for sample in samples:
        for key, value in sample.dwellTimes.items():
            dwells_map.setdefault(key, []).append(value)
        for key, value in sample.flightTimes.items():
            flights_map.setdefault(key, []).append(value)

    means = {"dwell": {}, "flight": {}}
    deviations = {"dwell": {}, "flight": {}}

    for key, values in dwells_map.items():
        means["dwell"][key] = float(np.mean(values))
        deviations["dwell"][key] = float(np.std(values)) if len(values) > 1 else 0.001

    for key, values in flights_map.items():
        means["flight"][key] = float(np.mean(values))
        deviations["flight"][key] = float(np.std(values)) if len(values) > 1 else 0.001

    dwell_keys = sorted(list(dwells_map.keys()))
    flight_keys = sorted(list(flights_map.keys()))

    X = np.array([extract_feature_vector(s, dwell_keys, flight_keys) for s in samples])
    n_components = 2 if len(X) >= 10 else 1

    gmm = GaussianMixture(
        n_components=n_components,
        covariance_type="diag",
        reg_covar=5.0,
        random_state=42,
    )
    gmm.fit(X)

    scores = gmm.score_samples(X)
    baseline_ll = float(np.mean(scores))
    std_ll = float(np.std(scores))
    threshold = baseline_ll - max(3.0 * std_ll, abs(baseline_ll) * 0.1)
    correction_rates = [s.correctionRate or 0.0 for s in samples]
    correction_rate_mean = float(np.mean(correction_rates))
    correction_rate_std = float(np.std(correction_rates)) if len(correction_rates) > 1 else 0.02

    return {
        "phrase": "test_phrase",
        "sampleCount": len(samples),
        "method": "GMM",
        "means": means,
        "deviations": deviations,
        "variances": {
            "dwell": {k: v**2 for k, v in deviations["dwell"].items()},
            "flight": {k: v**2 for k, v in deviations["flight"].items()},
        },
        "dwell_keys": dwell_keys,
        "flight_keys": flight_keys,
        "threshold": threshold,
        "baseline_ll": baseline_ll,
        "std_ll": std_ll,
        "correction_rate_mean": correction_rate_mean,
        "correction_rate_std": correction_rate_std,
    }


def calculate_score(sample: KeystrokeFeatures, template: dict, recent_samples: List[dict] | None = None) -> float:
    dwell_keys = template.get("dwell_keys", [])
    flight_keys = template.get("flight_keys", [])
    y = extract_feature_vector(sample, dwell_keys, flight_keys).reshape(1, -1)

    if not recent_samples:
        return -9999.0

    X = []
    for sample_dict in recent_samples:
        vec = []
        for key in dwell_keys:
            vec.append(sample_dict.get("dwellTimes", {}).get(key, 0.0))
        for key in flight_keys:
            vec.append(sample_dict.get("flightTimes", {}).get(key, 0.0))
        vec.append(sample_dict.get("correctionRate", 0.0))
        X.append(vec)

    X = np.array(X)
    n_components = 2 if len(X) >= 10 else 1
    gmm = GaussianMixture(
        n_components=n_components,
        covariance_type="diag",
        reg_covar=5.0,
        random_state=42,
    )
    gmm.fit(X)
    return float(gmm.score_samples(y)[0])

