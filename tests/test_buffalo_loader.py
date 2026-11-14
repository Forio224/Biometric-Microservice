"""Тесты загрузчика Buffalo.

Быстрые — на маленьких придуманных примерах, проверяют правила.
Помеченные `data` — эталонные числа на всём датасете (~40 с); пропускаются, если данных нет.
Запустить только быстрые: `pytest -m "not data"`.
"""

import math
import statistics
from collections import Counter, defaultdict
from pathlib import Path

import pytest

from experiments.buffalo_loader import (
    Event,
    Pair,
    Pressed,
    User,
    key_code,
    letters_presses,
    list_files,
    load_buffalo,
    make_windows,
    mouse_path,
    pair_code,
    pairs,
    parse_name,
    read_events,
    read_mouse,
    split_users,
    stratum,
    to_pressed,
    top_pairs,
    window_bounds,
)

KEYS_ROOT = Path("data/buffalo/UB_keystroke_dataset")
MOUSE_ROOT = Path("data/buffalo/UB_mouse_and_events_dataset")


# ---------- шаг 1: имена и файлы ----------


def test_parse_name():
    assert parse_name("123121") == User("123", 1, 2, 1)
    assert parse_name("001000") == User("001", 0, 0, 0)


def test_list_files_finds_two_levels_deep(tmp_path):
    (tmp_path / "s0" / "baseline").mkdir(parents=True)
    (tmp_path / "s0" / "baseline" / "001000.txt").write_text("")
    (tmp_path / "stray.txt").write_text("")
    assert [f.name for f in list_files(tmp_path)] == ["001000.txt"]


# ---------- шаг 2: чтение событий ----------


def test_read_events_skips_blank_lines(tmp_path):
    f = tmp_path / "001000.txt"
    f.write_text("A KeyDown 100\n\nA KeyUp 180\n")
    assert read_events(f) == [Event("A", "KeyDown", 100), Event("A", "KeyUp", 180)]


# ---------- шаг 3: события → нажатия ----------


def ev(key, kind, ms):
    return Event(key, "KeyDown" if kind == "d" else "KeyUp", ms)


def test_to_pressed_normal_press():
    pressed, c = to_pressed([ev("A", "d", 100), ev("A", "u", 180)])
    assert pressed == [Pressed("A", 100, 180)]
    assert c["Remains"] == 0


def test_to_pressed_autorepeat_keeps_first_keydown():
    pressed, c = to_pressed([ev("A", "d", 100), ev("A", "d", 130), ev("A", "u", 200)])
    assert pressed == [Pressed("A", 100, 200)]
    assert c["Repeat"] == 1


def test_to_pressed_orphans():
    pressed, c = to_pressed([ev("A", "u", 50), ev("B", "d", 100)])
    assert pressed == []
    assert c["Alone"] == 1
    assert c["Remains"] == 1


def test_to_pressed_drops_zero_and_long_holds_only():
    events = [
        ev("A", "d", 0), ev("A", "u", 0),        # удержание 0
        ev("B", "d", 10), ev("B", "u", 2011),    # > 2000 мс
        ev("C", "d", 20), ev("C", "u", 2020),    # ровно 2000 — остаётся
    ]
    pressed, c = to_pressed(events)
    assert pressed == [Pressed("C", 20, 2020)]
    assert c["TimeZero"] == 1
    assert c["TimeOver"] == 1


def test_to_pressed_returns_in_release_order():
    # Наложение: B нажата позже, но отпущена раньше — в списке идёт первой.
    events = [ev("A", "d", 0), ev("B", "d", 50), ev("B", "u", 90), ev("A", "u", 120)]
    pressed, _ = to_pressed(events)
    assert [p.key for p in pressed] == ["B", "A"]


# ---------- шаг 4: буквы и пары ----------


def test_letters_presses_keeps_letters_and_space():
    pressed = [Pressed(k, 0, 1) for k in ["A", "Space", "Back", "LShiftKey", "Z", "D1"]]
    assert [p.key for p in letters_presses(pressed)] == ["A", "Space", "Z"]


def test_pairs_sorts_by_down_and_allows_negative_ud():
    # В порядке отпускания: B, A. Пара должна быть A→B, UD = 50 - 120 < 0.
    pressed = [Pressed("B", 50, 90), Pressed("A", 0, 120)]
    result, c = pairs(pressed)
    assert result == [Pair("A", "B", -70)]
    assert c["below_zero"] == 1


