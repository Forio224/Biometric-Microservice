from typing import Protocol, Self

import numpy as np

from app import ml


class Method(Protocol):
    threshold: float | None

    def fit(self, data) -> Self: ...
    def score(self, sample) -> float: ...


class GMMMethod:
    def fit(self, data):
        self.threshold: float | None
        template = ml.create_template(data)
        self.template = template
        self.threshold = template["threshold"]
        return self

    def score(self, sample):
        calculated = ml.calculate_score(sample, self.template)
        return calculated


class ScaledManhattanMethod:
    def fit(self, data):
        self.threshold: float | None = None
        dwell_keys = set()
        flight_keys = set()
        for sample in data:
            dwell_keys.update(sample.dwellTimes)
            flight_keys.update(sample.flightTimes)
        self.dwell_keys = sorted(dwell_keys)
        self.flight_keys = sorted(flight_keys)

        rows = [
            ml.extract_feature_vector(s, self.dwell_keys, self.flight_keys)
            for s in data
        ]
        m = np.array(rows)

        self.means = m.mean(axis=0)
        self.deviations = np.abs(m - self.means).mean(axis=0)
        self.mask = self.deviations != 0
        self.means = self.means[self.mask]
        self.deviations = self.deviations[self.mask]
        return self

    def score(self, sample):
        row = ml.extract_feature_vector(sample, self.dwell_keys, self.flight_keys)
        row = row[self.mask]
        result = np.abs(row - self.means) / self.deviations
        s = result.sum()
        return float(-s)


class MahalanobisMethod:
    def fit(self, data):
        self.threshold: float | None = None
        dwell_keys = set()
        flight_keys = set()
        for sample in data:
            dwell_keys.update(sample.dwellTimes)
            flight_keys.update(sample.flightTimes)
        self.dwell_keys = sorted(dwell_keys)
        self.flight_keys = sorted(flight_keys)

        rows = [
            ml.extract_feature_vector(s, self.dwell_keys, self.flight_keys)
            for s in data
        ]
        m = np.array(rows)
        spread = m.std(axis=0)
        self.mask = spread != 0
        m = m[:, self.mask]

        self.means = m.mean(axis=0)
        self.cov = np.cov(m, rowvar=False)
        self.inv_cov = np.linalg.inv(self.cov)
        return self

    def score(self, sample):
        row = ml.extract_feature_vector(sample, self.dwell_keys, self.flight_keys)
        row = row[self.mask]
        diff = row - self.means
        result = diff @ self.inv_cov @ diff
        return float(-result)
