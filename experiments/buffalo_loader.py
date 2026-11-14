import math
import random
import statistics
import string
from collections import Counter, defaultdict
from pathlib import Path
from typing import NamedTuple

import numpy as np

from app.schemas import KeystrokeFeatures

uppers = set(string.ascii_uppercase)
ALLOWED = uppers | {"Space"}


class User(NamedTuple):
    username: str
    session: int
    keyboard: int
    task: int


class Event(NamedTuple):
    key: str
    event: str
    ms: int


class Pressed(NamedTuple):
    key: str
    down: int
    up: int


class Pair(NamedTuple):
    f_key: str
    s_key: str
    ud: int


def list_files(root: Path | str) -> list[Path]:
    p = Path(root)
    files = list(p.glob("*/*/*.txt"))
    return files


def parse_name(stem: str) -> User:
    username = stem[:3]
    session = int(stem[3])
    keyboard = int(stem[4])
    task = int(stem[5])
    u = User(username, session, keyboard, task)
    return u


def read_events(path: Path | str) -> list[Event]:
    total_events = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            current_line = line.split()
            if current_line:
                key, event, ms = current_line
                total_events.append(Event(key, event, int(ms)))
    return total_events


def to_pressed(events: list[Event]) -> tuple[list[Pressed], Counter]:
    held = {}
    total_pressed = []
    c = Counter()
    for ev in events:
        if ev.event == "KeyDown":
            if ev.key in held:
                c["Repeat"] += 1
            else:
                held[ev.key] = ev.ms
        elif ev.event == "KeyUp":
            if ev.key in held:
                down = held.pop(ev.key)
                if ev.ms - down == 0:
                    c["TimeZero"] += 1
                elif ev.ms - down > 2000:
                    c["TimeOver"] += 1
                else:
                    p = Pressed(ev.key, down, ev.ms)
                    total_pressed.append(p)
            else:
                c["Alone"] += 1
    c["Remains"] = len(held)
    return total_pressed, c


def letters_presses(pressed: list[Pressed]) -> list[Pressed]:
    letters = [letter for letter in pressed if letter.key in ALLOWED]
    return letters


def pairs(pressed: list[Pressed]) -> tuple[list[Pair], Counter]:
    c = Counter()
    pairs_list = []
    # to_pressed отдаёт нажатия в порядке отпускания; печатали в порядке нажатия
    ordered = sorted(pressed, key=lambda p: p.down)
    for cur, nxt in zip(ordered, ordered[1:]):
        # соседи в полном потоке: если между буквами был Backspace/Shift, пары нет
        if cur.key not in ALLOWED or nxt.key not in ALLOWED:
            continue
        ud = nxt.down - cur.up
        dd = nxt.down - cur.down
        if dd > 2000:
            c["pause"] += 1
            continue
        if ud < 0:
            c["below_zero"] += 1
        pairs_list.append(Pair(cur.key, nxt.key, ud))

    return pairs_list, c


# --- шаг 5: окна → KeystrokeFeatures ---

# Сервис считает исправления как (Backspace + Delete), см. src/utils/biometrics.ts:29-30
CORRECTION_KEYS = {"Back", "Delete"}


def key_code(key: str) -> str:
    """Имя клавиши Buffalo → KeyboardEvent.code, как пишет сервис: E → KeyE, Space → Space."""
    return "Space" if key == "Space" else f"Key{key}"


def pair_code(f_key: str, s_key: str) -> str:
    """Пара в формате сервиса: KeyE->Space."""
    return f"{key_code(f_key)}->{key_code(s_key)}"


def window_bounds(ordered: list[Pressed], w: int) -> list[tuple[int, int]]:
    """Границы окон [start, end) в потоке, отсортированном по down.

    Окно — от первой своей буквы до первой буквы следующего окна (или хвоста),
    поэтому каждое нажатие между буквами попадает ровно в одно окно.
    Хвост < w букв окна не образует. У последнего окна без хвоста end = конец потока.
    """
    letter_idx = [i for i, p in enumerate(ordered) if p.key in ALLOWED]
    n_windows = len(letter_idx) // w
    bounds = []
    for i in range(n_windows):
        start = letter_idx[i * w]
        nxt = (i + 1) * w
        end = letter_idx[nxt] if nxt < len(letter_idx) else len(ordered)
        bounds.append((start, end))
    return bounds


def medians_by_key(values: dict[str, list[float]], k: int) -> dict[str, float]:
    """Медиана по каждому признаку, у которого ≥ k вхождений; остальных ключей нет (маска, не 0)."""
    return {key: statistics.median(v) for key, v in values.items() if len(v) >= k}