def test_pairs_break_on_non_letter_between():
    # Между T и H стоит Backspace — пары T→H нет, хотя обе буквы.
    pressed = [Pressed("T", 0, 80), Pressed("Back", 150, 220), Pressed("H", 300, 380)]
    result, _ = pairs(pressed)
    assert result == []


def test_pairs_pause_is_not_a_pair():
    pressed = [Pressed("A", 0, 80), Pressed("B", 2001, 2080), Pressed("C", 2100, 2180)]
    result, c = pairs(pressed)
    assert result == [Pair("B", "C", 20)]
    assert c["pause"] == 1


# ---------- шаг 5: окна ----------


def stream(keys, step=100, hold=50):
    """Нажатия по очереди через step мс, каждое удерживается hold мс."""
    return [Pressed(k, i * step, i * step + hold) for i, k in enumerate(keys)]


def test_key_codes_match_service():
    assert key_code("E") == "KeyE"
    assert key_code("Space") == "Space"
    assert pair_code("E", "Space") == "KeyE->Space"


def test_window_bounds_cover_gaps_and_drop_tail():
    # w=2: буквы A B | C D | E (хвост). Back между B и C уходит в первое окно.
    s = stream(["A", "B", "Back", "C", "D", "E"])
    assert window_bounds(s, 2) == [(0, 3), (3, 5)]


def test_window_bounds_last_window_takes_rest_without_tail():
    s = stream(["A", "B", "Back"])
    assert window_bounds(s, 2) == [(0, 3)]
    assert window_bounds(stream(["A"]), 2) == []


def test_make_windows_features():
    keys = ["A", "B", "A", "B", "A", "B", "Back", "C", "D", "C", "D", "C", "D"]
    windows = make_windows(stream(keys), top_pairs=[("A", "B"), ("B", "C")], w=6, k=3)
    assert len(windows) == 2
    first, second = windows
    assert first.dwellTimes == {"KeyA": 50, "KeyB": 50}
    assert first.flightTimes == {"KeyA->KeyB": 50}  # B→A не в top, A→B ×3
    assert first.correctionRate == pytest.approx(1 / 6)
    assert first.totalDuration == 650  # 0 → up у Back (600 + 50)
    # B→C разорвана Backspace, C→D не в top; удержаний C и D по 3 — есть
    assert second.flightTimes == {}
    assert second.dwellTimes == {"KeyC": 50, "KeyD": 50}
    assert second.correctionRate == 0


def test_make_windows_below_k_is_missing_not_zero():
    windows = make_windows(stream(["A", "A", "B", "C"]), top_pairs=[], w=4, k=2)
    assert windows[0].dwellTimes == {"KeyA": 50}


def test_make_windows_pair_across_boundary_is_dropped():
    # w=2: A B | A B — пара B→A на стыке не идёт ни в одно окно
    windows = make_windows(stream(["A", "B", "A", "B"]), top_pairs=[("B", "A")], w=2, k=1)
    assert [w.flightTimes for w in windows] == [{}, {}]


def test_make_windows_sorts_by_down():
    # Порядок отпускания: B раньше A. Окно всё равно начинается с A.
    windows = make_windows([Pressed("B", 50, 90), Pressed("A", 0, 120)], [("A", "B")], w=2, k=1)
    assert windows[0].flightTimes == {"KeyA->KeyB": -70}
    assert windows[0].totalDuration == 120


# ---------- шаг 6: top-пары и сборка ----------


def write_keys(path, keys):
    t, lines = 0, []
    for k in keys:
        lines += [f"{k} KeyDown {t}", f"{k} KeyUp {t + 50}"]
        t += 100
    path.write_text("\n".join(lines) + "\n")


def test_top_pairs_ranks_by_people_then_occurrences(tmp_path):
    write_keys(tmp_path / "001000.txt", ["A", "B"] * 10)          # A→B, B→A у 001 много
    write_keys(tmp_path / "002000.txt", ["A", "B", "C", "D"] * 3)  # у 002 A→B ×3, B→C ×3
    top = top_pairs([tmp_path / "001000.txt", tmp_path / "002000.txt"], n=2, k=3)
    # A→B — у двоих; B→A и B→C — у одного, но B→A чаще по вхождениям
    assert top == [("A", "B"), ("B", "A")]


