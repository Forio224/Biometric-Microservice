#
# ┌─────┬─────────────────────────────┬─────────────────────────────────────┬───────────────────────────────────────┐
# │  #  │             Шаг             │            Что получится            │             Как проверить             │
# ├─────┼─────────────────────────────┼─────────────────────────────────────┼───────────────────────────────────────┤
# │ 1   │ Разбить данные одного       │ train, genuine, impostor            │ длины 200 / 200 / 250                 │
# │     │ испытуемого                 │                                     │                                       │
# ├─────┼─────────────────────────────┼─────────────────────────────────────┼───────────────────────────────────────┤
# │ 2   │ Посчитать оценки            │ два списка чисел: свои и чужие      │ у своих оценки в среднем выше         │
# ├─────┼─────────────────────────────┼─────────────────────────────────────┼───────────────────────────────────────┤
# │ 3   │ FAR и FRR при заданном      │ функция (genuine, impostor, t) →    │ при очень низком пороге FRR=0, FAR=1  │
# │     │ пороге                      │ (far, frr)                          │                                       │
# ├─────┼─────────────────────────────┼─────────────────────────────────────┼───────────────────────────────────────┤
# │ 4   │ Найти EER                   │ одно число для испытуемого          │ лежит между 0 и 0.5                   │
# ├─────┼─────────────────────────────┼─────────────────────────────────────┼───────────────────────────────────────┤
# │ 5   │ Прогнать всех 51            │ среднее EER и разброс               │ сравнить с 0.096 из статьи            │
# ├─────┼─────────────────────────────┼─────────────────────────────────────┼───────────────────────────────────────┤
# │ 6   │ Нарисовать ROC/DET          │ картинка для главы:                 │ кривая худшего ближе всех к           │
# │     │                             │ experiments/figures/roc_det.png     │ диагонали ROC                         │
# └─────┴─────────────────────────────┴─────────────────────────────────────┴───────────────────────────────────────┘

import math
import statistics
from pathlib import Path
from typing import NamedTuple

import matplotlib
import numpy as np
from scipy.stats import norm

from app import ml
from experiments.cmu_loader import load_cmu

matplotlib.use("Agg")  # рисуем только в файл; вызов должен идти до импорта pyplot
import matplotlib.pyplot as plt

TRAINING_SAMPLES = 200
IMPOSTOR_ATTEMPTS = 5
FIGURES_DIR = Path("experiments/figures")
# Пробит-шкала DET не определена в 0 и 1 (norm.ppf даёт ±inf). Точки кривой с
# нулевой или полной ошибкой не рисуем, как принято для DET; отдельные маркеры
# прижимаем к этим границам, чтобы они не пропадали
DET_CLIP = (0.001, 0.999)
DET_LIMITS = (0.001, 0.95)


def split_subject(data, subject) -> tuple[list, list, list]:
    """Возвращает (train, genuine, impostor) для одного испытуемого."""
    current_subject = data[subject]
    train = current_subject[:TRAINING_SAMPLES]
    genuine = current_subject[TRAINING_SAMPLES:]
    impostor = []
    for key, value in data.items():
        if key != subject:
            impostor.extend(value[:IMPOSTOR_ATTEMPTS])
    return train, genuine, impostor


def score_subject(data, subject) -> tuple[list[float], list[float], dict]:
    """Обучает шаблон на train и возвращает (оценки своих, оценки чужих, шаблон)."""
    train, genuine, impostor = split_subject(data, subject)
    template = ml.create_template(train)
    genuine_scores = [ml.calculate_score(s, template) for s in genuine]
    impostor_scores = [ml.calculate_score(s, template) for s in impostor]
    return genuine_scores, impostor_scores, template


def describe(name, scores) -> str:
    """Сводка по списку оценок: минимум, среднее, максимум."""
    mean = sum(scores) / len(scores)
    return f"{name}: min {min(scores):.1f}, среднее {mean:.1f}, max {max(scores):.1f}"


def summarize(name, values) -> str:
    """Сводка по испытуемым: среднее ± σ (выборочное), медиана, min и max."""
    return (
        f"{name}: среднее {statistics.mean(values):.3f} ± {statistics.stdev(values):.3f}, "
        f"медиана {statistics.median(values):.3f}, "
        f"min {min(values):.3f}, max {max(values):.3f}"
    )


def far_frr(genuine_scores, impostor_scores, threshold):
    """Возвращает (FAR, FRR) при пороге; попытка принята, если score >= threshold."""
    frr = sum(el < threshold for el in genuine_scores) / len(genuine_scores)
    far = sum(el >= threshold for el in impostor_scores) / len(impostor_scores)
    return far, frr