def make_window(chunk: list[Pressed], top: set[tuple[str, str]], w: int, k: int) -> KeystrokeFeatures:
    """Одно окно: кусок полного потока по down, в нём ровно w букв/пробелов."""
    dwell = defaultdict(list)
    for p in chunk:
        if p.key in ALLOWED:
            dwell[key_code(p.key)].append(p.up - p.down)

    flight = defaultdict(list)
    # Пары строятся только внутри куска — пара на стыке окон не попадает никуда.
    for pr in pairs(chunk)[0]:
        if (pr.f_key, pr.s_key) in top:
            flight[pair_code(pr.f_key, pr.s_key)].append(pr.ud)

    corrections = sum(p.key in CORRECTION_KEYS for p in chunk)
    # model_construct: UD < 0 (ML-08) и окно ~100 с длиннее лимита схемы в 60 с
    return KeystrokeFeatures.model_construct(
        totalDuration=float(max(p.up for p in chunk) - chunk[0].down),
        dwellTimes=medians_by_key(dwell, k),
        flightTimes=medians_by_key(flight, k),
        correctionRate=min(1.0, corrections / w),
    )


def make_windows(
    pressed: list[Pressed], top_pairs: list[tuple[str, str]], w: int = 200, k: int = 3
) -> list[KeystrokeFeatures]:
    """Нажатия одного файла (полный поток из to_pressed) → окна без перекрытия."""
    ordered = sorted(pressed, key=lambda p: p.down)
    top = set(top_pairs)
    return [make_window(ordered[s:e], top, w, k) for s, e in window_bounds(ordered, w)]


# --- шаг 6: список пар и сборка набора ---


def top_pairs(files: list[Path], n: int = 50, k: int = 3) -> list[tuple[str, str]]:
    """Top-n пар: сначала по числу людей, у которых пара встречается ≥ k раз, затем по вхождениям.

    Число людей — главный ключ: многословные люди не проталкивают свои пары.
    Но на s0 Buffalo он насыщается (154 пары есть у всех 148 человек), поэтому
    при равенстве решают вхождения, а уже потом алфавит (детерминированность).
    files передаёт вызывающий — только s0 половины разработки (иначе утечка).
    """
    per_user = defaultdict(Counter)
    for file in files:
        username = parse_name(file.stem).username
        pressed, _ = to_pressed(read_events(file))
        per_user[username].update((p.f_key, p.s_key) for p in pairs(pressed)[0])

    people = Counter()
    occurrences = Counter()
    for counts in per_user.values():
        people.update(pair for pair, c in counts.items() if c >= k)
        occurrences.update(counts)

    ranked = sorted(people, key=lambda pair: (-people[pair], -occurrences[pair], pair))
    return ranked[:n]


def load_buffalo(
    root: Path | str,
    users: set[str],
    top: list[tuple[str, str]],
    w: int = 200,
    k: int = 3,
) -> dict[str, dict[tuple[int, int], list[KeystrokeFeatures]]]:
    """Окна всех файлов указанных людей: {user: {(сессия, задача): [окна по порядку]}}.

    Список пар приходит готовым — его считают по другой половине людей.
    Файл без окон даёт пустой список: файл был, окон ноль.
    """
    result = defaultdict(dict)
    for file in sorted(list_files(root)):
        u = parse_name(file.stem)
        if u.username not in users:
            continue
        pressed, _ = to_pressed(read_events(file))
        result[u.username][(u.session, u.task)] = make_windows(pressed, top, w, k)
    return dict(result)


# --- шаг 7: разбиение людей на половины A/B ---

def stratum(user_files: list[User]) -> str:
    """Слой человека для стратификации: baseline, rotation 1→2→3 или rotation 2→3→1.

    Порядок клавиатур в rotation определяется по клавиатуре сессии 0 (1 или 2).
    """
    keyboards = {u.session: u.keyboard for u in user_files}
    if set(keyboards.values()) == {0}:
        return "baseline"
    if keyboards[0] == 1:
        return "rotation_123"
    if keyboards[0] == 2:
        return "rotation_231"
    raise ValueError(f"Неизвестный порядок клавиатур: {keyboards}")


def split_users(users: list[User], seed: int) -> tuple[set[str], set[str]]:
    """Делит людей на две непересекающиеся половины, поровну из каждого слоя.

    users — разобранные имена всех файлов (несколько User на человека).
    Лишнего человека нечётного слоя получает половина, в которой пока меньше людей,
    поэтому итог 74/74, а не 75/73.
    """
    by_user = defaultdict(list)
    for u in users:
        by_user[u.username].append(u)

    by_stratum = defaultdict(list)
    for username, user_files in by_user.items():
        by_stratum[stratum(user_files)].append(username)

    rng = random.Random(seed)
    a, b = set(), set()
    for name in sorted(by_stratum):  # фиксированный порядок слоёв → воспроизводимость
        people = sorted(by_stratum[name])
        rng.shuffle(people)
        half = len(people) // 2
        if len(people) % 2 == 1 and len(a) <= len(b):
            half += 1
        a.update(people[:half])
        b.update(people[half:])
    return a, b


