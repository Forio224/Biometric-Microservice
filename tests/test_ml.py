import json

import numpy as np
import pytest
from sklearn.mixture import GaussianMixture

from app import ml
from tests.helpers import make_samples


def stored(template: dict) -> dict:
    """Шаблон в том виде, в каком он возвращается из JSON-колонки БД."""
    return json.loads(json.dumps(template))


@pytest.mark.parametrize("n_samples", [5, 12])  # 1 и 2 компоненты GMM
def test_score_is_likelihood_under_registration_model(n_samples):
    samples = make_samples(n_samples)
    template = stored(ml.create_template(samples))
    attempt = make_samples(1, seed=99)[0]

    # Эталон: та же GMM, обученная на образцах регистрации
    dwell_keys, flight_keys = template["dwell_keys"], template["flight_keys"]
    X = np.array([ml.extract_feature_vector(s, dwell_keys, flight_keys) for s in samples])
    reference = GaussianMixture(
        n_components=2 if n_samples >= 10 else 1,
        covariance_type="diag",
        reg_covar=5.0,
        random_state=42,
    ).fit(X)
    y = ml.extract_feature_vector(attempt, dwell_keys, flight_keys).reshape(1, -1)

    assert ml.calculate_score(attempt, template) == pytest.approx(reference.score_samples(y)[0])


def test_unknown_covariance_type_is_rejected():
    template = stored(ml.create_template(make_samples(12)))
    template["model"]["covariance_type"] = "full"

    with pytest.raises(ValueError, match="full"):
        ml.calculate_score(make_samples(1, seed=99)[0], template)


def test_template_without_model_is_outdated():
    template = stored(ml.create_template(make_samples(12)))
    del template["model"]

    with pytest.raises(ml.TemplateOutdatedError):
        ml.calculate_score(make_samples(1, seed=99)[0], template)
