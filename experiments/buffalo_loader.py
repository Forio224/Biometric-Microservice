from collections import defaultdict
from pathlib import Path
from typing import NamedTuple


class User(NamedTuple):
    username: str
    session: int
    keyboard: int
    task: int


def list_files(root) -> list[Path]:
    p = Path(root)
    files = list(p.glob("*/*/*.txt"))
    return files


def parse_name(stem) -> User:
    username = stem[:3]
    session = int(stem[3])
    keyboard = int(stem[4])
    task = int(stem[5])
    u = User(username, session, keyboard, task)
    return u


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
