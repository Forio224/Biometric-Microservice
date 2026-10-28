from app import ml


class GMMMethod:
    def fit(self, data):
        template = ml.create_template(data)
        self.template = template
        self.threshold = template["threshold"]
        return self

    def score(self, sample):
        calculated = ml.calculate_score(sample, self.template)
        return calculated
