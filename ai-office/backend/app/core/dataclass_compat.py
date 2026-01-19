from __future__ import annotations

import inspect
from dataclasses import dataclass
from typing import Any, Callable, Optional, TypeVar, Union, overload

_T = TypeVar("_T")

_HAS_SLOTS = "slots" in inspect.signature(dataclass).parameters


@overload
def frozen_dataclass(cls: type[_T], /, **kwargs: Any) -> type[_T]: ...


@overload
def frozen_dataclass(cls: None = None, /, **kwargs: Any) -> Callable[[type[_T]], type[_T]]: ...


def frozen_dataclass(
    cls: Optional[type[_T]] = None,
    /,
    **kwargs: Any,
) -> Union[Callable[[type[_T]], type[_T]], type[_T]]:
    dataclass_kwargs: dict[str, Any] = {"frozen": True, **kwargs}
    if _HAS_SLOTS:
        dataclass_kwargs.setdefault("slots", True)

    if cls is None:
        return dataclass(**dataclass_kwargs)
    return dataclass(**dataclass_kwargs)(cls)
