"""Structured logging configuration with credential sanitization."""

import logging
import re
import sys
from typing import Optional


class SensitiveDataFilter(logging.Filter):
    """Filter that masks API tokens and authorization headers from all log records."""

    BEARER_PATTERN = re.compile(r"Bearer\s+([A-Za-z0-9_\-\.]+)", re.IGNORECASE)
    TOKEN_PARAM_PATTERN = re.compile(
        r"(api[_-]?token|token|authorization)=([A-Za-z0-9_\-\.]+)", re.IGNORECASE
    )

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            # Mask Bearer tokens
            record.msg = self.BEARER_PATTERN.sub("Bearer [REDACTED]", record.msg)
            # Mask key=value token parameters
            record.msg = self.TOKEN_PARAM_PATTERN.sub(r"\1=[REDACTED]", record.msg)

        if record.args:
            sanitized_args = []
            for arg in record.args:
                if isinstance(arg, str):
                    s = self.BEARER_PATTERN.sub("Bearer [REDACTED]", arg)
                    s = self.TOKEN_PARAM_PATTERN.sub(r"\1=[REDACTED]", s)
                    sanitized_args.append(s)
                else:
                    sanitized_args.append(arg)
            record.args = tuple(sanitized_args)

        return True


def setup_logging(log_level: str = "INFO") -> logging.Logger:
    """Configure root logger with consistent formatting and secret sanitization."""
    logger = logging.getLogger("cyberpulse")
    logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))

    # Avoid duplicate handlers if setup is called multiple times
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(getattr(logging, log_level.upper(), logging.INFO))

        formatter = logging.Formatter(
            fmt="%(asctime)s [%(levelname)s] %(name)s (%(filename)s:%(lineno)d): %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S%z",
        )
        handler.setFormatter(formatter)
        handler.addFilter(SensitiveDataFilter())

        logger.addHandler(handler)
        logger.propagate = False

    return logger


logger = setup_logging()
