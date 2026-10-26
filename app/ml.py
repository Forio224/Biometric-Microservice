import numpy as np
from sklearn.mixture import GaussianMixture

from app.schemas import KeystrokeFeatures


class TemplateOutdatedError(Exception):
    """Шаблон сохранён до ML-01: в нём нет параметров модели, нужна перерегистрация."""


def extract_feature_vector(
    sample: KeystrokeFeatures,
    dwell_keys: list[str],
    flight_keys: list[str],
) -> np.ndarray:
    vec = []
    for key in dwell_keys:
        vec.append(sample.dwellTimes.get(key, 0.0))
    for key in flight_keys:
        vec.append(sample.flightTimes.get(key, 0.0))
    vec.append(sample.correctionRate or 0.0)
    return np.array(vec)


def create_template(samples: list[KeystrokeFeatures]) -> dict:
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
    correction_rate_std = (
        float(np.std(correction_rates)) if len(correction_rates) > 1 else 0.02
    )

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
        # np.asarray — для анализатора типов: после fit атрибуты не None, но sklearn этого не объявляет
        "model": {
            "covariance_type": gmm.covariance_type,
            "weights": np.asarray(gmm.weights_).tolist(),
            "means": np.asarray(gmm.means_).tolist(),
            "covariances": np.asarray(gmm.covariances_).tolist(),
        },
    }


def load_model(params: dict) -> GaussianMixture:
    """Восстанавливает обученную GMM из параметров, сохранённых в шаблоне."""
    covariance_type = params["covariance_type"]
    if covariance_type != "diag":
        raise ValueError(
            f"Восстановление GMM поддерживается только для covariance_type='diag', получено: {covariance_type!r}"
        )

    weights = np.array(params["weights"])
    gmm = GaussianMixture(n_components=len(weights), covariance_type=covariance_type)
    gmm.weights_ = weights
    gmm.means_ = np.array(params["means"])
    # reg_covar уже включён в covariances_ при fit — повторно не прибавляется
    gmm.covariances_ = np.array(params["covariances"])
    gmm.precisions_cholesky_ = 1.0 / np.sqrt(gmm.covariances_)
    return gmm


def calculate_score(sample: KeystrokeFeatures, template: dict) -> float:
    if "model" not in template:
        raise TemplateOutdatedError("В шаблоне нет параметров модели")

    gmm = load_model(template["model"])
    y = extract_feature_vector(
        sample, template["dwell_keys"], template["flight_keys"]
    ).reshape(1, -1)
    return float(gmm.score_samples(y)[0])
