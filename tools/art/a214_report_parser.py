"""Offline read-only art report parser."""
import json
from pathlib import Path
def list_models(folder):
    return [p.name for p in Path(folder).glob("*.json")]