def test_load_buffalo_keeps_empty_files(tmp_path):
    d = tmp_path / "s0" / "baseline"
    d.mkdir(parents=True)
    write_keys(d / "001000.txt", ["A", "B"] * 3)
    write_keys(d / "001001.txt", ["A"])
    write_keys(d / "002000.txt", ["A", "B"] * 3)
    data = load_buffalo(tmp_path, {"001"}, [("A", "B")], w=2, k=1)
    assert set(data) == {"001"}
    assert len(data["001"][(0, 0)]) == 3
    assert data["001"][(0, 1)] == []


# ---------- шаг 7: половины A/B ----------


def fake_users():
    """10 baseline, 5 rotation 1→2→3, 4 rotation 2→3→1; у каждого 3 сессии × 2 задачи."""
    orders = [(0, 0, 0)] * 10 + [(1, 2, 3)] * 5 + [(2, 3, 1)] * 4
    users = []
    for i, kbs in enumerate(orders):
        for session, kb in enumerate(kbs):
            for task in (0, 1):
                users.append(User(f"{i:03d}", session, kb, task))
    return users


def test_stratum():
    assert stratum([User("001", s, 0, 0) for s in range(3)]) == "baseline"
    assert stratum([User("080", 0, 1, 0), User("080", 1, 2, 0)]) == "rotation_123"
    assert stratum([User("090", 0, 2, 0), User("090", 1, 3, 0)]) == "rotation_231"


def test_split_users_disjoint_complete_balanced():
    users = fake_users()
    a, b = split_users(users, seed=0)
    assert not a & b
    assert a | b == {u.username for u in users}
    assert abs(len(a) - len(b)) <= 1  # 19 человек → 10/9

    by_user = defaultdict(list)
    for u in users:
        by_user[u.username].append(u)
    for half in (a, b):
        counts = Counter(stratum(by_user[x]) for x in half)
        assert counts["baseline"] == 5
        assert counts["rotation_231"] == 2
        assert counts["rotation_123"] in (2, 3)


def test_split_users_reproducible():
    users = fake_users()
    assert split_users(users, seed=7) == split_users(users, seed=7)
    assert split_users(list(reversed(users)), seed=7) == split_users(users, seed=7)


# ---------- шаг 8: мышь ----------

MOUSE_SAMPLE = """\
License Stuff
System User Name | someone
635784297577363743 | 9/21/2015 10:55:57 AM | All Process Hooks except the Mouse Handler
635784297580171748 | 9/21/2015 10:55:58 AM | Window Activated | C:\\x.exe | Title
635784297580483748 | 9/21/2015 10:55:58 AM | Mouse Coordinates | 611,676
635784297580640000 | 9/21/2015 10:55:58 AM | Mouse Coordinates | -920,5
635784297650839872 | 9/21/2015 10:56:05 AM | Left | Click
635784297660000000 | 9/21/2015 10:56:06 AM | Right | Click
"""


def test_read_mouse_parses_points_and_clicks(tmp_path):
    f = tmp_path / "001000.txt"
    f.write_text(MOUSE_SAMPLE)
    points, clicks = read_mouse(f)
    assert points.shape == (2, 3)
    assert points[0].tolist() == [63578429758048.3748, 611, 676]
    assert points[1, 1:].tolist() == [-920, 5]  # второй монитор — отрицательный x
    assert clicks == [(63578429765083.9872, "Left"), (63578429766000.0, "Right")]


def test_read_mouse_without_points(tmp_path):
    f = tmp_path / "001001.txt"
    f.write_text("635784297650839872 | 9/21/2015 10:56:05 AM | Left | Click\n")
    points, clicks = read_mouse(f)
    assert points.shape == (0, 3)
    assert len(clicks) == 1


def test_mouse_path():
    assert mouse_path(Path("x/s0/baseline/001000.txt"), "m") == Path("m/001000.txt")


# ---------- эталонные числа на всём датасете ----------

needs_data = pytest.mark.skipif(
    not KEYS_ROOT.exists() or not MOUSE_ROOT.exists(), reason="нет данных Buffalo"
)