def eer(genuine_scores, impostor_scores):
    """Возвращает (EER, порог), перебирая порогами все оценки.

    EER — среднее FAR и FRR в точке, где |FAR - FRR| минимален.
    """
    if not genuine_scores or not impostor_scores:
        raise ValueError("Списки должны быть не пустыми")
    total_scores = genuine_scores + impostor_scores
    min_diff = float("inf")
    best_threshold = None
    best_far = None
    best_frr = None
    for threshold in total_scores:
        far, frr = far_frr(genuine_scores, impostor_scores, threshold)
        diff = abs(far - frr)
        if diff < min_diff:
            min_diff = diff
            best_threshold = threshold
            best_far = far
            best_frr = frr
    eer_value = (best_far + best_frr) / 2
    return eer_value, best_threshold


class SubjectResult(NamedTuple):
    eer: float
    eer_threshold: float
    service_threshold: float
    far: float
    frr: float
    genuine_scores: list[float]
    impostor_scores: list[float]


def evaluate_all(data) -> dict[str, SubjectResult]:
    """Оценивает каждого испытуемого: EER и FAR/FRR при пороге сервиса."""
    results = {}
    for subject in data:
        genuine, impostor, template = score_subject(data, subject)
        eer_value, eer_threshold = eer(genuine, impostor)
        service_threshold = template["threshold"]
        far, frr = far_frr(genuine, impostor, service_threshold)
        subject_result = SubjectResult(
            eer=eer_value,
            eer_threshold=eer_threshold,
            service_threshold=service_threshold,
            far=far,
            frr=frr,
            genuine_scores=genuine,
            impostor_scores=impostor,
        )
        results[subject] = subject_result
    return results


def error_curve(genuine_scores, impostor_scores) -> tuple[list[float], list[float]]:
    """Возвращает (FAR, FRR) для каждого порога по возрастанию.

    Пороги — все оценки плюс ±inf, чтобы кривая шла от (1, 0) до (0, 1).
    """
    thresholds = sorted(set(genuine_scores + impostor_scores))
    thresholds = [float("-inf"), *thresholds, float("inf")]
    fars = []
    frrs = []
    for threshold in thresholds:
        far, frr = far_frr(genuine_scores, impostor_scores, threshold)
        fars.append(far)
        frrs.append(frr)
    return fars, frrs


