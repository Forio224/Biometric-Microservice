import math
import string
from collections import Counter, defaultdict
from pathlib import Path
from typing import NamedTuple

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
