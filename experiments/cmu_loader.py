import csv

from app.schemas import KeystrokeFeatures


def load_cmu(path) -> dict[str, list[KeystrokeFeatures]]:
    """Читает CMU Keystroke Dynamics в формат сервиса: {subject: [попытки по порядку]}.

    Берутся только H.* (dwell) и UD.* (flight): DD = H + UD, при diag-GMM дал бы двойной учёт.
    Время переводится из секунд в миллисекунды, как у фронтенда.
    model_construct обходит валидатор: в CMU есть UD < 0 (наложение нажатий), см. ML-08.
    """
    result: dict[str, list[KeystrokeFeatures]] = {}

    with open(path, "r", newline="", encoding="utf-8") as f:
        reader: csv.DictReader[str] = csv.DictReader(f)
        fields = reader.fieldnames
        if fields is None:
            raise ValueError(f"В файле {path} нет заголовка")
        h_fields = []
        ud_fields = []
        dd_fields = []
        for word in fields:
            if word.startswith("H."):
                h_fields.append(word)
            elif word.startswith("UD."):
                ud_fields.append(word)
            elif word.startswith("DD."):
                dd_fields.append(word)

        for row in reader:
            dwell = {}
            for name in h_fields:
                dwell[name] = float(row[name]) * 1000
            flight = {}
            for name in ud_fields:
                flight[name] = float(row[name]) * 1000

            # От первого нажатия до отпускания последней клавиши:
            # сумма интервалов «нажатие → нажатие» + удержание Return
            total_duration = sum(float(row[name]) for name in dd_fields) * 1000 + dwell["H.Return"]

            sample = KeystrokeFeatures.model_construct(
                totalDuration=total_duration,
                dwellTimes=dwell,
                flightTimes=flight,
                correctionRate=0.0,
            )
            result.setdefault(row["subject"], []).append(sample)

    return result


if __name__ == "__main__":
    data = load_cmu("data/cmu/DSL-StrongPasswordData.csv")
    print("испытуемых:", len(data))

    for subject, samples in data.items():
        assert len(samples) == 400, f"{subject}: {len(samples)} попыток"

    first = data["s002"][0]
    assert len(first.dwellTimes) == 11
    assert len(first.flightTimes) == 10
    print("s002, попытка 1: H.period =", first.dwellTimes["H.period"], "мс")
    print("s002, попытка 1: длительность =", round(first.totalDuration), "мс")

    negative = sum(
        any(v < 0 for v in s.flightTimes.values()) for samples in data.values() for s in samples
    )
    print("попыток с отрицательным flight:", negative)
