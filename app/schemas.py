from typing import Dict, List, Optional

from pydantic import BaseModel, Field, field_validator


class KeystrokeFeatures(BaseModel):
    # Frontend sends timings in milliseconds (performance.now()).
    # Allow up to 60 seconds in ms.
    totalDuration: float = Field(ge=0.0, le=60000.0)
    dwellTimes: Dict[str, float]
    flightTimes: Dict[str, float]
    globalDwells: Optional[List[float]] = None
    globalFlights: Optional[List[float]] = None
    typedChars: Optional[int] = Field(default=0, ge=0)
    backspaceCount: Optional[int] = Field(default=0, ge=0)
    deleteCount: Optional[int] = Field(default=0, ge=0)
    correctionRate: Optional[float] = Field(default=0.0, ge=0.0, le=1.0)

    @field_validator("dwellTimes", "flightTimes")
    @classmethod
    def ensure_non_empty_and_non_negative(cls, values: Dict[str, float]):
        if not values:
            raise ValueError("Feature map cannot be empty")
        if any(v < 0 for v in values.values()):
            raise ValueError("Feature values must be non-negative")
        return values


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9_.-]+$")
    samples: List[KeystrokeFeatures] = Field(min_length=3, max_length=50)


class VerifyRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9_.-]+$")
    sample: KeystrokeFeatures