# --- шаг 8: мышь в сырые массивы на общих часах с клавиатурой ---

TICKS_PER_MS = 10_000  # тики .NET (100 нс) → мс клавиатуры


def mouse_path(keyboard_path: Path | str, mouse_root: Path | str) -> Path:
    """Файл мыши с тем же именем, что у файла клавиатуры (мышь лежит плоско)."""
    return Path(mouse_root) / Path(keyboard_path).name


def read_mouse(path: Path | str) -> tuple[np.ndarray, list[tuple[float, str]]]:
    """Точки (t_мс, x, y) и клики (t_мс, 'Left'|'Right') из файла мыши.

    Время — в тех же мс, что у клавиатуры (тики / 10 000, дробные).
    Шапку и служебные строки (Window Activated, Closing Down…) пропускаем:
    в шапке имя пользователя Windows и IP — их не читаем и не печатаем.
    Порядок строк файла сохраняется; дубли точек не склеиваются (это очистка DM-05).
    """
    points = []
    clicks = []
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            parts = line.rstrip("\n").split(" | ")
            if len(parts) != 4 or not parts[0].isdigit():
                continue
            t = int(parts[0]) / TICKS_PER_MS
            kind = parts[2]
            if kind == "Mouse Coordinates":
                x, y = parts[3].split(",")
                points.append((t, int(x), int(y)))
            elif kind in ("Left", "Right"):
                clicks.append((t, kind))
    return np.array(points, dtype=float).reshape(-1, 3), clicks


