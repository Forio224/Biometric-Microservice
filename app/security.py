import time
from collections import defaultdict, deque


class SimpleRateLimiter:
    def __init__(self, max_requests: int, window_seconds: int) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._buckets: dict[str, deque[float]] = defaultdict(deque)

    def is_allowed(self, key: str) -> bool:
        now = time.time()
        bucket = self._buckets[key]
        border = now - self.window_seconds

        while bucket and bucket[0] < border:
            bucket.popleft()

        if len(bucket) >= self.max_requests:
            return False

        bucket.append(now)
        return True