@pytest.fixture(scope="module")
def dataset_stats():
    """Один проход по всем файлам клавиатуры — общие счётчики для эталонных тестов."""
    files = list_files(KEYS_ROOT)
    s = {"files": files, "events": Counter(), "cleaning": Counter(), "pairs": Counter(),
         "pair_rate": Counter(), "n_pressed": 0, "n_letters": 0}
    for file in files:
        events = read_events(file)
        s["events"].update(e.event for e in events)
        pressed, rules = to_pressed(events)
        s["cleaning"].update(rules)
        s["n_pressed"] += len(pressed)
        s["n_letters"] += len(letters_presses(pressed))
        l_pairs, c = pairs(pressed)
        s["pairs"].update(c)
        s["pairs"]["total"] += len(l_pairs) + c["pause"]
        s["pair_rate"].update((p.f_key, p.s_key) for p in l_pairs)
    return s


@needs_data
@pytest.mark.data
def test_dataset_files_and_people(dataset_stats):
    files = dataset_stats["files"]
    keyboards = defaultdict(set)
    for f in files:
        u = parse_name(f.stem)
        keyboards[u.username].add(u.keyboard)
    assert len(files) == 888
    assert len(keyboards) == 148
    for f in files:
        expected = {0} if f.parent.name == "baseline" else {1, 2, 3}
        assert keyboards[parse_name(f.stem).username] == expected


@needs_data
@pytest.mark.data
def test_dataset_events_and_cleaning(dataset_stats):
    e, c, n = dataset_stats["events"], dataset_stats["cleaning"], dataset_stats["n_pressed"]
    assert e["KeyDown"] == 2_468_072
    assert e["KeyUp"] == 2_468_409
    assert {k: c[k] for k in ("Repeat", "Alone", "Remains", "TimeZero", "TimeOver")} == {
        "Repeat": 246, "Alone": 596, "Remains": 13, "TimeZero": 669, "TimeOver": 1080,
    }
    assert e["KeyDown"] == n + c["Repeat"] + c["TimeZero"] + c["TimeOver"] + c["Remains"]
    assert e["KeyUp"] == n + c["TimeZero"] + c["TimeOver"] + c["Alone"]


@needs_data
@pytest.mark.data
def test_dataset_letters_and_pairs(dataset_stats):
    s = dataset_stats
    p = s["pairs"]
    assert math.isclose(s["n_letters"] / s["n_pressed"] * 100, 86.6, abs_tol=0.05)
    assert math.isclose(p["below_zero"] / p["total"] * 100, 17.4, abs_tol=0.05)
    assert math.isclose(p["pause"] / p["total"] * 100, 1.1, abs_tol=0.05)
    assert [k for k, _ in s["pair_rate"].most_common(4)] == [
        ("E", "Space"), ("Space", "T"), ("T", "Space"), ("T", "H"),
    ]


@needs_data
@pytest.mark.data
def test_dataset_windows(dataset_stats):
    files = dataset_stats["files"]
    top = top_pairs([f for f in files if parse_name(f.stem).session == 0], n=50)
    data = load_buffalo(KEYS_ROOT, {parse_name(f.stem).username for f in files}, top)
    s1_task1 = [w for d in data.values() for w in d[(1, 1)]]
    assert statistics.median(len(w.dwellTimes) for w in s1_task1) == 18
    assert statistics.median(len(w.flightTimes) for w in s1_task1) == 14
    train = [len(d[(0, 0)]) + len(d[(0, 1)]) for d in data.values()]
    assert statistics.median(train) == 23
    assert min(train) == 14


@needs_data
@pytest.mark.data
def test_dataset_split(dataset_stats):
    users = [parse_name(f.stem) for f in dataset_stats["files"]]
    a, b = split_users(users, seed=0)
    assert len(a) == len(b) == 74 and not a & b


@needs_data
@pytest.mark.data
def test_dataset_mouse(dataset_stats):
    n_points, clicks, almost_empty = 0, Counter(), []
    for f in dataset_stats["files"]:
        points, cl = read_mouse(mouse_path(f, MOUSE_ROOT))
        n_points += len(points)
        clicks.update(b for _, b in cl)
        if len(points) <= 1:
            almost_empty.append(parse_name(f.stem))
    assert n_points == 5_457_238
    assert clicks == {"Left": 33_516, "Right": 3_596}
    assert len(almost_empty) == 88
    assert all(u.task == 1 for u in almost_empty)