if __name__ == "__main__":
    path = "./data/buffalo/UB_keystroke_dataset"
    files = list_files(path)
    user_dict = defaultdict(set)
    for file in files:
        name = file.stem
        u = parse_name(name)
        user_dict[u.username].add(u.keyboard)

    assert len(files) == 888, "Количество файлов должно быть равно 888"
    assert len(user_dict) == 148, "Количество людей должно быть равно 148"
    for file in files:
        parent = file.parent.name
        name = file.stem
        u = parse_name(name)
        if parent == "baseline":
            assert user_dict[u.username] == {0}, (
                "Клавиатура должна быть одна и та же, нулевая"
            )
        elif parent == "rotation":
            assert user_dict[u.username] == {1, 2, 3}, (
                "Клавиатуры в сессии должны быть разными"
            )

    p = Path(path)
    first_file = p / "s0" / "baseline" / "001000.txt"
    first_events = read_events(first_file)
    assert first_events[0] == ("LMenu", "KeyDown", 63578429757751), (
        "Неверно прочитана первая строка файла"
    )
    c = Counter()
    cleaning = Counter()
    n_pressed = 0
    n_letters = 0
    pair_stats = Counter()
    pair_rate = Counter()
    for file in files:
        events = read_events(file)
        c.update(ev.event for ev in events)
        pressed, rules = to_pressed(events)
        cleaning.update(rules)
        n_pressed += len(pressed)
        n_letters += len(letters_presses(pressed))
        l_pairs, counter_pairs = pairs(pressed)
        pair_stats.update(counter_pairs)
        pair_stats["total"] += len(l_pairs) + counter_pairs["pause"]
        pair_rate.update((pr.f_key, pr.s_key) for pr in l_pairs)

    assert c["KeyUp"] == 2_468_409, (
        "Количество общих отпусканий клавиш должно быть равно 2 468 409"
    )
    assert c["KeyDown"] == 2_468_072, (
        "Количество общих нажатий клавиш должно быть равно 2 468 072"
    )
    assert math.isclose(n_letters / n_pressed * 100, 86.6, abs_tol=0.05), (
        "Соотношение букв и пробелов к нажатым клавишам должно быть ~86.6%"
    )
    assert math.isclose(
        pair_stats["below_zero"] / pair_stats["total"] * 100, 17.4, abs_tol=0.05
    ), "Доля пар с UD < 0 от всех пар должна быть ~17.4%"
    assert math.isclose(
        pair_stats["pause"] / pair_stats["total"] * 100, 1.1, abs_tol=0.05
    ), "Доля пауз от всех пар должна быть ~1.1%"
    assert [item[0] for item in pair_rate.most_common(4)] == [
        ("E", "Space"),
        ("Space", "T"),
        ("T", "Space"),
        ("T", "H"),
    ], "Самые часто встречающиеся пары должны быть E->Space, Space->T, T->Space, T->H"

    expected = {
        "Repeat": 246,
        "Alone": 596,
        "Remains": 13,
        "TimeZero": 669,
        "TimeOver": 1080,
    }
    for rule, count in expected.items():
        assert cleaning[rule] == count, (
            f"Правило {rule}: {cleaning[rule]}, ожидалось {count}"
        )
    # Баланс: каждое событие попало ровно в одно место — в нажатие или в счётчик правила.
    assert c["KeyDown"] == (
        n_pressed
        + cleaning["Repeat"]
        + cleaning["TimeZero"]
        + cleaning["TimeOver"]
        + cleaning["Remains"]
    ), "Не сходится баланс KeyDown"
    assert c["KeyUp"] == (
        n_pressed + cleaning["TimeZero"] + cleaning["TimeOver"] + cleaning["Alone"]
    ), "Не сходится баланс KeyUp"
    print(f"Нажатий после очистки: {n_pressed:,}; очистка: {dict(cleaning)}")

    # --- шаги 5–6 ---
    s0_files = [file for file in files if parse_name(file.stem).session == 0]
    top = top_pairs(s0_files, n=50)
    assert len(top) == 50 and top[0] == ("E", "Space"), f"Top-пары: {top[:4]}"
    everyone = {parse_name(file.stem).username for file in files}
    data = load_buffalo(path, everyone, top)

    s1_task1 = [win for windows in data.values() for win in windows[(1, 1)]]
    assert statistics.median(len(win.dwellTimes) for win in s1_task1) == 18, (
        "В окне s1 задачи 1 медиана клавиш с ≥ 3 вхождениями должна быть 18"
    )
    # В разведке было ~15: там пара на стыке окон ещё считалась
    assert statistics.median(len(win.flightTimes) for win in s1_task1) == 14, (
        "В окне s1 задачи 1 медиана пар top-50 с ≥ 3 вхождениями должна быть 14"
    )
    train_windows = [len(d[(0, 0)]) + len(d[(0, 1)]) for d in data.values()]
    assert statistics.median(train_windows) == 23, "Медиана окон s0 на человека должна быть 23"
    # В разведке был минимум 15: задачи склеивались. У 126 — 10 + 4 окна раздельно.
    assert min(train_windows) == 14, "Минимум окон s0 на человека должен быть 14"
    assert all(len(d) == 6 for d in data.values()), "У каждого 3 сессии × 2 задачи"
    print(f"Окон всего: {sum(len(ws) for d in data.values() for ws in d.values()):,}")

    # --- шаг 7 ---
    users = [parse_name(file.stem) for file in files]
    by_user = defaultdict(list)
    for u in users:
        by_user[u.username].append(u)
    half_a, half_b = split_users(users, seed=0)
    assert not half_a & half_b, "Половины не должны пересекаться"
    assert len(half_a | half_b) == 148, "В половинах должны быть все 148 человек"
    assert len(half_a) == len(half_b) == 74, "Половины должны быть по 74 человека"
    for name in ("baseline", "rotation_123", "rotation_231"):
        n_a = sum(stratum(by_user[x]) == name for x in half_a)
        n_b = sum(stratum(by_user[x]) == name for x in half_b)
        assert abs(n_a - n_b) <= 1, f"Слой {name} поделён неровно: {n_a} / {n_b}"
    assert split_users(users, seed=0) == (half_a, half_b), "Тот же seed — то же разбиение"
    assert split_users(users, seed=1) != (half_a, half_b), "Другой seed — другое разбиение"

    # --- шаг 8 ---
    mouse_root = "./data/buffalo/UB_mouse_and_events_dataset"
    n_points = 0
    n_clicks = Counter()
    almost_empty = []
    for file in files:
        points, clicks = read_mouse(mouse_path(file, mouse_root))
        n_points += len(points)
        n_clicks.update(button for _, button in clicks)
        if len(points) <= 1:
            almost_empty.append(parse_name(file.stem))
    assert n_points == 5_457_238, f"Точек мыши {n_points:,}, ожидалось 5 457 238"
    assert n_clicks == {"Left": 33_516, "Right": 3_596}, f"Клики: {dict(n_clicks)}"
    assert len(almost_empty) == 88, f"Файлов с ≤ 1 точкой {len(almost_empty)}, ожидалось 88"
    assert all(u.task == 1 for u in almost_empty), "Без движения мыши — только задача 1"

    points, _ = read_mouse(mouse_path(first_file, mouse_root))
    # Общие часы: в тех же мс первая точка рядом с первой клавишей (0,3 с).
    # Ошибка в делителе тиков дала бы разницу в тысячи лет.
    assert abs(points[0, 0] - first_events[0].ms) < 1000, "Часы мыши и клавиатуры не совпали"
    print(f"Половины: {len(half_a)} / {len(half_b)}; мышь: {n_points:,} точек, {dict(n_clicks)}")
