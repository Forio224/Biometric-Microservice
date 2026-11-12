from collections import Counter, defaultdict
from pathlib import Path
from typing import NamedTuple


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
    for file in files:
        events = read_events(file)
        c.update(ev.event for ev in events)
        pressed, rules = to_pressed(events)
        cleaning.update(rules)
        n_pressed += len(pressed)
    assert c["KeyUp"] == 2_468_409, (
        "Количество общих отпусканий клавиш должно быть равно 2 468 409"
    )
    assert c["KeyDown"] == 2_468_072, (
        "Количество общих нажатий клавиш должно быть равно 2 468 072"
    )

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