def pick_subjects(results) -> dict[str, str]:
    """Возвращает {подпись: испытуемый} для лучшего, медианного и худшего по EER."""
    ranked = sorted(results, key=lambda name: results[name].eer)
    return {
        "лучший": ranked[0],
        "медианный": ranked[len(ranked) // 2],
        "худший": ranked[-1],
    }


def probit(rates):
    """Переводит доли ошибок в координаты DET (квантили нормального распределения)."""
    return norm.ppf(np.clip(rates, *DET_CLIP))


def plot_roc_det(results, subjects, path) -> None:
    """Рисует ROC и DET выбранных испытуемых с точками EER и порога сервиса."""
    fig, (roc_ax, det_ax) = plt.subplots(1, 2, figsize=(12, 5.5))

    for label, name in subjects.items():
        result = results[name]
        fars, frrs = error_curve(result.genuine_scores, result.impostor_scores)
        eer_far, eer_frr = far_frr(
            result.genuine_scores, result.impostor_scores, result.eer_threshold
        )
        line = roc_ax.plot(
            fars,
            [1 - frr for frr in frrs],
            label=f"{name} ({label}), EER {result.eer:.3f}",
        )[0]
        color = line.get_color()
        roc_ax.scatter(eer_far, 1 - eer_frr, marker="o", color=color, zorder=3)
        roc_ax.scatter(result.far, 1 - result.frr, marker="s", color=color, zorder=3)

        inner = [
            (far, frr) for far, frr in zip(fars, frrs) if 0 < far < 1 and 0 < frr < 1
        ]
        det_fars, det_frrs = zip(*inner)
        det_ax.plot(probit(det_fars), probit(det_frrs), color=color)
        det_ax.scatter(
            probit(eer_far), probit(eer_frr), marker="o", color=color, zorder=3
        )
        det_ax.scatter(
            probit(result.far), probit(result.frr), marker="s", color=color, zorder=3
        )

    # Пустые точки только ради легенды: форма маркера одинакова у всех испытуемых
    roc_ax.scatter([], [], marker="o", color="gray", label="точка EER")
    roc_ax.scatter([], [], marker="s", color="gray", label="порог сервиса")

    roc_ax.plot([0, 1], [0, 1], ":", color="gray")  # случайное угадывание
    roc_ax.set_xlabel("FAR (доля принятых чужих)")
    roc_ax.set_ylabel("1 − FRR (доля принятых своих)")
    roc_ax.set_title("ROC")
    roc_ax.grid(True, alpha=0.3)
    roc_ax.legend(loc="lower right")

    ticks = [0.001, 0.01, 0.05, 0.2, 0.5, 0.8, 0.95]
    tick_positions = probit(ticks)
    tick_labels = [f"{t * 100:g}%" for t in ticks]
    det_ax.plot(tick_positions, tick_positions, ":", color="gray")  # FAR = FRR
    det_ax.set_xticks(tick_positions, tick_labels)
    det_ax.set_yticks(tick_positions, tick_labels)
    det_ax.set_xlim(*probit(DET_LIMITS))
    det_ax.set_ylim(*probit(DET_LIMITS))
    det_ax.set_xlabel("FAR")
    det_ax.set_ylabel("FRR")
    det_ax.set_title("DET (пробит-шкала); пунктир — FAR = FRR")
    det_ax.grid(True, alpha=0.3)

    fig.suptitle(
        "GMM-шаблон сервиса на CMU: 200 обучающих, 200 своих, 250 чужих попыток"
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path, dpi=200, bbox_inches="tight")
    plt.close(fig)


if __name__ == "__main__":
    # Шаг 3 на игрушечных оценках: ответ известен заранее, CMU не нужен
    toy_gen = [-100, -120, -150]
    toy_imp = [-90, -200, -300, -400]

    far, frr = far_frr(toy_gen, toy_imp, -130)
    assert math.isclose(far, 1 / 4), f"FAR: {far}, ожидали 0.25 (принят только -90)"
    assert math.isclose(frr, 1 / 3), f"FRR: {frr}, ожидали 0.333 (отклонён только -150)"

    far, frr = far_frr(toy_gen, toy_imp, float("-inf"))
    assert (far, frr) == (1, 0), (
        f"порог -inf: ({far}, {frr}), ожидали все приняты (1, 0)"
    )

    far, frr = far_frr(toy_gen, toy_imp, float("inf"))
    assert (far, frr) == (0, 1), (
        f"порог inf: ({far}, {frr}), ожидали все отклонены (0, 1)"
    )

    # Оценка, равная порогу, принимается: в сервисе score >= threshold
    far, frr = far_frr(toy_gen, toy_imp, -120)
    assert math.isclose(frr, 1 / 3), f"FRR: {frr}, ожидали 0.333: -120 на пороге принят"
    assert math.isclose(far, 1 / 4), f"FAR: {far}, ожидали 0.25 (принят только -90)"

    # Шаг 4 на игрушечных оценках
    rate, threshold = eer([-10, -20], [-100, -200])
    assert math.isclose(rate, 0), (
        f"EER: {rate}, ожидали 0: свои и чужие не пересекаются"
    )
    assert threshold == -20, (
        f"порог: {threshold}, ожидали -20: самая низкая оценка своих"
    )

    same = [-1, -2, -3, -4]
    rate, _ = eer(same, same)
    assert math.isclose(rate, 0.5), f"EER: {rate}, ожидали 0.5: свои и чужие одинаковы"

    # Пустой вход — ошибка вызова; оба случая: пусты оба списка и пуст один
    for empty_case in [([], []), ([], [-1]), ([-1], [])]:
        try:
            eer(*empty_case)
        except ValueError:
            pass
        else:
            raise AssertionError(f"eer{empty_case}: ожидали ValueError")

    # Шаг 6 на игрушечных оценках
    fars, frrs = error_curve([-10, -20], [-100, -200])
    assert (fars[0], frrs[0]) == (1, 0), "кривая должна начинаться с (FAR 1, FRR 0)"
    assert (fars[-1], frrs[-1]) == (0, 1), "кривая должна кончаться на (FAR 0, FRR 1)"
    assert (0, 0) in zip(fars, frrs), (
        "свои и чужие не пересекаются: нужна точка без ошибок"
    )
    # С ростом порога чужих принимается не больше, а своих отклоняется не меньше
    assert fars == sorted(fars, reverse=True), f"FAR не убывает монотонно: {fars}"
    assert frrs == sorted(frrs), f"FRR не растёт монотонно: {frrs}"

    data = load_cmu("data/cmu/DSL-StrongPasswordData.csv")
    subject = "s002"
    t, g, i = split_subject(data, subject)

    assert len(t) == TRAINING_SAMPLES, f"train: {len(t)}, ожидали {TRAINING_SAMPLES}"

    expected_genuine = len(data[subject]) - TRAINING_SAMPLES
    assert len(g) == expected_genuine, f"genuine: {len(g)}, ожидали {expected_genuine}"
    assert g[0] is data[subject][TRAINING_SAMPLES], (
        "genuine начинается не с первой попытки после train"
    )

    expected_impostor = IMPOSTOR_ATTEMPTS * (len(data) - 1)
    assert len(i) == expected_impostor, (
        f"impostor: {len(i)}, ожидали {expected_impostor}"
    )
    assert not any(el is s for el in i for s in data[subject]), (
        f"попытки {subject} попали в impostor"
    )

    print("шаг 1: разбиение верное")

    gen, imp, template = score_subject(data, subject)
    assert len(gen) == expected_genuine, (
        f"оценок genuine: {len(gen)}, ожидали {expected_genuine}"
    )
    assert len(imp) == expected_impostor, (
        f"оценок impostor: {len(imp)}, ожидали {expected_impostor}"
    )

    gen_mean = sum(gen) / len(gen)
    imp_mean = sum(imp) / len(imp)
    assert gen_mean > imp_mean, (
        f"среднее своих {gen_mean:.1f} не больше среднего чужих {imp_mean:.1f}"
    )

    print("шаг 2: оценки посчитаны")
    print(describe("  свои ", gen))
    print(describe("  чужие", imp))
    print(f"  порог сервиса: {template['threshold']:.1f}")

    # Диапазоны своих и чужих перекрываются, порог сервиса внутри перекрытия,
    # значит обе ошибки ненулевые
    far, frr = far_frr(gen, imp, template["threshold"])
    assert 0 < far < 1, f"FAR при пороге сервиса: {far}, ожидали строго между 0 и 1"
    assert 0 < frr < 1, f"FRR при пороге сервиса: {frr}, ожидали строго между 0 и 1"

    print("шаг 3: FAR/FRR при пороге сервиса")
    print(f"  FAR {far:.3f} ({far * len(imp):.0f} из {len(imp)} чужих принято)")
    print(f"  FRR {frr:.3f} ({frr * len(gen):.0f} из {len(gen)} своих отклонено)")

    rate, threshold = eer(gen, imp)
    assert 0 < rate < 0.5, f"EER: {rate}, ожидали строго между 0 и 0.5"
    # При пороге сервиса FAR > FRR, а подъём порога снижает FAR и повышает FRR
    assert threshold > template["threshold"], (
        f"порог EER {threshold:.1f} не выше порога сервиса {template['threshold']:.1f}"
    )
    far, frr = far_frr(gen, imp, threshold)

    print("шаг 4: EER")
    print(f"  EER {rate:.3f} при пороге {threshold:.1f} (FAR {far:.3f}, FRR {frr:.3f})")

    results = evaluate_all(data)
    assert len(results) == len(data), (
        f"результатов: {len(results)}, ожидали {len(data)}"
    )
    # GMM обучается с random_state=42, поэтому общий прогон обязан повторить шаг 4
    assert results[subject].eer == rate, (
        f"EER {subject} в общем прогоне {results[subject].eer:.3f}, "
        f"а на шаге 4 был {rate:.3f}"
    )
    # EER = 0 честно возможен: свои и чужие могут не пересекаться
    for name, result in results.items():
        assert 0 <= result.eer <= 0.5, f"EER {name}: {result.eer}, ожидали от 0 до 0.5"

    eers = [result.eer for result in results.values()]
    fars = [result.far for result in results.values()]
    frrs = [result.frr for result in results.values()]
    low_threshold = sum(
        result.eer_threshold > result.service_threshold for result in results.values()
    )

    print(f"шаг 5: по всем испытуемым ({len(results)})")
    print(summarize("  EER", eers) + " (Killourhy & Maxion: 0.096)")
    print("  при пороге сервиса:")
    print(summarize("    FAR", fars))
    print(summarize("    FRR", frrs))
    print(f"  порог EER выше порога сервиса у {low_threshold} из {len(results)}")

    subjects = pick_subjects(results)
    assert len(set(subjects.values())) == 3, f"испытуемые повторяются: {subjects}"
    figure_path = FIGURES_DIR / "roc_det.png"
    plot_roc_det(results, subjects, figure_path)
    assert figure_path.stat().st_size > 0, f"{figure_path} пустой"

    print("шаг 6: ROC/DET")
    for label, name in subjects.items():
        print(f"  {label}: {name}, EER {results[name].eer:.3f}")
    print(f"  сохранено в {figure_path}")
